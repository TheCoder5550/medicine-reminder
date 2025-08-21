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
const SCOPES = [
  // See the list of Google calendars you're subscribed to
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",

  // See, create, change, and delete events on Google calendars you own.
  "https://www.googleapis.com/auth/calendar.events.owned",

  // Make secondary Google calendars, and see, create, change, and delete events on them.
  "https://www.googleapis.com/auth/calendar.app.created",
].join(" ");

const LOCAL_STORAGE_PREFIX = "com.tc5550.medicine_reminder.";
const LS_CONSENT = LOCAL_STORAGE_PREFIX + "consent-done";
const LS_TOKEN = LOCAL_STORAGE_PREFIX + "my-access-token";

export function GoogleCalendarHandler() {
  this.calendarId = null;
  this.tokenClient = null;

  let isAuthed = false;
  let gapiInited = false;
  let gisInited = false;

  const defaultEventSummary = "Medicin går ut";

  this.onReAuth = null;

  const reAuth = (result) => {
    AddToast("Session expired. Sign in again");
    console.error("Session expired", result);

    isAuthed = false;
    window.gapi.client.setToken('');
    localStorage.removeItem(LS_TOKEN);

    this.onReAuth?.(result);
  };

  this.hasAuthorizedBefore = function() {
    const storedToken = localStorage.getItem(LS_TOKEN);
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
      if (!this.isReady()) {
        reject("Google API has not been initialized");
        return;
      }

      const onAuthDoneWrapper = () => {
        isAuthed = true;
        resolve();
      }

      const handleAuthClick = async () => {
        const storedToken = localStorage.getItem(LS_TOKEN);
        if (storedToken) {
          try {
            const token = JSON.parse(storedToken).access_token;

            window.gapi.client.setToken({
              access_token: token
            });

            onAuthDoneWrapper();
            return;
          }
          catch (e) {
            reject(e);
            AddToast("Unknown error", stringifyError(e), "error");
            console.error(e);
            localStorage.removeItem(LS_TOKEN);
            return;
          }
        }

        this.tokenClient.callback = async (resp) => {
          if (resp.error == "access_denied") {
            reject("You denied access to your Google Calendar. Allow at least one scope if you want to connect your Google Calendar.");
            return;
          }

          if (resp.error !== undefined) {
            reject(resp);
            return;
          }

          const tokenData = window.gapi.client.getToken();
          localStorage.setItem(LS_TOKEN, JSON.stringify(tokenData));
          localStorage.setItem(LS_CONSENT, "true");

          onAuthDoneWrapper();
        };
        
        if (window.gapi.client.getToken() === null && localStorage.getItem(LS_CONSENT) !== "true") {
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

  this.signOut = async function() {
    if (!this.isReady()) {
      throw new Error("Google API has not been initialized");
    }

    const token = window.gapi.client.getToken();
    if (token !== null) {
      await window.google.accounts.oauth2.revoke(token.access_token);
      await window.gapi.client.setToken('');
      localStorage.removeItem(LS_TOKEN);
      localStorage.removeItem(LS_CONSENT);
      isAuthed = false;
    }
  }

  this.isAuthenticated = function() {
    return isAuthed;
  }

  this.isReady = () => {
    return gapiInited && gisInited;
  }

  this.init = function() {
    return new Promise((resolve, reject) => {
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

      let hasErrored = false;
      const onLoadError = () => {
        if (hasErrored) {
          return;
        }
        hasErrored = true;
        reject("Error loading Google script");
      }

      insertGoogleScripts(gapiLoaded, gsiLoaded, onLoadError, onLoadError);
    });
  }

  this.canListCalendars = function() {
    if (!this.isReady()) {
      return false;
    }

    try {
      const storedToken = localStorage.getItem(LS_TOKEN);
      const tokenResponse = JSON.parse(storedToken);

      if (tokenResponse && tokenResponse.access_token) {
        if (window.google.accounts.oauth2.hasGrantedAnyScope(tokenResponse, "https://www.googleapis.com/auth/calendar.calendarlist.readonly")) {
          return true;
        }
      }
    }
    catch {
      return false;
    }

    return false;
  }

  this.isEventReminder = function(event) {
    return (
      event.summary == defaultEventSummary &&
      event.start.date
    )
  }

  this.getAllReminders = async function() {
    if (!this.isReady()) {
      throw new Error("Google API has not been initialized");
    }

    if (!this.isAuthenticated()) {
      throw new Error("Not signed in");
    }

    if (this.calendarId == null) {
      throw new Error("Specify calendarId");
    }

    return new Promise((resolve, reject) => {
      window.gapi.client.request({
        path: `/calendar/v3/calendars/${this.calendarId}/events`,
        params: {
          "summary": defaultEventSummary,
          'timeMin': (new Date()).toISOString(),
          'showDeleted': false,
          'singleEvents': true,
          'orderBy': 'startTime',
        }
      })
        .then(response => {
          const events = response.result.items;
          if (!events) {
            resolve([]);
            return;
          }

          const reminders = response.result.items.filter(this.isEventReminder);
          resolve(reminders);
        })
        .catch(e => {
          if (e && e.status == 401) {
            reAuth(e);
          }

          reject(e);
        });
    });
  }

  this.createCalendar = async (calendarName) => {
    if (!this.isReady()) {
      throw new Error("Google API has not been initialized");
    }

    if (!this.isAuthenticated()) {
      throw new Error("Not signed in");
    }

    if (!calendarName) {
      throw new Error("Specify calendar name");
    }

    return new Promise((resolve, reject) => {
      console.log("Creating calendar...");

      const request = {
        "summary": calendarName
      };
      window.gapi.client.calendar.calendars.insert(request)
        .then(response => {
          console.log("Create calendar response:", response);
          resolve(response.result);
        })
        .catch(e => {
          if (e && e.status == 401) {
            reAuth(e);
          }

          reject(e);
        })
    });
  }

  this.listAllCalendars = async function() {
    if (!this.isReady()) {
      throw new Error("Google API has not been initialized");
    }

    if (!this.isAuthenticated()) {
      throw new Error("Not signed in");
    }

    return new Promise((resolve, reject) => {
      window.gapi.client.request({
        path: "/calendar/v3/users/me/calendarList"
      })
        .then(response => {
          if (response.error) {
            throw response.error;
          }
      
          const calendars = response.result.items;
          calendars.sort((a, b) => ((b.primary ? 1 : 0) - (a.primary ? 1 : 0)) * 2 + a.summary.localeCompare(b.summary));
          console.log("All calendars", calendars);
          
          resolve(calendars);
        })
        .catch(e => {
          if (e && e.status == 401) {
            reAuth(e);
          }

          reject(e);
        });
    });
  }

  this.createReminder = async (data) => {
    if (!this.isReady()) {
      throw new Error("Google API has not been initialized");
    }

    if (!this.isAuthenticated()) {
      throw new Error("Not signed in");
    }

    if (this.calendarId == null) {
      throw new Error("Specify calendarId");
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
      'summary': defaultEventSummary,
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
      throw new Error("Google API has not been initialized");
    }

    if (!this.isAuthenticated()) {
      throw new Error("Not signed in");
    }

    if (this.calendarId == null) {
      throw new Error("Specify calendarId");
    }

    if (!data) {
      throw new Error("Provide item data");
    }

    const searchQuery = data.PC ?? data.SN ?? data.EXP;
    if (!searchQuery) {
      throw new Error("Not enough info about medicine")
    }

    return new Promise((resolve, reject) => {
      window.gapi.client.request({
        path: `/calendar/v3/calendars/${this.calendarId}/events`,
        params: {
          'timeMin': (new Date()).toISOString(),
          'showDeleted': false,
          'singleEvents': true,
          'maxResults': 1,
          'orderBy': 'startTime',
          'q': searchQuery
        }
      })
        .then(response => {
          const events = response.result.items;
          if (!events || events.length == 0) {
            resolve(false);
            return;
          }

          resolve(true);
        })
        .catch(e => {
          if (e && e.status == 401) {
            reAuth(e);
          }

          reject(e);
        });
    });
  }
}

export function getEventViewUrl(calendarId, event) {
  if (calendarId == null) {
    throw new Error("Provide calendarId")
  }
  
  if (!event || !event.id) {
    throw new Error("Invalid event");
  }

  const splitEventId = event.id.split('@');
  return "https://www.google.com/calendar/event?eid=" + btoa(splitEventId[0] + " " + calendarId).replace("==", '');
}

function insertGoogleScripts(onGapiLoad, onGsiLoad, onGapiError, onGsiError) {
  const gapiScript = document.createElement("script");
  gapiScript.setAttribute("async", "");
  gapiScript.setAttribute("defer", "");
  gapiScript.setAttribute("src", "https://apis.google.com/js/api.js");
  gapiScript.addEventListener("load", onGapiLoad);
  gapiScript.addEventListener("error", onGapiError);
  
  const gsiScript = document.createElement("script");
  gsiScript.setAttribute("async", "");
  gsiScript.setAttribute("defer", "");
  gsiScript.setAttribute("src", "https://accounts.google.com/gsi/client");
  gsiScript.addEventListener("load", onGsiLoad);
  gapiScript.addEventListener("error", onGsiError);

  document.body.append(gapiScript);
  document.body.append(gsiScript);
}