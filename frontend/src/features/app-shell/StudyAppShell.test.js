import { describe, expect, test } from "vitest";

import { canUseProtectedAppActions } from "./appAuthGate";

describe("canUseProtectedAppActions", () => {
  test("blocks protected app actions until an authenticated profile has a username", () => {
    const auth = { isAuthenticated: true, user: { id: "user-1" } };

    expect(canUseProtectedAppActions(auth, null)).toBe(false);
    expect(canUseProtectedAppActions(auth, { supabase_user_id: "user-1", username: "" })).toBe(false);
    expect(canUseProtectedAppActions(auth, { supabase_user_id: "user-1", username: null })).toBe(false);
    expect(canUseProtectedAppActions(auth, { supabase_user_id: "user-1", username: "ReaderOne" })).toBe(true);
  });

  test("blocks protected app actions when the hydrated profile belongs to another session", () => {
    expect(
      canUseProtectedAppActions(
        { isAuthenticated: true, user: { id: "user-2" } },
        { id: "local-user-1", supabase_user_id: "user-1", username: "ReaderOne" }
      )
    ).toBe(false);
  });

  test("blocks protected app actions when auth has no session user id", () => {
    expect(
      canUseProtectedAppActions(
        { isAuthenticated: true, user: null },
        { supabase_user_id: "user-1", username: "ReaderOne" }
      )
    ).toBe(false);
  });

  test("blocks protected app actions for guests even when profile-like data is present", () => {
    expect(
      canUseProtectedAppActions({ isAuthenticated: false }, { username: "ReaderOne" })
    ).toBe(false);
  });
});
