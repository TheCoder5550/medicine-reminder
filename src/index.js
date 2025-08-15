import "../style.css";
import { BrowserDatamatrixCodeReader } from '@zxing/browser';
import { AddToast } from "./toast.mjs";
import { getFullYear, hideElement, showElement } from "./helper.mjs";
import { decodeMedicineData } from "./medicine-decoding.mjs";
import { GoogleCalendarHandler } from "./google-api.mjs";

const loginScreen = document.querySelector("#login-screen");
const tapToStart = document.querySelector("#tap-to-start");
const loader = document.querySelector("#loader");
const videoContainer = document.querySelector(".video-container");

const resultLabel = document.querySelector("#result");
const video = document.querySelector('video');
const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d", {
  willReadFrequently: true
});

canvas.width = 256;
canvas.height = 256;

const scale = 0.15;
const extraBrightness = 0;
const contrastFactor = 2;

const codeReader = new BrowserDatamatrixCodeReader();
let hasStarted = false;
let timeout = null;
let lastScanSN = null;

const googleCalendar = new GoogleCalendarHandler();
await googleCalendar.init();
googleCalendar.makeSignOutButton(document.querySelector("#signout_button"));
document.querySelector("#authorize_button").addEventListener("click", async () => {
  showElement(loader);

  await googleCalendar.authorize();

  hideElement(loginScreen);
  startScanner();
});
showElement(loginScreen);

async function startScanner() {
  if (hasStarted) {
    return;
  }
  hasStarted = true;

  const constraints = {
    audio: false,
    video: {
      facingMode: "environment"
    }
  };

  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  video.srcObject = stream;

  showElement(videoContainer);

  video.addEventListener("play", () => {
    hideElement(loader);
    renderFrame();
  });

  function renderFrame() {
    renderVideoToCanvas(video, canvas, ctx);
    scanCanvas();

    setTimeout(renderFrame, 100);
  }
}

function scanCanvas() {
  try {
    const result = codeReader.decodeFromCanvas(canvas);
    const resultText = result.getText();
    const data = decodeMedicineData(resultText);
    const expLabel = data.EXP.month + "/" + getFullYear(data.EXP.year);
    resultLabel.textContent = "EXP: " + expLabel + " - " + resultText;

    clearTimeout(timeout);
    timeout = setTimeout(() => {
      resultLabel.textContent = "";
    }, 5000);

    if (lastScanSN != null && lastScanSN === data.SN) {
      return;
    }
    lastScanSN = data.SN;

    googleCalendar.createReminder(data)
      .then(() => {
        AddToast("Reminder created", "Expires " + expLabel, "success", -1);
      })
      .catch(e => {
        AddToast("Error creating reminder!", e, "error", -1);
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