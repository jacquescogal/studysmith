import { describe, expect, test } from "vitest";

import {
  isAuthReadyForRouteRestore,
  shouldBlockForRouteRestore,
  shouldClearSelectedSubject
} from "./routeRestore";

describe("isAuthReadyForRouteRestore", () => {
  test("waits while Supabase restores the browser session", () => {
    expect(isAuthReadyForRouteRestore({ loading: true })).toBe(false);
  });

  test("allows route restore after auth loading settles", () => {
    expect(isAuthReadyForRouteRestore({ loading: false, isAuthenticated: true })).toBe(true);
    expect(isAuthReadyForRouteRestore({ loading: false, isAuthenticated: false })).toBe(true);
  });
});

describe("shouldBlockForRouteRestore", () => {
  test("blocks app route rendering while auth is restoring", () => {
    expect(
      shouldBlockForRouteRestore({
        hasAppRouteTarget: true,
        authLoading: true,
        resolvedRouteMatches: false,
        hasUnresolvedRouteTarget: true,
        routeRestoreError: ""
      })
    ).toBe(true);
  });

  test("blocks app route rendering until the URL context is resolved", () => {
    expect(
      shouldBlockForRouteRestore({
        hasAppRouteTarget: true,
        authLoading: false,
        resolvedRouteMatches: false,
        hasUnresolvedRouteTarget: true,
        routeRestoreError: ""
      })
    ).toBe(true);
  });

  test("does not block the landing page or restored routes", () => {
    expect(
      shouldBlockForRouteRestore({
        hasAppRouteTarget: false,
        authLoading: false,
        resolvedRouteMatches: false,
        hasUnresolvedRouteTarget: false,
        routeRestoreError: ""
      })
    ).toBe(false);

    expect(
      shouldBlockForRouteRestore({
        hasAppRouteTarget: true,
        authLoading: false,
        resolvedRouteMatches: true,
        hasUnresolvedRouteTarget: false,
        routeRestoreError: ""
      })
    ).toBe(false);
  });

  test("stops blocking when route restore fails so the error panel can render", () => {
    expect(
      shouldBlockForRouteRestore({
        hasAppRouteTarget: true,
        authLoading: false,
        resolvedRouteMatches: false,
        hasUnresolvedRouteTarget: true,
        routeRestoreError: "Unable to restore page"
      })
    ).toBe(false);
  });
});

describe("shouldClearSelectedSubject", () => {
  test("does not clear a route-restored subject before the subject list catches up", () => {
    expect(
      shouldClearSelectedSubject({
        selectedSubjectId: "subject-1",
        subjects: [],
        hasAppRouteTarget: true,
        routeSubjectId: "subject-1"
      })
    ).toBe(false);
  });

  test("clears a selected subject that is no longer in the loaded subject list", () => {
    expect(
      shouldClearSelectedSubject({
        selectedSubjectId: "subject-1",
        subjects: [{ id: "subject-2" }],
        hasAppRouteTarget: false,
        routeSubjectId: ""
      })
    ).toBe(true);
  });

  test("keeps empty or listed selections", () => {
    expect(
      shouldClearSelectedSubject({
        selectedSubjectId: "",
        subjects: [],
        hasAppRouteTarget: false,
        routeSubjectId: ""
      })
    ).toBe(false);

    expect(
      shouldClearSelectedSubject({
        selectedSubjectId: "subject-1",
        subjects: [{ id: "subject-1" }],
        hasAppRouteTarget: false,
        routeSubjectId: ""
      })
    ).toBe(false);
  });
});
