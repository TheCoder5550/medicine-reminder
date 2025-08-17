import { getFullYear, stringifyError } from "./helper.mjs";
import { AddToast } from "./toast.mjs";

const CLIENT_ID = process.env["GOOGLE_CLIENT_ID"];
const API_KEY = process.env["GOOGLE_API_KEY"];

if (CLIENT_ID == undefined) {
  throw new Error("GOOGLE_CLIENT_ID has not been set");
}

if (API_KEY == undefined) {
  throw new Error("GOOGLE_API_KEY has not been set");
}

// Discovery doc URL for APIs used by the quickstart
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';

// Authorization scopes required by the API; multiple scopes can be
// included, separated by spaces.
const SCOPES = 'https://www.googleapis.com/auth/calendar';

const calendarName = "Medicine reminder";
const tokenStorageLocation = "my-access-token";

export function GoogleCalendarHandler() {
  this.calendarId = null;
  this.tokenClient = null;

  let isAuthed = false;
  let gapiInited = false;
  let gisInited = false;

  this.hasAuthorizedBefore = function() {
    const storedToken = localStorage.getItem(tokenStorageLocation);
    if (!storedToken) {
      return false;
    }

    try {
      const token = JSON.parse(storedToken).access_token;
      return !!token;
    }
    catch {
      return false;
    }
  }

  this.authorize = function() {
    return new Promise((resolve, reject) => {
      const onAuthDoneWrapper = async () => {
        getCalendarId()
          .then(id => {
            this.calendarId = id;
            isAuthed = true;
            resolve();
          })
          .catch((e) => {
            localStorage.removeItem(tokenStorageLocation);

            // Invalid token
            if (e.status == 401) {
              AddToast("Session expired. Sign in again");
            }
            else {
              AddToast("Authorization failed", stringifyError(e), "error");
            }

            console.error(e);
            reject(e);
          });
      }

      const handleAuthClick = async () => {
        const storedToken = localStorage.getItem(tokenStorageLocation);
        if (storedToken) {
          try {
            const token = JSON.parse(storedToken).access_token;

            window.gapi.client.setToken({
              access_token: token
            });

            await onAuthDoneWrapper();
            return;
          }
          catch (e) {
            AddToast("Error", stringifyError(e), "error");
          }
        }

        this.tokenClient.callback = async (resp) => {
          if (resp.error !== undefined) {
            throw (resp);
          }

          const tokenData = window.gapi.client.getToken();
          localStorage.setItem(tokenStorageLocation, JSON.stringify(tokenData));
          localStorage.setItem("consent-done", "true");

          await onAuthDoneWrapper();
        };
        
        if (window.gapi.client.getToken() === null && localStorage.getItem("consent-done") !== "true") {
          // Prompt the user to select a Google Account and ask for consent to share their data
          // when establishing a new session.
          this.tokenClient.requestAccessToken({prompt: 'consent'});
        } else {
          // Skip display of account chooser and consent dialog for an existing session.
          this.tokenClient.requestAccessToken({prompt: ''});
        }
      }

      handleAuthClick();
    })
  }

  this.signOut = function() {
    if (!this.isReady()) {
      return;
    }

    const token = window.gapi.client.getToken();
    if (token !== null) {
      window.google.accounts.oauth2.revoke(token.access_token);
      window.gapi.client.setToken('');
    }
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

    if (await this.doesReminderExist(data)) {
      throw new Error("Already exists");
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

    console.log("Event created:", createEventResponse);
    return createEventResponse;
  }

  this.doesReminderExist = async function(data) {
    if (!this.isReady()) {
      throw new Error("Not ready yet");
    }

    if (!data) {
      throw new Error("Provide item data");
    }

    const searchQuery = data.PC ?? data.SN ?? data.EXP;
    if (!searchQuery) {
      throw new Error("Not enough info about medicine")
    }

    const response = await window.gapi.client.request({
      path: `/calendar/v3/calendars/${this.calendarId}/events`,
      params: {
        'timeMin': (new Date()).toISOString(),
        'showDeleted': false,
        'singleEvents': true,
        'maxResults': 1,
        'orderBy': 'startTime',
        'q': searchQuery
      }
    });
    
    const events = response.result.items;
    if (!events || events.length == 0) {
      return false;
    }

    return true;
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