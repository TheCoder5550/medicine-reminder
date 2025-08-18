import { createIcon, hideElement, replayAnimation, setHidden } from "./helper.mjs";

const MAX_TOASTS = 5;

const toastContainer = document.querySelector("#toast-container");
if (!toastContainer) {
  throw new Error("Add toast container to html");
}

/**
 * @param {string} title 
 * @param {string} body 
 * @param {"info" | "buffer" | "error" | "success"} type 
 * @param {number} [lifetime=5000] 
 * @returns {HTMLElement}
 */
export function AddToast(title, body, type = "info", lifetime = 5000) {
  let isRemoved = false;
  const toast = document.createElement("div");

  // Style based on type
  toast.classList.add("toast");
  if (type === "error") {
    toast.classList.add("error");
  }
  else if (type === "success") {
    toast.classList.add("success");
  }
  else if (type === "buffer") {
    toast.classList.add("buffer");
  }

  // Add title
  const titleSpan = document.createElement("span");
  titleSpan.classList.add("title");
  titleSpan.textContent = title;
  toast.append(titleSpan);
  if (!title) {
    hideElement(titleSpan);
  }

  // Add body
  const bodySpan = document.createElement("span");
  bodySpan.classList.add("body");
  bodySpan.textContent = body;
  toast.append(bodySpan);
  if (!body) {
    hideElement(bodySpan);
  }

  // Add close button
  const closeButton = document.createElement("button");
  closeButton.classList.add("icon-button", "secondary-button", "close-button");
  closeButton.append(createIcon("close"));
  closeButton.addEventListener("click", () => {
    removeThisToast();
  })
  toast.append(closeButton);

  // Add to DOM
  toastContainer.insertBefore(toast, toastContainer.firstChild);
  
  // Remove old toasts if too many
  if (toastContainer.children.length > MAX_TOASTS) {
    toastContainer.lastChild.remove();
  }

  // Remove from DOM
  let timeout = null;
  if (lifetime !== -1) {
    timeout = setTimeout(removeThisToast, lifetime);
  }

  toast.addEventListener("touchstart", () => {
    clearTimeout(timeout);
  });
  toast.addEventListener("touchend", () => {
    if (lifetime !== -1) {
      timeout = setTimeout(removeThisToast, lifetime);
    }
  });

  function removeThisToast() {
    if (isRemoved) {
      return;
    }

    isRemoved = true;
    removeToast(toast);
  }

  return toast;
}

/**
 * @param {HTMLElement} toast 
 * @param {string | undefined} title 
 * @param {string | undefined} body 
 * @param {string | undefined} type 
 */
export function editToast(toast, title, body, type, lifetime = -1) {
  if (title != undefined) {
    const titleSpan = toast.querySelector(".title");
    titleSpan.textContent = title;
    setHidden(titleSpan, !title);
  }

  if (body != undefined) {
    const bodySpan = toast.querySelector(".body");
    bodySpan.textContent = body;
    setHidden(bodySpan, !body);
  }

  if (type != undefined) {
    toast.classList.remove("error");
    toast.classList.remove("success");
    toast.classList.remove("buffer");

    if (type === "error") {
      toast.classList.add("error");
    }
    else if (type === "success") {
      toast.classList.add("success");
    }
    else if (type === "buffer") {
      toast.classList.add("buffer");
    }
  }

  if (lifetime !== -1) {
    setTimeout(() => {
      removeToast(toast);
    }, lifetime);
  }
}

function removeToast(toast) {
  toast.isRemoved = true;
  toast.style.animation = "";
  replayAnimation(toast);
  toast.style.animationFillMode = "both";
  toast.style.animationDirection = "reverse";

  setTimeout(() => {
    const refIndex = Array.from(toastContainer.children).indexOf(toast);
    toast.remove();

    for (let i = 0; i < toastContainer.children.length; i++) {
      const otherToast = toastContainer.children[i];
      if (otherToast == toast || i < refIndex || otherToast.isRemoved) {
        continue;
      }

      otherToast.style.animation = "slide-down 400ms";
      replayAnimation(otherToast);
    }
  }, 400);
}