import "./styles/all.css";
import "./slide-overlay.mjs";

import { BrowserDatamatrixCodeReader } from '@zxing/browser';
import { AddToast, editToast } from "./toast.mjs";
import { formatDuration, formatGoogleDate, getFullYear, hideElement, isMobile, isStandalone, makeInvisible, makeVisible, removeAllChildren, setHidden, showElement, stringifyError } from "./helper.mjs";
import { decodeMedicineData } from "./medicine-decoding.mjs";
import { getEventViewUrl, GoogleCalendarHandler } from "./google-api.mjs";
import { getActiveSlide, getAllSlides, getFirstSlide, onboardEvents, setDisabled, setDisabledAll, setupOnboard, showFirstSlideInstant, showNextSlide, showPrevSlide, showSlideInstant } from "./onboard.mjs";
import { createSlideOverlays } from "./slide-overlay.mjs";

const LOCAL_STORAGE_PREFIX = "com.tc5550.medicine_reminder.";
const LS_CALENDAR_ID = LOCAL_STORAGE_PREFIX + "calendar-id";
const LS_ONBOARDING = LOCAL_STORAGE_PREFIX + "onboarding-complete";

const ENABLE_POSTPROCESSING = false;

const appTemplate = document.querySelector("#app");
if (!appTemplate) {
  throw new Error("No app template exists.")
}
const clone = appTemplate.content.cloneNode(true);
document.body.appendChild(clone);
appTemplate.remove();

setupOnboard();
createSlideOverlays();

const welcomeScreen = document.querySelector("#welcome-screen");
const installScreen = document.querySelector("#install-screen");

const cameraRequestScreen = document.querySelector("#camera-request-screen");
const previewVideo = cameraRequestScreen.querySelector('.preview-video');
const requestCameraButton = cameraRequestScreen.querySelector(".request-button");

const loginScreen = document.querySelector("#login-screen");
const calendarScreen = document.querySelector("#calendar-screen");
const scannerScreen = document.querySelector("#scanner-screen");
const loaderScreen = document.querySelector("#loader");

const resultLabel = document.querySelector("#result");
const video = document.querySelector('#video');
const canvas = document.querySelector("#canvas");
const ctx = canvas.getContext("2d", {
  willReadFrequently: true
});

canvas.width = 256;
canvas.height = 256;

let scale = 0.15;
const extraBrightness = 0;
const contrastFactor = 2;

const codeReader = new BrowserDatamatrixCodeReader();
let hasStartedCamera = false;
let renderFrameTimeout = null;
let timeout = null;
let lastScan = null;
let allReminders = [];

onboardEvents.on("showSlide", onShowSlide);
onboardEvents.on("exitSlide", onExitSlide);

const googleCalendar = new GoogleCalendarHandler();
await googleCalendar.init().catch(e => AddToast("Application error", stringifyError(e), "error"));
googleCalendar.calendarId = localStorage.getItem(LS_CALENDAR_ID);

googleCalendar.onReAuth = () => {
  showLoginSingle();
};

document.querySelector("#authorize_button").addEventListener("click", async () => {
  googleCalendar.authorize()
    .then(async () => {
      showElement(document.querySelector("#signout_button"));
      handleNextSlide();
    })
    .catch(e => {
      if (e.status != 401) {
        AddToast("Sign-in error", stringifyError(e), "error");
      }
      console.error(e);
      showLoginSingle();
    })
});

hideElement(document.querySelector("#signout_button"));
document.querySelector("#signout_button").addEventListener("click", () => {
  if (!confirm("Are you sure you want to sign out?")) {
    return;
  }

  googleCalendar.signOut();
  hideElement(document.querySelector("#signout_button"));
});

// Welcome
welcomeScreen.querySelector(".continue-button").addEventListener("click", () => {
  showNextSlide();
});

