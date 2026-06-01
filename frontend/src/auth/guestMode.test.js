import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { clearGuestMode, isGuestModeEnabled, setGuestMode } from "./guestMode";

let store;

beforeEach(() => {
  store = new Map();
  globalThis.localStorage = {
    clear() {
      store.clear();
    },
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    removeItem(key) {
      store.delete(key);
    },
    setItem(key, value) {
      store.set(key, String(value));
    }
  };
});

afterEach(() => {
  delete globalThis.localStorage;
});

describe("guest mode persistence", () => {
  test("is disabled when the guest mode key is absent", () => {
    expect(isGuestModeEnabled()).toBe(false);
  });

  test("stores true when guest mode is enabled", () => {
    setGuestMode(true);

    expect(localStorage.getItem("studysmith.guestMode")).toBe("true");
    expect(isGuestModeEnabled()).toBe(true);
  });

  test("removes the guest mode key when disabled", () => {
    localStorage.setItem("studysmith.guestMode", "true");

    setGuestMode(false);

    expect(localStorage.getItem("studysmith.guestMode")).toBeNull();
    expect(isGuestModeEnabled()).toBe(false);
  });

  test("clear removes persisted guest mode", () => {
    setGuestMode(true);

    clearGuestMode();

    expect(localStorage.getItem("studysmith.guestMode")).toBeNull();
    expect(isGuestModeEnabled()).toBe(false);
  });

  test("returns false when reading localStorage throws", () => {
    localStorage.getItem = () => {
      throw new Error("storage unavailable");
    };

    expect(isGuestModeEnabled()).toBe(false);
  });

  test("does not throw when enabling guest mode cannot write to localStorage", () => {
    localStorage.setItem = () => {
      throw new Error("storage unavailable");
    };

    expect(() => setGuestMode(true)).not.toThrow();
  });

  test("does not throw when disabling guest mode cannot remove from localStorage", () => {
    localStorage.removeItem = () => {
      throw new Error("storage unavailable");
    };

    expect(() => setGuestMode(false)).not.toThrow();
  });

  test("does not throw when clearing guest mode cannot remove from localStorage", () => {
    localStorage.removeItem = () => {
      throw new Error("storage unavailable");
    };

    expect(() => clearGuestMode()).not.toThrow();
  });
});
