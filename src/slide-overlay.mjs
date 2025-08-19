import { clamp } from "./helper.mjs";

export function createSlideOverlays() {
  document.querySelectorAll(".info-overlay").forEach(createOverlay);
}

function createOverlay(overlay) {
  const snapPositions = [
    0.1,
    0.6,
    0.9,
  ];
  let firstMove = false;
  let firstTouch = null;
  let lastOffset = null;
  let velocity = 0;

  snapPositions.sort();
  const topSnap = snapPositions[0];
  const nextTopSnap = snapPositions[1] ?? topSnap;
  const bottomSnap = snapPositions.at(-1);

  const touchStart = e => {
    const touch = e.touches?.[0] ?? e;
    firstTouch = touch;

    const br = overlay.getBoundingClientRect();
    const percent = br.y / innerHeight;
    firstTouch.top = percent;

    velocity = 0;
    lastOffset = null;
    firstMove = true;

    overlay.style.transition = "";
  }

  const touchMove = e => {
    if (!firstTouch) {
      return;
    }

    const touch = e.touches ?
      Array.from(e.touches).find(t => t.identifier === firstTouch.identifier) :
      e;
    if (!touch) {
      return;
    }

    const offsetY = touch.pageY - firstTouch.pageY;
    let top = firstTouch.top + offsetY / innerHeight;
    top = Math.max(top, topSnap);

    if (firstMove) {
      firstMove = false;

      const scrolledElement = getScrollContainer(touch.target);
      if (scrolledElement && e.touches) {
        const scrollPercent = Math.abs(scrolledElement.scrollHeight - scrolledElement.clientHeight) < 0.001 ?
          0 :
          scrolledElement.scrollTop / (scrolledElement.scrollHeight - scrolledElement.clientHeight);

        const br = overlay.getBoundingClientRect();
        const percent = br.y / innerHeight;

        if (percent < nextTopSnap * 0.9 && overlay.contains(scrolledElement) && ((offsetY > 0 && scrollPercent > 0.01) || (offsetY < 0 && scrollPercent < 0.99))) {
          firstTouch = null;
          return;
        }
      }
    }

    if (lastOffset != null) {
      velocity = top - lastOffset;
    }
    lastOffset = top;

    overlay.style.top = `${top * 100}%`;
    overlay.querySelector(".body").style.opacity = "";

    e.preventDefault();
  }

  const touchEnd = () => {
    if (!firstTouch) {
      return;
    }

    const br = overlay.getBoundingClientRect();
    const percent = br.y / innerHeight + velocity * 8;

    const closestSnap = snapPositions
      .slice()
      .sort((a, b) => Math.abs(a - percent) - Math.abs(b - percent))
      .at(0);

    firstTouch = null;
    overlay.style.transition = "top 150ms";
    overlay.style.top = `${closestSnap * 100}%`;

    if (closestSnap == bottomSnap) {
      overlay.querySelector(".body").style.opacity = "0";
    }
  }

  overlay.addEventListener("touchstart", touchStart, { passive: true });
  overlay.addEventListener("touchmove", touchMove, { passive: false });
  overlay.addEventListener("touchend", touchEnd);

  overlay.addEventListener("mousedown", touchStart);
  window.addEventListener("mousemove", touchMove);
  window.addEventListener("mouseup", touchEnd);

  const resizeObserver = new ResizeObserver(() => {
    const br = overlay.getBoundingClientRect();
    const percent = br.y / innerHeight;
    document.querySelector(".video-container").style.transform = `translateY(${-clamp(1 - percent - (1 - bottomSnap), 0, 1 - nextTopSnap) / 2 * 100}%)`;
  });

  resizeObserver.observe(overlay);
}

/**
 * Get first scrollable parent
 * @param {HTMLElement} element
 * @returns {HTMLElement}
 */
function getScrollContainer(element) {
  while (element && element !== document && !isScrollable(element)) {
    element = element.parentElement;
  }
  return element;
}

/**
 * Check if element can be scrolled
 * @param {HTMLElement} element 
 * @returns {boolean}
 */
function isScrollable(element) {
  return (
    element.scrollWidth > element.clientWidth ||
    element.scrollHeight > element.clientHeight
  );
}