// Camera permission
cameraRequestScreen.querySelector(".continue-button").addEventListener("click", () => {
  handleNextSlide();
});
requestCameraButton.addEventListener("click", () => {
  requestCameraButton.disabled = true;

  navigator.permissions.query({name: 'camera'})
    .then(async function(result) {
      console.log(result.state);
      if (result.state == 'granted') {
        showPreview();
      }
      else if (result.state == 'prompt') {
        showPreview();
      }
      else if (result.state == 'denied') {
        AddToast("Camera error", "Permission denied", "error");
        requestCameraButton.disabled = false;
        // showCameraError("Permission denied");
      }

      // result.onchange = function() {
      //   console.log(result.state);
      //   if (result.state == "granted") {
      //     next();
      //   }
      //   else if (result.state == "denied") {
      //     showCameraError();
      //   }

      //   result.onchange = () => {};
      // }
    });

  function showPreview() {
    startCamera()
      .then(() => {
        hideElement(requestCameraButton);
        showElement(cameraRequestScreen.querySelector(".continue-button"));
      })
      .catch(e => {
        AddToast("Camera error", stringifyError(e), "error");
      })
      .finally(() => {
        requestCameraButton.disabled = false;
      })
  }
});

// Google login
loginScreen.querySelector(".skip-button").addEventListener("click", () => {
  AddToast("No calendar", "No reminders will be created since no calendar has been connected", "error", -1);
  setDisabled(calendarScreen, true);
});

// Calendar chooser
calendarScreen.querySelector(".continue-button").addEventListener("click", () => {
  calendarScreen.querySelector(".continue-button").disabled = true;

  const checked = calendarScreen.querySelector('input[name="calendar-radio-button"]:checked');
  if (!checked) {
    calendarScreen.querySelector(".continue-button").disabled = false;
    return;
  }

  if (checked.id == "@new") {
    const calendarName = calendarScreen.querySelector('input[name="new-calendar"]').value;
    if (!calendarName) {
      AddToast("Invalid name", "Enter a valid name for the calendar", "error");
      calendarScreen.querySelector(".continue-button").disabled = false;
      return;
    }

    const toast = AddToast("Creating calendar...", "", "buffer", -1);

    googleCalendar.createCalendar(calendarName)
      .then(result => {
        editToast(toast, "Calendar created", `Calendar "${calendarName}" has been created`, "success");
        googleCalendar.calendarId = result.id;
        localStorage.setItem(LS_CALENDAR_ID, googleCalendar.calendarId);
        
        handleNextSlide();
      })
      .catch(e => {
        editToast(toast, "Could not create calendar", stringifyError(e), "error");
        console.error(e);
      })
      .finally(() => {
        calendarScreen.querySelector(".continue-button").disabled = false;
      });

    return;
  }

  googleCalendar.calendarId = checked.value;
  localStorage.setItem(LS_CALENDAR_ID, googleCalendar.calendarId);
  calendarScreen.querySelector(".continue-button").disabled = false;
  
  handleNextSlide();
});

calendarScreen.querySelector(".skip-button").addEventListener("click", () => {
  if (localStorage.getItem(LS_CALENDAR_ID) == null) {
    googleCalendar.calendarId = "primary";
    localStorage.setItem(LS_CALENDAR_ID, googleCalendar.calendarId);
  }
});

calendarScreen.querySelector(".refresh").addEventListener("click", updateCalendarList);

// Scanner screen
scannerScreen.querySelector(".info-overlay .sign-out").addEventListener("click", async () => {
  if (!confirm("Are you sure you want to sign out?")) {
    return;
  }

  stopCamera();
  await googleCalendar.signOut().catch(console.error);
  localStorage.removeItem(LS_CALENDAR_ID);
  localStorage.removeItem(LS_ONBOARDING);

  const isOnboardDone = false;
  const hasChoosenCalendar = false;

  setDisabled(welcomeScreen, isOnboardDone);
  setDisabled(installScreen, isOnboardDone || isStandalone() || !isMobile());
  setDisabled(cameraRequestScreen, isOnboardDone);
  setDisabled(loginScreen, googleCalendar.hasAuthorizedBefore());
  setDisabled(calendarScreen, isOnboardDone && hasChoosenCalendar);

  hideElement(document.querySelector("#signout_button"));
  showFirstSlideInstant();
});

