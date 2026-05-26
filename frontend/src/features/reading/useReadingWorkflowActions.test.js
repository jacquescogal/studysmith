import { describe, expect, test, vi } from "vitest";

import { useReadingWorkflowActions } from "./useReadingWorkflowActions";

const immediateWindow = () => ({
  setTimeout: (callback) => callback()
});

describe("useReadingWorkflowActions", () => {
  test("switches reading mode and scrolls to the pinned card in clean text", () => {
    const scrollIntoView = vi.fn();
    const querySelector = vi.fn(() => ({ scrollIntoView }));
    const originalWindow = globalThis.window;
    globalThis.window = immediateWindow();

    const actions = useReadingWorkflowActions({
      readingContentRef: { current: { querySelector } },
      readingHoverCardId: "",
      readingMode: "study",
      readingPinnedCardId: "card-1",
      setReadingHoverCardId: vi.fn(),
      setReadingMode: vi.fn(),
      setReadingPinnedCardId: vi.fn()
    });

    actions.handleReadingModeChange("clean");

    expect(querySelector).toHaveBeenCalledWith('[data-clean-card-id="card-1"]');
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
    globalThis.window = originalWindow;
  });

  test("pins a clicked Study Card and scrolls the current reading mode", () => {
    const setReadingPinnedCardId = vi.fn();
    const querySelector = vi.fn(() => ({ scrollIntoView: vi.fn() }));
    const originalWindow = globalThis.window;
    globalThis.window = immediateWindow();

    const actions = useReadingWorkflowActions({
      readingContentRef: { current: { querySelector } },
      readingHoverCardId: "",
      readingMode: "study",
      readingPinnedCardId: "",
      setReadingHoverCardId: vi.fn(),
      setReadingMode: vi.fn(),
      setReadingPinnedCardId
    });

    actions.handleReadingTitleClick("card-2");

    expect(setReadingPinnedCardId).toHaveBeenCalledWith(expect.any(Function));
    expect(querySelector).toHaveBeenCalledWith("#reading-study-card-2");
    globalThis.window = originalWindow;
  });
});
