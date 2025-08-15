import { getFullYear, hideElement, makeInvisible, makeVisible, showElement } from "./helper.mjs";
import { AddToast } from "./toast.mjs";

// Discovery doc URL for APIs used by the quickstart
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';

// Authorization scopes required by the API; multiple scopes can be
// included, separated by spaces.
const SCOPES = 'https://www.googleapis.com/auth/calendar';

const calendarName = "Medicine reminder";
const tokenStorageLocation = "my-access-token";
const CLIENT_ID = process.env["GOOGLE-CLIENT-ID"];
const API_KEY = process.env["GOOGLE-API-KEY"];

export function GoogleCalendarHandler() {
  this.calendarId = null;
  this.tokenClient = null;

  let isAuthed = false;
  let gapiInited = false;
  let gisInited = false;

  this.authorize = function() {
    return new Promise((resolve, reject) => {
      const onAuthDoneWrapper = async (iteration) => {
        getCalendarId()
          .then(id => {
            this.calendarId = id;
            AddToast("Found calendar", this.calendarId, "success");

            isAuthed = true;
            // makeVisible(signOutButton);
            // authButton.innerText = 'Refresh';
      
            AddToast("Auth done");
            resolve();
          })
          .catch((e) => {
            AddToast("Auth failed", e, "error", -1);
            console.error(e);

            // showElement(loginScreen);
            localStorage.removeItem(tokenStorageLocation);

            if (iteration >= 1) {
              AddToast("Auth failed - Will not retry", e, "error", -1);
              console.error(e);
              reject(e);
              return;
            }

            handleAuthClick(iteration + 1);
          });
      }

      const handleAuthClick = async (iteration) => {
        const storedToken = localStorage.getItem(tokenStorageLocation);
        if (storedToken) {
          window.gapi.client.setToken({
            access_token: JSON.parse(storedToken).access_token
          });

          await onAuthDoneWrapper(iteration);
          return;
        }

        this.tokenClient.callback = async (resp) => {
          if (resp.error !== undefined) {
            throw (resp);
          }

          const tokenData = window.gapi.client.getToken();
          localStorage.setItem(tokenStorageLocation, JSON.stringify(tokenData));

          await onAuthDoneWrapper(iteration);
        };
        
        if (window.gapi.client.getToken() === null) {
          // Prompt the user to select a Google Account and ask for consent to share their data
          // when establishing a new session.
          this.tokenClient.requestAccessToken({prompt: 'consent'});
        } else {
          // Skip display of account chooser and consent dialog for an existing session.
          this.tokenClient.requestAccessToken({prompt: ''});
        }
      }

      handleAuthClick(0);
    })
  }

  this.makeSignOutButton = function(button) {
    button.addEventListener(button, () => {
      if (!this.isReady()) {
        return;
      }

      const token = window.gapi.client.getToken();
      if (token !== null) {
        window.google.accounts.oauth2.revoke(token.access_token);
        window.gapi.client.setToken('');

        // authButton.innerText = 'Authorize';
        // makeInvisible(signOutButton);
      }
    });
  }

  this.isAuthenticated = function() {
    return isAuthed;
  }

  this.isReady = () => {
    return gapiInited && gisInited;
  }

  this.init = function() {
    return new Promise((resolve) => {
      const gapiLoaded = () => {
        window.gapi.load('client', async () => {
          await window.gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: [DISCOVERY_DOC],
          });
          gapiInited = true;
          maybeDone();
        });
      }

      const gsiLoaded = () => {
        this.tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: '', // defined later
        });
        gisInited = true;
        maybeDone();
      }

      const maybeDone = () => {
        if (gapiInited && gisInited) {
          resolve();
        }
      }

      insertGoogleScripts(gapiLoaded, gsiLoaded);
    });
  }

  // async function viewNearestExp() {
  //   let response;
  //   try {
  //     const request = {
  //       'calendarId': this.calendarId,
  //       'timeMin': (new Date()).toISOString(),
  //       'showDeleted': false,
  //       'singleEvents': true,
  //       'maxResults': 1,
  //       'orderBy': 'startTime',
  //     };
  //     response = await window.gapi.client.calendar.events.list(request);
  //   } catch (err) {
  //     document.getElementById('content').innerText = err.message;
  //     return;
  //   }

  //   const events = response.result.items;
  //   if (!events || events.length == 0) {
  //     document.getElementById('content').innerText = 'No events found.';
  //     return;
  //   }

  //   const date = events[0].start.dateTime || events[0].start.date;
  //   document.getElementById('content').innerText = "Next item expires: " + date;
    
  //   // // Flatten to string to display
  //   // const output = events.reduce(
  //   //     (str, event) => `${str}${event.summary} (${event.start.dateTime || event.start.date})\n`,
  //   //     'Events:\n');
  //   // document.getElementById('content').innerText = output;
  // }

  async function getCalendarId() {
    const calendar = await getExistingCalendar();
    
    if (!calendar) {
      const result = await createCalendar();
      return result.id;
    }

    return calendar.id;
  }

  async function createCalendar() {
    console.log("Creating calendar...");

    const request = {
      "summary": calendarName
    };
    const response = await window.gapi.client.calendar.calendars.insert(request);
    console.log("Create calendar response:", response);

    AddToast("Added calendar", `Calendar "${calendarName}" has been created`, "success");

    return response.result;
  }

  async function getExistingCalendar() {
    const listCalendarResponse = await window.gapi.client.request({
      path: "/calendar/v3/users/me/calendarList"
    })
    const calendar = listCalendarResponse.result.items.find(i => i.summary === calendarName);

    console.log("All calendars", listCalendarResponse);
    console.log("Matching calendar", calendar);

    return calendar;
  }

  this.createReminder = async (data) => {
    if (!this.isReady()) {
      throw new Error("Not ready yet");
    }

    if (!data) {
      throw new Error("Provide item data");
    }

    if (!data.EXP) {
      throw new Error("Item does not have an expiration date")
    }

    const year = getFullYear(data.EXP.year);
    const month = data.EXP.month;
    const date = `${year}-${month}-01`;

    let desc = `Din medicin går ut ${month}/${year}\n`;
    if (data.PC) {
      desc += "\nPC:  " + data.PC;
    }
    if (data.SN) {
      desc += "\nSN:  " + data.SN;
    }
    if (data.LOT) {
      desc += "\nLOT: " + data.LOT;
    }
    desc += `\nEXP: ${month}/${year}`;

    const event = {
      'summary': 'Medicin går ut',
      'location': 'Närmaste apotek',
      'description': desc,
      'start': {
        "date": date
      },
      'end': {
        "date": date
      },
      'reminders': {
        'useDefault': false,
        'overrides': [
          {'method': 'email', 'minutes': 7 * 24 * 60 - 10 * 60},
          {'method': 'popup', 'minutes': 7 * 24 * 60 - 10 * 60},
          {'method': 'popup', 'minutes': 24 * 60 - 10 * 60},
        ]
      }
    };

    const createEventResponse = await window.gapi.client.calendar.events.insert({
      'calendarId': this.calendarId,
      'resource': event
    });

    console.log(createEventResponse);
    return createEventResponse;
  }
}

function insertGoogleScripts(onGapiLoad, onGsiLoad) {
  const gapiScript = document.createElement("script");
  gapiScript.setAttribute("async", "");
  gapiScript.setAttribute("defer", "");
  gapiScript.setAttribute("src", "https://apis.google.com/js/api.js");
  gapiScript.addEventListener("load", onGapiLoad);
  
  const gsiScript = document.createElement("script");
  gsiScript.setAttribute("async", "");
  gsiScript.setAttribute("defer", "");
  gsiScript.setAttribute("src", "https://accounts.google.com/gsi/client");
  gsiScript.addEventListener("load", onGsiLoad);
  
  document.body.append(gapiScript);
  document.body.append(gsiScript);
}