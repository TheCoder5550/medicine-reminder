import "../style.css";
import { BrowserDatamatrixCodeReader } from '@zxing/browser';

const CLIENT_ID = process.env["GOOGLE-CLIENT-ID"];
const API_KEY = process.env["GOOGLE-API-KEY"];

const authButton = document.getElementById('authorize_button');
const signOutButton = document.getElementById('signout_button');

const tapToStart = document.querySelector("#tap-to-start");
const loader = document.querySelector("#loader");
const videoContainer = document.querySelector(".video-container");

const resultLabel = document.querySelector("#result");
const video = document.querySelector('video');
const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d", {
  willReadFrequently: true
});

const codeReader = new BrowserDatamatrixCodeReader();
let hasStarted = false;

tapToStart.addEventListener("click", async () => {
  if (hasStarted) {
    return;
  }
  hasStarted = true;

  hideElement(tapToStart);
  showElement(loader);

  const constraints = {
    audio: false,
    video: {
      facingMode: "environment"
    }
  };

  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  video.srcObject = stream;

  showElement(videoContainer);

  canvas.width = 256;
  canvas.height = 256;

  video.addEventListener("play", () => {
    hideElement(loader);
    renderFrame();
  });

  let timeout = null;

  function renderFrame() {
    const scale = 0.15;
    const aspect = video.videoWidth / video.videoHeight;

    ctx.drawImage(
      video,
  
      (video.videoWidth - video.videoWidth * scale) / 2,
      (video.videoHeight - video.videoHeight * scale * aspect) / 2,
      video.videoWidth * scale,
      video.videoHeight * scale * aspect,
  
      0,
      0,
      canvas.width,
      canvas.height
    );

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const extraBrightness = 0;
    const factor = 2;

    let averageBrightness = 0;
    for (let i = 0; i < data.length; i += 4) {
      const currentAverage = (data[i] + data[i + 1] + data[i + 2]) / 3;
      data[i + 0] = currentAverage;
      data[i + 1] = currentAverage;
      data[i + 2] = currentAverage;
      averageBrightness += currentAverage;
    }
    averageBrightness /= (data.length / 4);

    for (let i = 0; i < data.length; i += 4) {
      data[i + 0] = factor * (data[i + 0] + 128 - averageBrightness + extraBrightness - 128) + 128;
      data[i + 1] = factor * (data[i + 1] + 128 - averageBrightness + extraBrightness - 128) + 128;
      data[i + 2] = factor * (data[i + 2] + 128 - averageBrightness + extraBrightness - 128) + 128;
    }

    const readData = data.slice();

    for (let i = 0; i < data.length; i += 4) {
      data[i] = (
        readData[i] * 5 -
        readData[i - 4] -
        readData[i + 4] -
        readData[i - canvas.width * 4] -
        readData[i + canvas.width * 4]
      );
      data[i + 1] = data[i];
      data[i + 2] = data[i];
    }

    ctx.putImageData(imageData, 0, 0);

    try {
      const result = codeReader.decodeFromCanvas(canvas);
      const resultText = result.getText();
      const exp = extractExpDate(resultText);
      resultLabel.textContent = "EXP: " + exp + " - " + resultText;

      clearTimeout(timeout);
      timeout = setTimeout(() => {
        resultLabel.textContent = "";
      }, 5000);
    }
    catch { /* empty */ }

    setTimeout(renderFrame, 100);
  }
})

// Discovery doc URL for APIs used by the quickstart
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';

// Authorization scopes required by the API; multiple scopes can be
// included, separated by spaces.
const SCOPES = 'https://www.googleapis.com/auth/calendar';

let tokenClient;
let gapiInited = false;
let gisInited = false;

authButton.addEventListener("click", handleAuthClick);
signOutButton.addEventListener("click", handleSignoutClick);

authButton.style.visibility = 'hidden';
signOutButton.style.visibility = 'hidden';

/**
 * Callback after api.js is loaded.
 */
window.gapiLoaded = function() {
  window.gapi.load('client', initializeGapiClient);
}

/**
 * Callback after the API client is loaded. Loads the
 * discovery doc to initialize the API.
 */
async function initializeGapiClient() {
  await window.gapi.client.init({
    apiKey: API_KEY,
    discoveryDocs: [DISCOVERY_DOC],
  });
  gapiInited = true;
  maybeEnableButtons();
}

/**
 * Callback after Google Identity Services are loaded.
 */
window.gisLoaded = function() {
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: '', // defined later
  });
  gisInited = true;
  maybeEnableButtons();
}

/**
 * Enables user interaction after all libraries are loaded.
 */
