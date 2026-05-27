import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

import { useTutorChat } from "@/features/chat/useTutorChat";
import { StudyAppTutorChatOverlay } from "./StudyAppTutorChatOverlay";

vi.mock("@/features/chat/useTutorChat", () => ({
  useTutorChat: vi.fn(() => ({
    messages: [{ role: "assistant", content: "Tutor answer", refs: [] }],
    input: "What is next?",
    setInput: vi.fn(),
    error: "",
    loading: false,
    view: "chat",
    cardId: "",
    cardCache: {},
    cardLoading: false,
    cardError: "",
    listRef: { current: null },
    sendMessage: vi.fn(),
    openStudyCard: vi.fn(),
    backToChat: vi.fn(),
    handleKeyDown: vi.fn()
  }))
}));

describe("StudyAppTutorChatOverlay", () => {
  test.each([
    ["Module", { selectedNoteGroupId: "", selectedTopicId: "" }, { noteGroupId: "", conceptId: "" }],
    [
      "Note Group",
      { selectedNoteGroupId: "note-group-1", selectedTopicId: "" },
      { noteGroupId: "note-group-1", conceptId: "" }
    ],
    [
      "Concept",
      { selectedNoteGroupId: "", selectedTopicId: "concept-1" },
      { noteGroupId: "", conceptId: "concept-1" }
    ]
  ])("opens Tutor Chat from the floating bubble for %s scope", (_scope, scopeProps, expectedScope) => {
    const setIsChatOpen = vi.fn();
    const element = StudyAppTutorChatOverlay({
      model: {
        canUseProtectedActions: true,
        isChatOpen: false,
        resolveNoteGroupLabel: () => "Cell membranes",
        selectedModuleId: "module-1",
        setIsChatOpen,
        ...scopeProps
      }
    });
    const bubble = element.props.children[0];

    bubble.props.onClick();

    expect(setIsChatOpen).toHaveBeenCalledWith(true);
    expect(useTutorChat).toHaveBeenLastCalledWith({
      moduleId: "module-1",
      noteGroupId: expectedScope.noteGroupId,
      conceptId: expectedScope.conceptId,
      isOpen: false
    });
  });

  test("owns Tutor Chat state through the Tutor Chat hook", () => {
    const html = renderToStaticMarkup(
      <StudyAppTutorChatOverlay
        model={{
          canUseProtectedActions: true,
          isChatOpen: true,
          resolveNoteGroupLabel: () => "",
          selectedModuleId: "module-1",
          selectedNoteGroupId: "",
          selectedTopicId: "",
          setIsChatOpen: vi.fn()
        }}
      />
    );

    expect(html).toContain("floating-chat-bubble");
    expect(html).toContain("Tutor Chat");
    expect(useTutorChat).toHaveBeenCalledWith({
      moduleId: "module-1",
      noteGroupId: "",
      conceptId: "",
      isOpen: true
    });
  });
});
