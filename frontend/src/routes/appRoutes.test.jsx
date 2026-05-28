import { matchRoutes } from "react-router-dom";
import { describe, expect, test } from "vitest";

import { createAppRouteObjects } from "./appRoutes";

const routeIdsFor = (pathname) =>
  (matchRoutes(createAppRouteObjects(), pathname) || []).map((match) => match.route.id);

const leafRouteIdFor = (pathname) => routeIdsFor(pathname).at(-1);

const findRouteById = (routes, id) => {
  for (const route of routes) {
    if (route.id === id) {
      return route;
    }
    const childMatch = route.children ? findRouteById(route.children, id) : null;
    if (childMatch) {
      return childMatch;
    }
  }
  return null;
};

describe("app route tree", () => {
  test.each([
    ["/", "subject-index"],
    ["/app/subject/S1", "subject-modules"],
    ["/app/subject/S1/module/M1", "module-default-mind-map"],
    ["/app/subject/S1/module/M1/mind-map", "module-mind-map"],
    ["/app/subject/S1/module/M1/view-cards", "module-view-cards"],
    ["/app/subject/S1/module/M1/study", "module-study"],
    ["/app/subject/S1/module/M1/create-note-group", "note-group-create"],
    [
      "/app/subject/S1/module/M1/note-groups/N1",
      "note-group-default-mind-map"
    ],
    [
      "/app/subject/S1/module/M1/note-groups/N1/mind-map",
      "note-group-mind-map"
    ],
    [
      "/app/subject/S1/module/M1/note-groups/N1/view-cards",
      "note-group-view-cards"
    ],
    [
      "/app/subject/S1/module/M1/note-groups/N1/study",
      "note-group-study"
    ],
    [
      "/app/subject/S1/module/M1/note-groups/N1/study-cards",
      "note-group-study-cards"
    ],
    [
      "/app/subject/S1/module/M1/note-groups/N1/question-cards",
      "note-group-question-cards"
    ],
    [
      "/app/subject/S1/module/M1/concepts/C1",
      "concept-default-mind-map"
    ],
    [
      "/app/subject/S1/module/M1/concepts/C1/mind-map",
      "concept-mind-map"
    ],
    [
      "/app/subject/S1/module/M1/concepts/C1/view-cards",
      "concept-view-cards"
    ],
    [
      "/app/subject/S1/module/M1/concepts/C1/study",
      "concept-study"
    ],
    [
      "/app/subject/S1/module/M1/concepts/C1/study-cards",
      "concept-study-cards"
    ],
    [
      "/app/subject/S1/module/M1/concepts/C1/question-cards",
      "concept-question-cards"
    ]
  ])("matches %s to %s", (pathname, expectedRouteId) => {
    expect(leafRouteIdFor(pathname)).toBe(expectedRouteId);
  });

  test("keeps legacy topic routes compatible during Concept terminology migration", () => {
    expect(leafRouteIdFor("/app/subject/S1/module/M1/topics/T1/study-cards")).toBe(
      "concept-study-cards"
    );
  });

  test("does not expose Overview route ids for scope defaults", () => {
    expect(findRouteById(createAppRouteObjects(), "module-overview")).toBeNull();
    expect(findRouteById(createAppRouteObjects(), "note-group-overview")).toBeNull();
    expect(findRouteById(createAppRouteObjects(), "concept-overview")).toBeNull();
  });

  test("uses nested layout route boundaries for module and note group pages", () => {
    expect(routeIdsFor("/app/subject/S1/module/M1/note-groups/N1/view-cards")).toEqual([
      "app-root",
      "subject-layout",
      "module-layout",
      "note-group-layout",
      "note-group-view-cards"
    ]);
  });

  test("mounts the app shell renderer at the Module layout boundary", () => {
    const renderAppShell = () => null;
    const moduleRoute = findRouteById(createAppRouteObjects(renderAppShell), "module-layout");

    expect(moduleRoute?.element.props.renderAppShell).toBe(renderAppShell);
  });
});
