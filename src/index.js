import "../style.css";
import { BrowserDatamatrixCodeReader } from '@zxing/browser';

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

/**
 * 
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