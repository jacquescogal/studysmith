import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vitest";

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
  getConceptMindMap: vi.fn(() => Promise.resolve({ nodes: [], edges: [] })),
  getConceptQuestionTimeline: vi.fn(() => Promise.resolve({ timeline: {} }))
}));

vi.mock("@/api", () => apiMocks);

import { getConceptQuestionTimeline } from "@/api";
import { useConceptPageData } from "./useConceptPageData";

function TestComponent(props) {
  useConceptPageData(props);
  return null;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("useConceptPageData", () => {
  test("loads Concept question timeline with descendant Concept inclusion disabled", () => {
    renderToStaticMarkup(
      React.createElement(TestComponent, {
        conceptId: "concept-1",
        includeDescendantStudyCards: false
      })
    );

    expect(getConceptQuestionTimeline).toHaveBeenCalledWith("concept-1", {
      includeDescendants: false
    });
  });
});
