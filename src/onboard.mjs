import { hideElement, showElement } from "./helper.mjs";

const SLIDE_TIME = 350;
const OLD_SLIDE_MOVE_PERCENTAGE = 0.25;

const onboardContainer = document.querySelector("#onboard");
if (!onboardContainer) {
  throw new Error("Onboard container not found");
}

const slides = Array.from(onboardContainer.children);
for (let i = slides.length - 1; i >= 0; i--) {
  const slide = slides[i];
  document.body.prepend(slide);
  hideElement(slide);
}
onboardContainer.remove();

const runningTimeouts = [];
let currentSlideIndex = null;

export function getActiveSlide() {
  const slideData = getSlide(currentSlideIndex);
  if (slideData == null) {
    return null;
  }

  return slideData.slide;
}

export function getAllSlides() {
  return slides;
}

export function setDisabled(ref, disabled) {
  const slideData = getSlide(ref);
  if (!slideData) {
    throw new Error("Slide is null");
  }

  const slide = slideData.slide;
  if (disabled) {
    slide.setAttribute("disabled", "");
  }
  else {
    slide.removeAttribute("disabled");
  }
}

export function showFirstSlideInstant() {
  for (let i = 0; i < slides.length; i++) {
    if (isDisabled(i)) {
      continue;
    }

    showSlideInstant(i);
    return true;
  }

  return false;
}

export function showPrevSlide() {
  return showSlideRelative(-1);
}

export function showNextSlide() {
  return showSlideRelative(1);
}

function showSlideRelative(inc = 1) {
  if (currentSlideIndex == null) {
    return false;
  }

  const nextIndex = currentSlideIndex + inc;

  if (nextIndex >= slides.length || nextIndex < 0) {
    return false;
  }

  const slideData = getSlide(nextIndex);
  if (slideData && slideData.slide && isDisabled(slideData.slide)) {
    const skipInc = inc + Math.sign(inc);
    if (skipInc == inc) {
      return true;
    }

    return showSlideRelative(skipInc);
  }

  showSlide(nextIndex, inc > 0);
  return true;
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
    slideData.slide.style.zIndex = "20";
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

function isDisabled(ref) {
  const slideData = getSlide(ref);
  if (!slideData) {
    throw new Error("Slide is null");
  }

  return slideData.slide.hasAttribute("disabled");
}