scannerScreen.querySelector(".info-overlay .change-calendar").addEventListener("click", () => {
  setDisabledAll(true);
  setDisabled(calendarScreen, false);
  showFirstSlideInstant();
});

document.querySelector(".restart-camera").addEventListener("click", restartCamera);

document.querySelector(".info-overlay .refresh").addEventListener("click", updateAllReminders);

scannerScreen.querySelector(".video-container").addEventListener("click", () => {
  scale = scale === 0.15 ? 0.3 : 0.15;
  scannerScreen.querySelector(".scan-frame").style.width = `${scale * 100}%`;

  video.play();
})

video.addEventListener("play", () => {
  const videoContainer = scannerScreen.querySelector(".video-container");
  const aspect = video.videoWidth / video.videoHeight;
  if (!isNaN(aspect)) {
    videoContainer.style.aspect = aspect;
    videoContainer.style.width = `max(100vw, 100vh * ${aspect})`;
    videoContainer.style.height = "unset";
  }

  clearTimeout(renderFrameTimeout);
  renderFrame();
});

const isOnboardDone = localStorage.getItem(LS_ONBOARDING) == "true";
const hasChoosenCalendar = googleCalendar.calendarId != null;

setDisabled(welcomeScreen, isOnboardDone);
setDisabled(installScreen, isOnboardDone || isStandalone() || !isMobile());
setDisabled(cameraRequestScreen, isOnboardDone);
setDisabled(loginScreen, false && isOnboardDone/* && googleCalendar.hasAuthorizedBefore()*/);
setDisabled(calendarScreen, isOnboardDone && hasChoosenCalendar);

// if (googleCalendar.hasAuthorizedBefore()) {
//   await googleCalendar.authorize()
//     .catch(e => {
//       if (e.status != 401) {
//         AddToast("Sign-in error", stringifyError(e), "error");
//       }
//       console.error(e);
//     })
// }

await showFirstSlideInstant();
if (!getActiveSlide()) {
  console.log("No slides left");
  onSlideEnd();
}

for (const slide of getAllSlides()) {
  const skipButton = slide.querySelector(".skip-button");
  const backButton = slide.querySelector(".back-button");

  if (skipButton) {
    skipButton.addEventListener("click", () => {
      handleNextSlide();
    })
  }

  if (backButton) {
    backButton.addEventListener("click", () => {
      if (!showPrevSlide()) {
        console.log("No slide before");
      }
    })
  }
}

async function handleNextSlide() {
  if (!await showNextSlide()) {
    // onboardDone();
  }
}

async function onShowSlide(slide, prev, handler) {
  console.log("From", prev, "To maybe:", slide);

  if (prev != null && slide == null) {
    console.log("Onboard done");
    onSlideEnd();
    return;
  }

  // Hide back button if this is the first active slide
  if (slide) {
    const isFirstSlide = getFirstSlide() === slide;
    const backButton = slide.querySelector(".back-button");
    if (backButton) {
      setHidden(backButton, isFirstSlide);
    }
  }

  // handler.restart();
  // handler.goto(n);

  switch (slide) {
    case cameraRequestScreen: {
      if (!navigator.permissions || !navigator.permissions.query) {
        return;
      }

      const result = await navigator.permissions.query({name: 'camera'})
        .then(async function(result) {
          return result.state == 'granted';
        })
        .catch(e => {
          AddToast("Camera error", stringifyError(e), "error");
          console.error(e);
          return false;
        });

      if (result) {
        handler.skip();
      }
      return;
    }
    case loginScreen: {
      if (prev == calendarScreen) {
        return;
      }

      if (googleCalendar.hasAuthorizedBefore()) {
        const result = await googleCalendar.authorize()
          .then(async () => {
            return true;
          })
          .catch(e => {
            if (e.status != 401) {
              AddToast("Sign-in error", stringifyError(e), "error");
            }
            console.error(e);
            return false;
          });
        
        setHidden(document.querySelector("#signout_button"), !result);
        if (result) {
          handler.skip();
        }
      }
      return;
    }
    case calendarScreen: {
      const list = calendarScreen.querySelector(".calendar-list");
      if (list.children.length === 0) {
        await updateCalendarList();
      }
      else {
        updateCalendarList();
      }
      return;
    }
  }
}

