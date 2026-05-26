import { describe, expect, test } from "vitest";

import { getReviewCardType, getReviewScopeForContext } from "./useReviewSession";

describe("getReviewScopeForContext", () => {
  test("selects Concept review scope when a Concept is active", () => {
    expect(getReviewScopeForContext({ conceptId: "concept-1" })).toBe("topic");
  });

  test("defaults to Note Group review scope", () => {
    expect(getReviewScopeForContext({ conceptId: "" })).toBe("note-group");
  });
});

describe("getReviewCardType", () => {
  test("treats multi-answer MCQ cards as multi select", () => {
    expect(
      getReviewCardType({
        type: "mcq",
        reviewCorrectIndices: [0, 2]
      })
    ).toBe("multi_select");
  });
});
