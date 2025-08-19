const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

/**
 * Format: Aug 2027
 * @param {Date} date 
 * @returns {string}
 */
export function formatGoogleDate(date) {
  const month = MONTH_NAMES[date.getMonth()];
  const year = date.getFullYear();
  return `${month} ${year}`;
}

/**
 * @param {Date} duration 
 * @returns {string}
 */
export function formatDuration(duration) {
  const millis = Math.abs(duration.valueOf());
  const years = Math.floor(millis / 1000 / 60 / 60 / 24 / 365);
  const months = Math.floor((millis / 1000 / 60 / 60 / 24 - years * 365) / 30.5);

  if (years == 0 && months == 0) {
    return "Soon";
  }

  let output = "";
  if (years !== 0) {
    output += years + "y";
    if (years != 1) {
      // output += "s";
    }
    output += " ";
  }
  if (months !== 0) {
    output += months + "mo";
    if (months != 1) {
      // output += "s";
    }
  }

  return output.trim();
}

/**
 * Check if website has been added to homescreen
 * @returns {boolean}
 */
export function isStandalone() {
  const ios = !!navigator.standalone;
  const css = matchMedia('(display-mode: standalone)').matches;

  return ios || css;
}

/**
 * Check if device can add apps to homescreen
 * @returns {boolean}
 */
export function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Extract error message from error objects
 * @param {any} e 
 * @returns {string}
 */
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
  const old = element.style.animation;
  element.style.animation = 'none';
  element.offsetHeight; /* trigger reflow */
  element.style.animation = old; 
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

/**
 * Remove all children from element
 * @param {HTMLElement} element 
 */
export function removeAllChildren(element) {
  element.replaceChildren();
}

/**
 * Create an icon
 * @param {string} name 
 * @param {string} className 
 * @param {string} elementType 
 * @returns {HTMLElement}
 */
export function createIcon(name, className = "material-symbols-outlined", elementType = "span") {
  const icon = document.createElement(elementType);
  icon.classList.add(className);
  icon.textContent = name;
  return icon;
}

/**
 * constrain x between a and b
 * @param {number} x 
 * @param {number} a 
 * @param {number} b 
 * @returns {number}
 */
export function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}