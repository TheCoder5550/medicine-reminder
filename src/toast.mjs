import { replayAnimation } from "./helper.mjs";

/**
 * @param {string} title 
 * @param {string} body 
 * @param {"info" | "error" | "success"} type 
 * @param {number} [lifetime=5000] 
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

  // Add title
  const titleSpan = document.createElement("span");
  titleSpan.classList.add("title");
  titleSpan.textContent = title;
  toast.append(titleSpan);

  // Add body (if provided)
  if (body) {
    const bodySpan = document.createElement("span");
    bodySpan.classList.add("body");
    bodySpan.textContent = body;
    toast.append(bodySpan);
  }

  // Add to DOM
  const toastContainer = document.querySelector("#toast-container");
  if (!toastContainer) {
    throw new Error("Add toast container to html");
  }
  toastContainer.insertBefore(toast, toastContainer.firstChild);

  // Remove from DOM
  if (lifetime !== -1) {
    setTimeout(removeThisToast, lifetime);
  }

  // Tap to remove toast
  toast.addEventListener("click", removeThisToast);

  function removeThisToast() {
    if (isRemoved) {
      return;
    }

    isRemoved = true;
    removeToast(toast);
  }
}

function removeToast(toast) {
  replayAnimation(toast);
  toast.style.animationDirection = "reverse";

  setTimeout(() => {
    toast.remove();
  }, 300);
}