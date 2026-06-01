const GUEST_MODE_KEY = "studysmith.guestMode";

export function isGuestModeEnabled() {
  try {
    return localStorage.getItem(GUEST_MODE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setGuestMode(enabled) {
  try {
    if (enabled) {
      localStorage.setItem(GUEST_MODE_KEY, "true");
      return;
    }
    localStorage.removeItem(GUEST_MODE_KEY);
  } catch {
    // Storage can be unavailable in private browsing, SSR, or restricted contexts.
  }
}

export function clearGuestMode() {
  try {
    localStorage.removeItem(GUEST_MODE_KEY);
  } catch {
    // Storage can be unavailable in private browsing, SSR, or restricted contexts.
  }
}
