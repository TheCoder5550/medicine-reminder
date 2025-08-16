import "../style.css";
import { BrowserDatamatrixCodeReader } from '@zxing/browser';
import { AddToast, editToast } from "./toast.mjs";
import { getFullYear, hideElement, showElement, stringifyError } from "./helper.mjs";
import { decodeMedicineData } from "./medicine-decoding.mjs";
import { GoogleCalendarHandler } from "./google-api.mjs";
import { showNextSlide, showPrevSlide, showSlideInstant } from "./onboard.mjs";

const welcomeScreen = document.querySelector("#welcome-screen");

const cameraRequestScreen = document.querySelector("#camera-request-screen");
const previewVideo = cameraRequestScreen.querySelector('.preview-video');
const requestCameraButton = cameraRequestScreen.querySelector(".request-button");

const loginScreen = document.querySelector("#login-screen");
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

const googleCalendar = new GoogleCalendarHandler();
await googleCalendar.init();

document.querySelector("#authorize_button").addEventListener("click", async () => {
  showElement(loaderScreen);

  googleCalendar.authorize()
    .then(() => {
      startScanner();
    })
    .catch(() => {
      hideElement(loaderScreen);
      showLoginSingle();
    })
});

hideElement(document.querySelector("#signout_button"));
document.querySelector("#signout_button").addEventListener("click", () => {
  googleCalendar.signOut();
});

console.log("Onboard?")

if (!localStorage.getItem("onboarding-done")) {
  showSlideInstant(0);
}
else {
  if (googleCalendar.hasAuthorizedBefore()) {
    document.querySelector("#authorize_button").click();
  }
  else {
    showLoginSingle();
  }
}

welcomeScreen.querySelector(".continue-button").addEventListener("click", () => {
  showNextSlide();
});
cameraRequestScreen.querySelector(".skip-button").addEventListener("click", () => {
  showNextSlide();
});
cameraRequestScreen.querySelector(".continue-button").addEventListener("click", () => {
  showNextSlide();
});
loginScreen.querySelector(".skip-button").addEventListener("click", () => {
  AddToast("No calendar", "No reminders will be created since no calendar has been connected", "error");
  onboardDone();
});

cameraRequestScreen.querySelector(".back-button").addEventListener("click", () => {
  showPrevSlide();
});
loginScreen.querySelector(".back-button").addEventListener("click", () => {
  showPrevSlide();
});

function onboardDone() {
  localStorage.setItem("onboarding-done", true);
  showSlideInstant(null);
  startScanner();
}

requestCameraButton.addEventListener("click", () => {
  requestCameraButton.disabled = true;

  navigator.permissions.query({name: 'camera'})
    .then(async function(result) {
      if (result.state == 'granted') {
        showPreview();
      }
      else if (result.state == 'prompt') {
        showPreview();
      }
      else if (result.state == 'denied') {
        showCameraError();
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
      .catch(showCameraError)
      .finally(() => {
        requestCameraButton.disabled = false;
      })
  }
});

// function showCameraRequestScreen() {
//   const show = () => {
//     showElement(cameraRequestScreen);
//     cameraRequestScreen.classList.add("slide-in");
//   }

//   if (!navigator.permissions || !navigator.permissions.query) {
//     show();
//     return;
//   }

//   navigator.permissions.query({name: 'camera'})
//     .then(async function(result) {
//       if (result.state == 'granted') {
//         cameraRequestScreen.querySelector(".skip-button").click();
//       }
//       else {
//         show();
//       }
//     })
//     .catch(showCameraError);
// }

function showLoginSingle() {
  showSlideInstant(loginScreen);
  hideElement(loginScreen.querySelector(".back-button"));
}

scannerScreen.addEventListener("click", () => {
  scale = scale === 0.15 ? 0.3 : 0.15;
  scannerScreen.querySelector(".scan-frame").style.width = `${scale * 100}%`;

  video.play();
})

video.addEventListener("play", () => {
  const videoContainer = scannerScreen.querySelector(".video-container");
  const aspect = video.videoWidth / video.videoHeight;
  videoContainer.style.aspect = aspect;
  videoContainer.style.width = `max(100vw, 100vh * ${aspect})`;

  clearTimeout(renderFrameTimeout);
  renderFrame();
});

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

  startCamera()
    .then(() => {
      renderFrame();

      hideElement(loaderScreen);
      showElement(scannerScreen);
    })
    .catch(e => {
      AddToast("Error", stringifyError(e), "error");
      showCameraError(e);
    });
}

async function startCamera() {
  if (hasStartedCamera) {
    return false;
  }
  hasStartedCamera = true;

  const constraints = {
    audio: false,
    video: {
      facingMode: "environment"
    }
  };

  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  previewVideo.srcObject = stream;
  video.srcObject = stream;
  video.onloadedmetadata = () => {
    video.play();
  };
  
  return true;
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
      .then(() => {
        const expLabel = data.EXP.month + "/" + getFullYear(data.EXP.year);
        editToast(toast, "Reminder created", "Expires " + expLabel, "success", 5000);
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
  // scale = scale == 0.15 ? 0.3 : 0.15;

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

function showCameraError(error) {
  const errorScreen = document.querySelector("#camera-error");
  errorScreen.querySelector(".error-label").textContent = stringifyError(error);
  showElement(errorScreen);

  hideElement(loaderScreen);
  hideElement(scannerScreen);
}