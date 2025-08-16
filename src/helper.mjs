export function stringifyError(e) {
  if (e instanceof Error) {
    return e.message ?? e.toString();
  }

  if (typeof e === "string") {
    return e;
  }

  if (typeof e === "object" && e.result) {
    return e.result.error.message;
  }

  return JSON.stringify(e);
}

/**
 * Convert 'yy' to 'yyyy'
 * @param {string} year 
 * @returns {string}
 */
export function getFullYear(year) {
  for (let current = 20; current < 99; current++) {
    const full = parseInt(`${current.toString()}${year}`);
    const actualYear = new Date().getFullYear();
    if (full >= actualYear) {
      return full.toString();
    }
  }

  return year;
}

/**
 * Reset CSS animation
 * @param {HTMLElement} element 
 */
export function replayAnimation(element) {
  element.style.animation = 'none';
  element.offsetHeight; /* trigger reflow */
  element.style.animation = null; 
}

/**
 * Hide element (display)
 * @param {HTMLElement} element 
 */
export function hideElement(element) {
  element.classList.add("hidden");
}

/**
 * Show element (display)
 * @param {HTMLElement} element 
 */
export function showElement(element) {
  element.classList.remove("hidden");
}

/**
 * Set element visibility (display)
 * @param {HTMLElement} element 
 */
export function setHidden(element, isHidden) {
  if (isHidden) {
    hideElement(element);
  }
  else {
    showElement(element);
  }
}

/**
 * Hide element (visibility)
 * @param {HTMLElement} element 
 */
export function makeInvisible(element) {
  element.classList.add("invisible");
}

/**
 * Show element (visibility)
 * @param {HTMLElement} element 
 */
export function makeVisible(element) {
  element.classList.remove("invisible");
}