function onExitSlide() {}

function onSlideEnd() {
  localStorage.setItem(LS_ONBOARDING, true);
  // showSlideInstant(null);
  startScanner();
}

function showLoginSingle() {
  if (getActiveSlide() == loginScreen) {
    return;
  }
  
  setDisabled(loginScreen, false);
  showSlideInstant(loginScreen);
}

function renderFrame() {
  renderVideoToCanvas(video, canvas, ctx);
  scanCanvas();

  renderFrameTimeout = setTimeout(renderFrame, 100);
}

async function startScanner() {
  hideElement(welcomeScreen);
  hideElement(cameraRequestScreen);
  hideElement(loginScreen);

  showElement(scannerScreen);
  showElement(loaderScreen);
  
  clearTimeout(renderFrameTimeout);

  updateAllReminders();

  startCamera()
    .then(() => {
      renderFrame();
    })
    .catch(e => {
      AddToast("Camera error", stringifyError(e), "error");
    })
    .finally(() => {
      hideElement(loaderScreen);
      showElement(scannerScreen);
    });
}

async function startCamera() {
  if (hasStartedCamera) {
    return false;
  }

  const constraints = {
    audio: false,
    video: {
      facingMode: "environment",
      focusMode: "continuous",
      zoom: 2,
      frameRate: {
        max: 24
      }
    }
  };

  return new Promise((resolve, reject) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      reject("Context not secure. Cannot access camera");
      setVideoEnabledDOM(false);
      return;
    }

    navigator.mediaDevices.getUserMedia(constraints)
      .then(stream => {
        stream.getVideoTracks().forEach(track => {
          track.addEventListener("ended", () => {
            setVideoEnabledDOM(false);
          });
        });
    
        previewVideo.srcObject = stream;
        video.srcObject = stream;
        video.onloadedmetadata = () => {
          video.play();
        };
    
        setVideoEnabledDOM(true);
        
        hasStartedCamera = true;
        resolve(true);
      })
      .catch(e => {
        setVideoEnabledDOM(false);
        reject(e);
      })
  })
}

function stopCamera() {
  const stream = video.srcObject;
  if (stream) {
    stream.getTracks().forEach((track) => {
      if (track.readyState == 'live') {
        track.stop();
      }
    });
  }

  video.pause();
  hasStartedCamera = false;
}

function restartCamera() {
  document.querySelector(".restart-camera").disabled = true;

  stopCamera();
  setTimeout(() => {
    startCamera()
      .catch(e => {
        AddToast("Camera error", stringifyError(e), "error");
      })
      .finally(() => {
        document.querySelector(".restart-camera").disabled = false;
      })
  }, 300);
}

function scanCanvas() {
  try {
    const result = codeReader.decodeFromCanvas(canvas);
    const resultText = result.getText();
    resultLabel.textContent = resultText;
    
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      lastScan = null;
      resultLabel.textContent = "";
    }, 5000);

    if (lastScan != null && lastScan === resultText) {
      return;
    }
    lastScan = resultText;
    
    const data = decodeMedicineData(resultText);
    if (data.PC == null) {
      AddToast("Invalid data matrix", resultText, "error", 5000);
      return;
    }

    const toast = AddToast("Creating reminder", "", "buffer", -1);

    googleCalendar.createReminder(data)
      .then(response => {
        const expLabel = data.EXP.month + "/" + getFullYear(data.EXP.year);
        editToast(toast, "Reminder created", "Expires " + expLabel, "success", 5000);

        allReminders.push(response.result);
        allReminders.sort((a, b) => new Date(a.start.date) - new Date(b.start.date));
        updateAllRemindersDOM();
      })
      .catch(e => {
        const errorMessage = stringifyError(e);
        if (errorMessage === "Already exists") {
          editToast(toast, "Reminder has already been created", "", "info", 5000);
        }
        else {
          editToast(toast, "Error creating reminder!", stringifyError(e), "error", 5000);
        }
        console.error(e);
      });
  }
  catch { /* empty */ }
}

