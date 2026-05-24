import { describe, expect, test } from "vitest";

import { isAuthReadyForRouteRestore } from "./routeRestore";

describe("isAuthReadyForRouteRestore", () => {
  test("waits while Supabase restores the browser session", () => {
    expect(isAuthReadyForRouteRestore({ loading: true })).toBe(false);
  });

  test("allows route restore after auth loading settles", () => {
    expect(isAuthReadyForRouteRestore({ loading: false, isAuthenticated: true })).toBe(true);
    expect(isAuthReadyForRouteRestore({ loading: false, isAuthenticated: false })).toBe(true);
  });
});
