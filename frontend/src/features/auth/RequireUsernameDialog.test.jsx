import { describe, expect, test } from "vitest";

import {
  getRequireUsernameDialogError,
  getRequireUsernameSignOutLabel
} from "./RequireUsernameDialog";

describe("RequireUsernameDialog", () => {
  test("surfaces sign-out failures inside the blocking username dialog", () => {
    expect(getRequireUsernameDialogError("", "Failed to sign out")).toBe("Failed to sign out");
  });

  test("disables sign out while sign-out is submitting", () => {
    expect(getRequireUsernameSignOutLabel(true)).toBe("Signing out...");
  });
});