/**
 * @param {HTMLVideoElement} video 
 * @param {HTMLCanvasElement} canvas 
 * @param {CanvasRenderingContext2D} ctx 
 */
function renderVideoToCanvas(video, canvas, ctx) {
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

  if (ENABLE_POSTPROCESSING) {
    return;
  }

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Make black and white
  let averageBrightness = 0;
  for (let i = 0; i < data.length; i += 4) {
    const currentAverage = (data[i] + data[i + 1] + data[i + 2]) / 3;
    data[i + 0] = currentAverage;
    data[i + 1] = currentAverage;
    data[i + 2] = currentAverage;
    averageBrightness += currentAverage;
  }
  averageBrightness /= (data.length / 4);

  // Average brightness level and increase contrast
  for (let i = 0; i < data.length; i += 4) {
    data[i + 0] = contrastFactor * (data[i + 0] + 128 - averageBrightness + extraBrightness - 128) + 128;
    data[i + 1] = contrastFactor * (data[i + 1] + 128 - averageBrightness + extraBrightness - 128) + 128;
    data[i + 2] = contrastFactor * (data[i + 2] + 128 - averageBrightness + extraBrightness - 128) + 128;
  }

  // Sharpen
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
}

function setVideoEnabledDOM(enabled) {
  setHidden(scannerScreen.querySelector(".scan-frame"), !enabled);
  setHidden(scannerScreen.querySelector(".video-error-icon"), enabled);
}

function getUniqueCalendarName(calendars) {
  const baseName = "Medicine reminder";
  const names = calendars.map(c => c.summary);

  for (let i = 0; i < 10_000; i++) {
    const name = i === 0 ? baseName : `${baseName} ${i}`;
    if (!names.includes(name)) {
      return name;
    }
  }

  return "";
}

function updateCalendarList() {
  calendarScreen.querySelector(".continue-button").disabled = true;
  showElement(calendarScreen.querySelector(".calendar-list-loading"));
  makeInvisible(calendarScreen.querySelector(".calendar-list"));

  return new Promise((resolve) => {
    if (!googleCalendar.canListCalendars()) {
      updateCalendarListDOM([]);
      AddToast("No list available", "You denied permission to view your calendars so you have to create a new calendar", "info");
      resolve();
      return;
    }

    googleCalendar.listAllCalendars()
      .then(calendars => {
        const owned = calendars.filter(c => c.accessRole == "owner");
        updateCalendarListDOM(owned);
      })
      .catch(e => {
        if (e.status != 401) {
          AddToast("Could not list calendars", stringifyError(e), "error");
        }
      })
      .finally(() => {
        resolve();
      })
  })
    .finally(() => {
      const checked = !!calendarScreen.querySelector('input[name="calendar-radio-button"]:checked');
      calendarScreen.querySelector(".continue-button").disabled = !checked;
      hideElement(calendarScreen.querySelector(".calendar-list-loading"));
      makeVisible(calendarScreen.querySelector(".calendar-list"));
    })
}

