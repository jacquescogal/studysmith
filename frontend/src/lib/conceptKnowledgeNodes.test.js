import { describe, expect, test } from "vitest";

import { resolveConceptKnowledgeNodeTarget } from "./conceptKnowledgeNodes";

describe("resolveConceptKnowledgeNodeTarget", () => {
  test("uses the selected Concept when a click event is passed instead of a Concept id", () => {
    expect(resolveConceptKnowledgeNodeTarget({ type: "click" }, "concept-selected")).toBe("concept-selected");
  });

  test("uses an explicit Concept id override when provided", () => {
    expect(resolveConceptKnowledgeNodeTarget("concept-from-node", "concept-selected")).toBe("concept-from-node");
  });
});
