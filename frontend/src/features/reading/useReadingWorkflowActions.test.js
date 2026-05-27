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

  test("opens a Study Card source range and scrolls to the active range", () => {
    const scrollIntoView = vi.fn();
    const querySelector = vi.fn(() => ({ scrollIntoView }));
    const setActiveSourceRangeIndex = vi.fn();
    const setReadingPinnedCardId = vi.fn();
    const originalWindow = globalThis.window;
    globalThis.window = immediateWindow();

    const actions = useReadingWorkflowActions({
      activeSourceRangeIndex: 0,
      readingContentRef: { current: { querySelector } },
      readingHoverCardId: "",
      readingMode: "study",
      readingPinnedCardId: "",
      setActiveSourceRangeIndex,
      setReadingHoverCardId: vi.fn(),
      setReadingMode: vi.fn(),
      setReadingPinnedCardId
    });

    actions.handleReadingViewInClean({ stopPropagation: vi.fn() }, "card-3", 1);

    expect(setReadingPinnedCardId).toHaveBeenCalledWith("card-3");
    expect(setActiveSourceRangeIndex).toHaveBeenCalledWith(1);
    expect(querySelector).toHaveBeenCalledWith(
      '[data-clean-card-id="card-3"][data-source-range-index="1"]'
    );
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
    globalThis.window = originalWindow;
  });

  test("wraps source range navigation and clears pinned source state", () => {
    const querySelector = vi.fn(() => ({ scrollIntoView: vi.fn() }));
    const setActiveSourceRangeIndex = vi.fn((next) =>
      typeof next === "function" ? next(2) : next
    );
    const setReadingPinnedCardId = vi.fn();
    const setReadingHoverCardId = vi.fn();
    const originalWindow = globalThis.window;
    globalThis.window = immediateWindow();

    const actions = useReadingWorkflowActions({
      activeSourceRangeIndex: 2,
      readingContentRef: { current: { querySelector } },
      readingHoverCardId: "",
      readingMode: "clean",
      readingPinnedCardId: "card-4",
      setActiveSourceRangeIndex,
      setReadingHoverCardId,
      setReadingMode: vi.fn(),
      setReadingPinnedCardId
    });

    actions.handleReadingSourceRangeNext(3);
    expect(setActiveSourceRangeIndex).toHaveBeenCalledWith(expect.any(Function));
    expect(querySelector).toHaveBeenCalledWith(
      '[data-clean-card-id="card-4"][data-source-range-index="0"]'
    );

    actions.handleReadingUnpin();
    expect(setReadingPinnedCardId).toHaveBeenCalledWith("");
    expect(setReadingHoverCardId).toHaveBeenCalledWith("");
    expect(setActiveSourceRangeIndex).toHaveBeenCalledWith(0);
    globalThis.window = originalWindow;
  });
});