function updateCalendarListDOM(calendars) {
  const prevId = localStorage.getItem(LS_CALENDAR_ID);

  const list = calendarScreen.querySelector(".calendar-list");
  removeAllChildren(list);

  for (let i = 0; i < calendars.length; i++) {
    const calendar = calendars[i];

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.id = "calendar-" + calendar.summary;
    radio.name = "calendar-radio-button";
    radio.value = calendar.id;
    radio.defaultChecked = prevId == null ?
      false :
      calendar.id == prevId || (calendar.primary && prevId === "primary");
    radio.addEventListener("change", () => {
      if (radio.checked) {
        calendarScreen.querySelector(".continue-button").disabled = false;
      }
    });

    const item = document.createElement("label");
    item.classList.add("list-item");
    item.setAttribute("for", radio.id);

    const square = document.createElement("div");
    square.classList.add("square");
    square.style.backgroundColor = calendar.backgroundColor ?? "transparent";

    const name = document.createElement("span");
    name.textContent = calendar.summary;

    item.append(square);
    item.append(name);

    list.appendChild(radio);
    list.appendChild(item);
  }

  const radio = document.createElement("input");
  radio.type = "radio";
  radio.id = "@new";
  radio.name = "calendar-radio-button";
  radio.value = "@new";
  radio.addEventListener("change", () => {
    if (radio.checked) {
      calendarScreen.querySelector(".continue-button").disabled = false;
    }
  });

  const item = document.createElement("label");
  item.classList.add("list-item", "new");
  item.setAttribute("for", radio.id);

  const square = document.createElement("div");
  square.classList.add("square");
  square.style.backgroundColor = "transparent";
  square.style.border = "1px solid rgba(255, 255, 255, 0.2)";

  const text = document.createElement("span");
  text.textContent = "New: ";

  const inputField = document.createElement("input");
  inputField.type = "text";
  inputField.name = "new-calendar";
  inputField.placeholder = "Enter calendar name";
  inputField.value = getUniqueCalendarName(calendars);
  inputField.addEventListener("keydown", e => {
    if (e.code == "Enter") {
      inputField.blur();
      item.click();
    }
  })

  item.append(square);
  item.append(text);
  item.append(inputField);

  list.appendChild(radio);
  list.appendChild(item);
}

function updateAllReminders() {
  if (!googleCalendar.isAuthenticated()) {
    allReminders = [];
    updateAllRemindersDOM();
    return;
  }

  document.querySelector(".info-overlay .refresh").disabled = true;
  
  allReminders = [];
  showElement(document.querySelector(".all-reminders-loading"));
  makeInvisible(document.querySelector(".all-reminders"));

  googleCalendar.getAllReminders()
    .then(events => {
      allReminders = events;
      updateAllRemindersDOM();
    })
    .catch(e => {
      if (e.status != 401) {
        AddToast("Could not get reminders", stringifyError(e), "error");
      }
      console.error(e);

      allReminders = [];
      updateAllRemindersDOM();
    })
    .finally(() => {
      hideElement(document.querySelector(".all-reminders-loading"));
      makeVisible(document.querySelector(".all-reminders"));
      document.querySelector(".info-overlay .refresh").disabled = false;
    });
}

function updateAllRemindersDOM() {
  const now = new Date();
  
  const list = document.querySelector(".all-reminders");
  removeAllChildren(list);

  for (const event of allReminders) {
    const item = document.createElement("div");
    item.classList.add("list-item");
    const date = new Date(event.start.date);
    const timeLeft = new Date(date - now);

    const expLabel = document.createElement("span");
    expLabel.textContent = formatGoogleDate(date);

    const timeLeftLabel = document.createElement("span");
    timeLeftLabel.textContent = formatDuration(timeLeft);

    item.addEventListener("click", () => {
      const url = getEventViewUrl(googleCalendar.calendarId, event);
      console.log(url);
      window.open(url, '_blank');
    });

    item.append(expLabel);
    item.append(timeLeftLabel);
    list.append(item);
  }

  if (allReminders.length === 0) {
    const item = document.createElement("span");

    if (googleCalendar.isAuthenticated()) {
      item.textContent = "No reminders found. Scan a data-matrix to create a reminder";
    }
    else {
      item.textContent = "Sign in to create reminders";
    }

    list.append(item);
  }
}