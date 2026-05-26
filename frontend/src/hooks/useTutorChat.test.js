import { describe, expect, test } from "vitest";

import { buildTutorChatRequest } from "./useTutorChat";

describe("buildTutorChatRequest", () => {
  test("includes Module and Note Group context with recent chat history", () => {
    const request = buildTutorChatRequest({
      moduleId: "module-1",
      noteGroupId: "note-1",
      message: "Explain this",
      messages: [
        { role: "assistant", content: "older" },
        { role: "user", content: "" },
        { role: "user", content: "recent" }
      ]
    });

    expect(request).toEqual({
      module_id: "module-1",
      note_group_id: "note-1",
      concept_id: null,
      message: "Explain this",
      history: [
        { role: "assistant", content: "older" },
        { role: "user", content: "recent" }
      ]
    });
  });

  test("uses null Note Group context for Module-level chat", () => {
    expect(
      buildTutorChatRequest({
        moduleId: "module-1",
        message: "What should I study?",
        messages: []
      }).note_group_id
    ).toBeNull();
  });

  test("uses Concept context instead of Note Group context when present", () => {
    expect(
      buildTutorChatRequest({
        moduleId: "module-1",
        noteGroupId: "note-1",
        conceptId: "concept-1",
        message: "Explain this concept",
        messages: []
      })
    ).toEqual({
      module_id: "module-1",
      note_group_id: null,
      concept_id: "concept-1",
      message: "Explain this concept",
      history: []
    });
  });
});
