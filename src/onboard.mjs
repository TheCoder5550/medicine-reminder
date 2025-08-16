import { hideElement, showElement } from "./helper.mjs";

const SLIDE_TIME = 350;
const OLD_SLIDE_MOVE_PERCENTAGE = 0.25;

const welcomeScreen = document.querySelector("#welcome-screen");
const cameraRequestScreen = document.querySelector("#camera-request-screen");
const loginScreen = document.querySelector("#login-screen");

const slides = [
  welcomeScreen,
  cameraRequestScreen,
  loginScreen
];

for (const slide of slides) {
  if (!slide) {
    throw new Error("Slide not found");
  }

  hideElement(slide);
}

const runningTimeouts = [];
let currentSlideIndex = null;

export function showPrevSlide() {
  if (currentSlideIndex == null) {
    return;
  }

  if (currentSlideIndex - 1 < 0) {
    return;
  }

  showSlide(currentSlideIndex - 1, false);
}

export function showNextSlide() {
  if (currentSlideIndex == null) {
    return;
  }

  if (currentSlideIndex + 1 >= slides.length) {
    return;
  }

  showSlide(currentSlideIndex + 1, true);
}

export function showSlide(ref, forward = true) {
  clearTimeouts();

  const slideData = getSlide(ref);

  if (forward) {
    if (slideData) {
      slideAbove(slideData.slide, forward);
    }

    if (currentSlideIndex != null) {
      const oldSlide = slides[currentSlideIndex];
      slideBelow(oldSlide, forward);
    }
  }
  else {
    if (slideData) {
      slideBelow(slideData.slide, forward);
    }

    if (currentSlideIndex != null) {
      const oldSlide = slides[currentSlideIndex];
      slideAbove(oldSlide, forward);
    }
  }

  currentSlideIndex = slideData?.index;
}

export function showSlideInstant(ref) {
  clearTimeouts();

  if (currentSlideIndex != null) {
    const oldSlide = slides[currentSlideIndex];
    hideElement(oldSlide);
  }

  const slideData = getSlide(ref);
  if (slideData != null) {
    showElement(slideData.slide);
  }

  currentSlideIndex = slideData?.index;
}

function slideBelow(slide, forward) {
  const from = forward ? "0%" : `-${OLD_SLIDE_MOVE_PERCENTAGE * 100}%`;
  const to = forward ? `-${OLD_SLIDE_MOVE_PERCENTAGE * 100}%` : "0%";

  slide.style.transition = "";
  slide.style.transform = `translateX(${from})`;
  slide.style.zIndex = "10";
  showElement(slide);

  slide.offsetHeight;

  slide.style.transition = `transform ${SLIDE_TIME}ms`;
  slide.style.transform = `translateX(${to})`;

  if (forward) {
    const timeout = setTimeout(() => {
      hideElement(slide);
    }, SLIDE_TIME);
    runningTimeouts.push(timeout);
  }
}

function slideAbove(slide, forward) {
  const from = forward ? "100%" : "0%";
  const to = forward ? "0%" : "100%";

  slide.style.transition = "";
  slide.style.transform = `translateX(${from})`;
  slide.style.zIndex = "20";
  showElement(slide);

  slide.offsetHeight;

  slide.style.transition = `transform ${SLIDE_TIME}ms`;
  slide.style.transform = `translateX(${to})`;

  if (!forward) {
    const timeout = setTimeout(() => {
      hideElement(slide);
    }, SLIDE_TIME);
    runningTimeouts.push(timeout);
  }
}

function clearTimeouts() {
  for (const timeout of runningTimeouts) {
    clearTimeout(timeout);
  }
  runningTimeouts.length = 0;
}

function getSlide(ref) {
  if (ref == null) {
    return null;
  }

  if (ref instanceof HTMLElement) {
    const index = slides.indexOf(ref);
    if (index === -1) {
      throw new Error("Invalid slide: Not added");
    }
    
    return getSlide(index);
  }

  if (typeof ref === "number") {
    const slide = slides[ref];
    if (!slide) {
      throw new Error("Invalid slide: Invalid index");
    }

    return {
      index: ref,
      slide
    };
  }

  throw new Error("Invalid slide: Unknown")
}