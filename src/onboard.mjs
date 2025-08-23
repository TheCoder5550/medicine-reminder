import { hideElement, showElement } from "./helper.mjs";

const SLIDE_TIME = 350;
const OLD_SLIDE_MOVE_PERCENTAGE = 0.25;

let slides = [];
const runningTimeouts = [];
let currentSlideIndex = null;

const callbacks = {
  "exitSlide": [],
  "showSlide": [],
  "end": [],
};

export const onboardEvents = {
  on: (eventName, callback) => {
    callbacks[eventName].push(callback);
  },
  off: (eventName, callback) => {
    const index = callbacks[eventName]?.indexOf(callback);
    if (index != null && index != -1) {
      callbacks[eventName].splice(index, 1)
    }
  }
}

async function triggerCallback(eventName, ...args) {
  for (const callback of callbacks[eventName]) {
    const promise = callback(...args);
    const result = promise && promise.then ?
      await promise.catch(e => {
        console.error(e);
        return false;
      }) :
      promise;

    if (result === false) {
      return false;
    }
  }

  return true;
}

async function onEnd(nextExists) {
  if (nextExists) {
    return;
  }

  return await triggerCallback("end");
}

export function setupOnboard() {
  const onboardContainer = document.querySelector("#onboard");
  if (!onboardContainer) {
    throw new Error("Onboard container not found");
  }
  
  slides = Array.from(onboardContainer.children);
  for (let i = slides.length - 1; i >= 0; i--) {
    const slide = slides[i];
    document.body.prepend(slide);
    hideElement(slide);
  }
  onboardContainer.remove();
}

export function getFirstSlide() {
  for (let i = 0; i < slides.length; i++) {
    if (isDisabled(i)) {
      continue;
    }

    return getSlide(i)?.slide;
  }

  return null;
}

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

export function setDisabledAll(disabled = true) {
  for (const slide of slides) {
    setDisabled(slide, disabled);
  }
}

export function setDisabled(ref, disabled = true) {
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

export async function showFirstSlideInstant() {
  return await showSlideInstant("first");
}

export async function showPrevSlide() {
  return await showSlideRelative("prev");
}

export async function showNextSlide() {
  const next = await showSlideRelative("next");
  onEnd(next);
  return next;
}

async function showSlideRelative(dir = "next") {
  return await showSlide(dir, dir === "next");
}

export async function showSlide(ref, forward = true) {
  const slides = await getPrevAndNextSlides(ref);
  if (!slides) {
    return false;
  }
  const prevSlide = slides.prev;
  const nextSlide = slides.next;

  clearTimeouts();

  if (forward) {
    if (nextSlide) {
      slideAbove(nextSlide.slide, forward);
    }

    if (prevSlide) {
      slideBelow(prevSlide.slide, forward, !nextSlide);
    }
  }
  else {
    if (nextSlide) {
      slideBelow(nextSlide.slide, forward);
    }

    if (prevSlide) {
      slideAbove(prevSlide.slide, forward);
    }
  }

  currentSlideIndex = nextSlide?.index ?? null;
  return true;
}

export async function showSlideInstant(ref) {
  const slides = await getPrevAndNextSlides(ref);
  if (!slides) {
    return false;
  }
  const prevSlide = slides.prev;
  const nextSlide = slides.next;

  clearTimeouts();

  if (prevSlide) {
    hideElement(prevSlide.slide);
  }

  if (nextSlide) {
    nextSlide.slide.style.zIndex = "20";
    nextSlide.slide.style.transition = "";
    nextSlide.slide.style.transform = "";
    showElement(nextSlide.slide);
  }

  currentSlideIndex = nextSlide?.index ?? null;
  return true;
}

function disableAllButtons(slideData) {
  if (!slideData || !slideData.slide) {
    return;
  }

  const buttonState = {};
  for (const button of slideData.slide.querySelectorAll("button")) {
    buttonState[button] = button.disabled;
    button.disabled = true;
  }

  return { slideData, buttonState };
}

function enableAllButtons(disableReturn) {
  if (!disableReturn || !disableReturn.slideData || !disableReturn.slideData.slide || !disableReturn.buttonState) {
    return;
  }

  for (const button of disableReturn.slideData.slide.querySelectorAll("button")) {
    button.disabled = disableReturn.buttonState[button] ?? true;
  }
}

async function getPrevAndNextSlides(nextRef) {
  const prevSlide = getSlide(currentSlideIndex);
  const bs = disableAllButtons(prevSlide);
  const exitResult = await triggerCallback("exitSlide", prevSlide?.slide ?? null);
  if (!exitResult) {
    enableAllButtons(bs);
    return;
  }

  let nextIndex = currentSlideIndex;
  let dir = 1;
  if (nextRef == "next") {
    nextIndex++;
    dir = 1;
  }
  else if (nextRef == "prev") {
    nextIndex--;
    dir = -1;
  }
  else if (nextRef == "first" && nextIndex == null) {
    nextIndex = 0;
    dir = 1;
  }
  else if (nextRef instanceof HTMLElement) {
    const index = slides.indexOf(nextRef);
    if (index === -1) {
      throw new Error("Invalid slide: Not added");
    }
    
    nextIndex = index;
    dir = 0;
  }
  else {
    throw new Error("Not supported: " + nextRef + " - " + nextIndex);
  }

  for (let i = nextIndex; i >= 0 && i < slides.length; i += dir) {
    if (isDisabled(i)) {
      if (dir === 0) {
        enableAllButtons(bs);
        return;
      }
      continue;
    }

    const answer = {
      cancel: false,
      skip: false,
      end: false,
    };
    const canContinue = await triggerCallback(
      "showSlide",
      getSlide(i).slide,
      prevSlide?.slide ?? null,
      {
        cancel: () => answer.cancel = true,
        skip: () => answer.skip = true,
        end: () => answer.end = true,
      }
    );
    if (answer.end) {
      break;
    }
    if (!canContinue || answer.cancel) {
      enableAllButtons(bs);
      return;
    }

    if (answer.skip || isDisabled(i)) {
      if (dir === 0) {
        enableAllButtons(bs);
        return;
      }
      continue;
    }

    enableAllButtons(bs);
    return { prev: prevSlide, next: getSlide(i) };
  }

  const answer = {
    cancel: false,
  };
  const canContinue = await triggerCallback(
    "showSlide",
    null,
    prevSlide?.slide ?? null,
    {
      cancel: () => answer.cancel = true,
      skip: () => {},
      end: () => {}
    }
  );
  if (!canContinue || answer.cancel) {
    enableAllButtons(bs);
    return;
  }

  enableAllButtons(bs);
  return { prev: prevSlide, next: null };
}

function slideBelow(slide, forward, isLast = false) {
  const from = forward ? "0%" : `-${OLD_SLIDE_MOVE_PERCENTAGE * 100}%`;
  let to = forward ? `-${OLD_SLIDE_MOVE_PERCENTAGE * 100}%` : "0%";

  if (forward && isLast) {
    to = "-100%";
  }

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

  if (ref == "first") {
    return getSlide(getFirstSlide());
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