function maybeEnableButtons() {
  if (gapiInited && gisInited) {
    authButton.style.visibility = 'visible';
  }
}

/**
 *  Sign in the user upon button click.
 */
function handleAuthClick() {
  tokenClient.callback = async (resp) => {
    if (resp.error !== undefined) {
      throw (resp);
    }
    signOutButton.style.visibility = 'visible';
    authButton.innerText = 'Refresh';
    await listUpcomingEvents();
  };

  // if (window.gapi.client.getToken() === null) {
  //   // Prompt the user to select a Google Account and ask for consent to share their data
  //   // when establishing a new session.
  //   tokenClient.requestAccessToken({prompt: 'consent'});
  // } else {
  //   // Skip display of account chooser and consent dialog for an existing session.
  //   tokenClient.requestAccessToken({prompt: ''});
  // }

  tokenClient.requestAccessToken({prompt: ''});
}

/**
 *  Sign out the user upon button click.
 */
function handleSignoutClick() {
  const token = window.gapi.client.getToken();
  if (token !== null) {
    window.google.accounts.oauth2.revoke(token.access_token);
    window.gapi.client.setToken('');
    document.getElementById('content').innerText = '';
    authButton.innerText = 'Authorize';
    signOutButton.style.visibility = 'hidden';
  }
}

/**
 * Print the summary and start datetime/date of the next ten events in
 * the authorized user's calendar. If no events are found an
 * appropriate message is printed.
 */
async function listUpcomingEvents() {
  const calendarName = "Medicine reminder";
  let calendarId = null;

  const createCalendarResponse = await window.gapi.client.request({
    path: "/calendar/v3/users/me/calendarList"
  })
  const calendar = createCalendarResponse.result.items.find(i => i.summary === calendarName);

  console.log(createCalendarResponse, calendar);
  if (!calendar) {
    console.log("Creating calendar...");

    const request = {
      "summary": calendarName
    };
    const response = await window.gapi.client.calendar.calendars.insert(request);
    console.log(response);
    calendarId = response.result.id;
  }
  else {
    calendarId = calendar.id;
  }

  const date = "2025-08-16";
  const event = {
    'summary': 'Your medicine expires soon',
    'location': 'Nearest pharmacy',
    'description': 'Your medicine expires 08/2025\nPC: 1234\nSN: 4321',
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
    'calendarId': calendarId,
    'resource': event
  });

  console.log(createEventResponse);

  {
    let response;
    try {
      const request = {
        'calendarId': calendarId,
        'timeMin': (new Date()).toISOString(),
        'showDeleted': false,
        'singleEvents': true,
        'maxResults': 1,
        'orderBy': 'startTime',
      };
      response = await window.gapi.client.calendar.events.list(request);
    } catch (err) {
      document.getElementById('content').innerText = err.message;
      return;
    }

    const events = response.result.items;
    if (!events || events.length == 0) {
      document.getElementById('content').innerText = 'No events found.';
      return;
    }

    const date = events[0].start.dateTime || events[0].start.date;
    document.getElementById('content').innerText = "Next item expires: " + date;
    
    // // Flatten to string to display
    // const output = events.reduce(
    //     (str, event) => `${str}${event.summary} (${event.start.dateTime || event.start.date})\n`,
    //     'Events:\n');
    // document.getElementById('content').innerText = output;
  }
}

/**
 * @param {string} matrixString 
 */
function extractExpDate(matrixString) {
  const gs = String.fromCharCode(29);
  const regex = new RegExp(`${gs}17(\\d{2})(\\d{2})`);
  const match = matrixString.match(regex);
  if (!match) {
    return null;
  }

  const year = match[1];
  const month = match[2];

  return `${month}/${getFullYear(year)}`
}

function getFullYear(year) {
  for (let current = 20; current < 99; current++) {
    const full = parseInt(`${current.toString()}${year}`);
    const actualYear = new Date().getFullYear();
    if (full >= actualYear) {
      return full.toString();
    }
  }

  return year;
}

function hideElement(element) {
  element.classList.add("hidden");
}

function showElement(element) {
  element.classList.remove("hidden");
}

// Add scripts last
const gapiScript = document.createElement("script");
gapiScript.setAttribute("async", "");
gapiScript.setAttribute("defer", "");
gapiScript.setAttribute("src", "https://apis.google.com/js/api.js");
gapiScript.addEventListener("load", window.gapiLoaded);

const gsiScript = document.createElement("script");
gsiScript.setAttribute("async", "");
gsiScript.setAttribute("defer", "");
gsiScript.setAttribute("src", "https://accounts.google.com/gsi/client");
gsiScript.addEventListener("load", window.gisLoaded);

document.body.append(gapiScript);
document.body.append(gsiScript);