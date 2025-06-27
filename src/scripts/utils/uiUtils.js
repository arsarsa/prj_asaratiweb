// src/utils/uiUtils.js
// Frontend

export function showElement(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("hidden");
}

export function hideElement(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("hidden");
}

export function showDisplay(id, displayStyle = "block") {
  const el = document.getElementById(id);
  if (el) el.style.display = displayStyle;
}

export function hideDisplay(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = "none";
}

export function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

export function showOnlyContainer(containers, containerToShow) {
  containers.forEach(container => {
    if (container === containerToShow) {
      container.classList.remove("hidden");
    } else {
      container.classList.add("hidden");
    }
  });
}
