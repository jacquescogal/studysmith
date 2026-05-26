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
  test("owns Tutor Chat state through the Tutor Chat hook", () => {
    renderToStaticMarkup(
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

    expect(useTutorChat).toHaveBeenCalledWith({
      moduleId: "module-1",
      noteGroupId: "",
      conceptId: "",
      isOpen: true
    });
  });
});
