import { describe, expect, test, vi } from "vitest";

import { useReadingWorkflowActions } from "./useReadingWorkflowActions";

const immediateWindow = () => ({
  setTimeout: (callback) => callback()
});

describe("useReadingWorkflowActions", () => {
  test("switches reading mode and scrolls to the pinned card in clean text", () => {
    const scrollTo = vi.fn();
    const querySelector = vi.fn(() => ({
      getBoundingClientRect: () => ({ top: 420, height: 40 })
    }));
    const originalWindow = globalThis.window;
    globalThis.window = immediateWindow();

    const actions = useReadingWorkflowActions({
      readingContentRef: {
        current: {
          clientHeight: 300,
          scrollTop: 50,
          querySelector,
          getBoundingClientRect: () => ({ top: 120 }),
          scrollTo
        }
      },
      readingHoverCardId: "",
      readingMode: "study",
      readingPinnedCardId: "card-1",
      setReadingHoverCardId: vi.fn(),
      setReadingMode: vi.fn(),
      setReadingPinnedCardId: vi.fn()
    });

    actions.handleReadingModeChange("clean");

    expect(querySelector).toHaveBeenCalledWith('[data-clean-card-id="card-1"]');
    expect(scrollTo).toHaveBeenCalledWith({ top: 220, behavior: "smooth" });
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
    const scrollTo = vi.fn();
    const querySelector = vi.fn(() => ({
      getBoundingClientRect: () => ({ top: 420, height: 40 })
    }));
    const setActiveSourceRangeIndex = vi.fn();
    const setReadingPinnedCardId = vi.fn();
    const originalWindow = globalThis.window;
    globalThis.window = immediateWindow();

    const actions = useReadingWorkflowActions({
      activeSourceRangeIndex: 0,
      readingContentRef: {
        current: {
          clientHeight: 300,
          scrollTop: 50,
          querySelector,
          getBoundingClientRect: () => ({ top: 120 }),
          scrollTo
        }
      },
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
    expect(scrollTo).toHaveBeenCalledWith({ top: 220, behavior: "smooth" });
    globalThis.window = originalWindow;
  });

  test("scrolls source ranges inside the reading container without scrolling ancestors", () => {
    const scrollIntoView = vi.fn();
    const scrollTo = vi.fn();
    const target = {
      getBoundingClientRect: () => ({ top: 420, height: 40 }),
      scrollIntoView
    };
    const container = {
      clientHeight: 300,
      scrollTop: 50,
      querySelector: vi.fn(() => target),
      getBoundingClientRect: () => ({ top: 120 }),
      scrollTo
    };
    const originalWindow = globalThis.window;
    globalThis.window = immediateWindow();

    const actions = useReadingWorkflowActions({
      activeSourceRangeIndex: 0,
      readingContentRef: { current: container },
      readingHoverCardId: "",
      readingMode: "study",
      readingPinnedCardId: "",
      setActiveSourceRangeIndex: vi.fn(),
      setReadingHoverCardId: vi.fn(),
      setReadingMode: vi.fn(),
      setReadingPinnedCardId: vi.fn()
    });

    actions.handleReadingViewInClean({ stopPropagation: vi.fn() }, "card-3", 1);

    expect(scrollTo).toHaveBeenCalledWith({ top: 220, behavior: "smooth" });
    expect(scrollIntoView).not.toHaveBeenCalled();
    globalThis.window = originalWindow;
  });

  test("keeps source range navigation bounded and clears pinned source state", () => {
    const querySelector = vi.fn(() => ({ scrollIntoView: vi.fn() }));
    const resolvedActiveSourceRangeIndices = [];
    const setActiveSourceRangeIndex = vi.fn((next) =>
      resolvedActiveSourceRangeIndices.push(typeof next === "function" ? next(2) : next)
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
    expect(resolvedActiveSourceRangeIndices).toContain(2);
    expect(querySelector).not.toHaveBeenCalled();

    actions.handleReadingUnpin();
    expect(setReadingPinnedCardId).toHaveBeenCalledWith("");
    expect(setReadingHoverCardId).toHaveBeenCalledWith("");
    expect(setActiveSourceRangeIndex).toHaveBeenCalledWith(0);
    globalThis.window = originalWindow;
  });

  test("pins next and previous Study Cards by Derived Study Cards order", () => {
    const querySelector = vi.fn(() => ({ scrollIntoView: vi.fn() }));
    const setReadingPinnedCardId = vi.fn();
    const setReadingHoverCardId = vi.fn();
    const setActiveSourceRangeIndex = vi.fn();
    const originalWindow = globalThis.window;
    globalThis.window = immediateWindow();

    const actions = useReadingWorkflowActions({
      activeSourceRangeIndex: 0,
      readingContentRef: { current: { querySelector } },
      readingHoverCardId: "",
      readingMode: "clean",
      readingPinnedCardId: "card-2",
      studyNoteSections: [
        { study_card_id: "card-1" },
        { study_card_id: "card-2" },
        { study_card_id: "card-3" }
      ],
      setActiveSourceRangeIndex,
      setReadingHoverCardId,
      setReadingMode: vi.fn(),
      setReadingPinnedCardId
    });

    actions.handleReadingNextStudyCard();
    expect(setReadingPinnedCardId).toHaveBeenCalledWith("card-3");
    expect(setReadingHoverCardId).toHaveBeenCalledWith("card-3");
    expect(setActiveSourceRangeIndex).toHaveBeenCalledWith(0);
    expect(querySelector).toHaveBeenCalledWith(
      '[data-clean-card-id="card-3"][data-source-range-index="0"]'
    );

    actions.handleReadingPreviousStudyCard();
    expect(setReadingPinnedCardId).toHaveBeenCalledWith("card-1");
    expect(setReadingHoverCardId).toHaveBeenCalledWith("card-1");
    globalThis.window = originalWindow;
  });

  test("keeps adjacent Study Card pinning bounded at the ends", () => {
    const querySelector = vi.fn(() => ({ scrollIntoView: vi.fn() }));
    const setReadingPinnedCardId = vi.fn();
    const originalWindow = globalThis.window;
    globalThis.window = immediateWindow();

    const actions = useReadingWorkflowActions({
      activeSourceRangeIndex: 0,
      readingContentRef: { current: { querySelector } },
      readingHoverCardId: "",
      readingMode: "clean",
      readingPinnedCardId: "card-3",
      studyNoteSections: [
        { study_card_id: "card-1" },
        { study_card_id: "card-2" },
        { study_card_id: "card-3" }
      ],
      setActiveSourceRangeIndex: vi.fn(),
      setReadingHoverCardId: vi.fn(),
      setReadingMode: vi.fn(),
      setReadingPinnedCardId
    });

    actions.handleReadingNextStudyCard();
    expect(setReadingPinnedCardId).not.toHaveBeenCalled();
    expect(querySelector).not.toHaveBeenCalled();
    globalThis.window = originalWindow;
  });

  test("does not pin adjacent Study Cards when no Derived Study Cards are available", () => {
    const setReadingPinnedCardId = vi.fn();

    const actions = useReadingWorkflowActions({
      activeSourceRangeIndex: 0,
      readingContentRef: { current: { querySelector: vi.fn() } },
      readingHoverCardId: "",
      readingMode: "clean",
      readingPinnedCardId: "card-3",
      studyNoteSections: [],
      setActiveSourceRangeIndex: vi.fn(),
      setReadingHoverCardId: vi.fn(),
      setReadingMode: vi.fn(),
      setReadingPinnedCardId
    });

    actions.handleReadingNextStudyCard();
    actions.handleReadingPreviousStudyCard();
    expect(setReadingPinnedCardId).not.toHaveBeenCalled();
  });
});
