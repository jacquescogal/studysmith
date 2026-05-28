import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const reactMocks = vi.hoisted(() => ({
  useEffect: vi.fn((effect) => effect()),
  useState: vi.fn((initialValue) => [initialValue, vi.fn()])
}));

vi.mock("react", async () => ({
  ...(await vi.importActual("react")),
  useEffect: reactMocks.useEffect,
  useState: reactMocks.useState
}));

const apiMocks = vi.hoisted(() => ({
  getConcept: vi.fn(() => Promise.resolve({ label: "Stacks", description: "" })),
  getModule: vi.fn(),
  getNoteGroup: vi.fn(),
  listAllModules: vi.fn(),
  listConceptQuestionCards: vi.fn(() => Promise.resolve({ question_cards: [] })),
  listConceptStudyCards: vi.fn(() => Promise.resolve({ study_cards: [] })),
  listQuestionCards: vi.fn(),
  listStudyCards: vi.fn()
}));

vi.mock("../api.js", () => apiMocks);

import { listConceptQuestionCards, listConceptStudyCards } from "../api.js";
import { useStudyScopeData } from "./useStudyScopeData";

function TestComponent(props) {
  useStudyScopeData(props);
  return null;
}

describe("useStudyScopeData", () => {
  beforeEach(() => {
    globalThis.window = { setTimeout };
  });

  afterEach(() => {
    delete globalThis.window;
    vi.clearAllMocks();
  });

  test("loads Concept cards with descendant Concept inclusion disabled", () => {
    renderToStaticMarkup(
      React.createElement(TestComponent, {
        selectedConceptId: "concept-1",
        includeDescendantStudyCards: false,
        selectedModuleIdRef: { current: "module-1" },
        selectedSubjectIdRef: { current: "subject-1" },
        setSelectedSubjectId: vi.fn(),
        setSelectedModuleId: vi.fn(),
        setRouteRestoreError: vi.fn()
      })
    );

    expect(listConceptStudyCards).toHaveBeenCalledWith("concept-1", {
      includeDescendants: false
    });
    expect(listConceptQuestionCards).toHaveBeenCalledWith("concept-1", {
      includeDescendants: false
    });
  });
});
