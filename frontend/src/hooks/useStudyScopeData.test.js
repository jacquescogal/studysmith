import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const reactMocks = vi.hoisted(() => ({
  useEffect: vi.fn((effect) => effect()),
  useState: vi.fn((initialValue) => {
    const state = { value: initialValue };
    const setter = vi.fn((nextValue) => {
      const resolvedValue =
        typeof nextValue === "function" ? nextValue(state.value) : nextValue;
      if (Array.isArray(state.value) && Array.isArray(resolvedValue)) {
        state.value.splice(0, state.value.length, ...resolvedValue);
        return;
      }
      state.value = resolvedValue;
    });
    return [initialValue, setter];
  })
}));

vi.mock("react", async () => ({
  ...(await vi.importActual("react")),
  useEffect: reactMocks.useEffect,
  useState: reactMocks.useState
}));

const apiMocks = vi.hoisted(() => ({
  getConcept: vi.fn(() => Promise.resolve({ label: "Stacks", description: "" })),
  getConceptStudySources: vi.fn(() =>
    Promise.resolve({ note_groups: [{ id: "note-b", study_cards: [] }] })
  ),
  getModule: vi.fn(),
  getModuleStudySources: vi.fn(() =>
    Promise.resolve({ note_groups: [{ id: "note-a", study_cards: [] }] })
  ),
  getNoteGroup: vi.fn(),
  listAllModules: vi.fn(),
  listConceptQuestionCards: vi.fn(() => Promise.resolve({ question_cards: [] })),
  listConceptStudyCards: vi.fn(() => Promise.resolve({ study_cards: [] })),
  listQuestionCards: vi.fn(() => Promise.resolve({ question_cards: [] })),
  listStudyCards: vi.fn(() => Promise.resolve({ study_cards: [] }))
}));

vi.mock("../api.js", () => apiMocks);

import {
  getConceptStudySources,
  getModuleStudySources,
  listConceptQuestionCards,
  listConceptStudyCards
} from "../api.js";
import { useStudyScopeData } from "./useStudyScopeData";

let lastHookResult;

function TestComponent(props) {
  lastHookResult = useStudyScopeData(props);
  return null;
}

describe("useStudyScopeData", () => {
  beforeEach(() => {
    globalThis.window = { setTimeout };
    lastHookResult = undefined;
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

  test("loads Module Study source payloads on Module Study pages", async () => {
    renderToStaticMarkup(
      React.createElement(TestComponent, {
        selectedModuleId: "module-1",
        isStudyPage: true,
        selectedModuleIdRef: { current: "module-1" },
        selectedSubjectIdRef: { current: "subject-1" },
        setSelectedSubjectId: vi.fn(),
        setSelectedModuleId: vi.fn(),
        setRouteRestoreError: vi.fn()
      })
    );

    expect(getModuleStudySources).toHaveBeenCalledWith("module-1");

    await Promise.resolve();

    expect(lastHookResult.studySourceNoteGroups).toEqual([
      { id: "note-a", study_cards: [] }
    ]);
  });

  test("loads Concept Study source payloads with descendant inclusion disabled", async () => {
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

    expect(getConceptStudySources).toHaveBeenCalledWith("concept-1", {
      includeDescendants: false
    });

    await Promise.resolve();

    expect(lastHookResult.studySourceNoteGroups).toEqual([
      { id: "note-b", study_cards: [] }
    ]);
  });
});
