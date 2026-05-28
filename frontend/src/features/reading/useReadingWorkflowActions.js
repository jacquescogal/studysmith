export function useReadingWorkflowActions({
  activeSourceRangeIndex = 0,
  readingContentRef,
  readingHoverCardId,
  readingMode,
  readingPinnedCardId,
  studyNoteSections = [],
  visibleStudyCardOrder = [],
  setActiveSourceRangeIndex = () => {},
  setReadingHoverCardId,
  setReadingMode,
  setReadingPinnedCardId
}) {
  const orderedStudyCards = visibleStudyCardOrder.length
    ? visibleStudyCardOrder.filter((item) => item.id)
    : studyNoteSections
        .map((section) => ({
          id: section.study_card_id,
          noteGroupId: section.note_group_id || section.source_note_group_id || ""
        }))
        .filter((item) => item.id);
  const orderedStudyCardIds = orderedStudyCards.map((item) => item.id);

  const scrollTargetIntoReadingContainer = (target, block = "start") => {
    const container = readingContentRef.current;
    if (!container || !target) {
      return;
    }
    if (typeof container.getBoundingClientRect !== "function" || typeof target.getBoundingClientRect !== "function") {
      return;
    }
    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const blockOffset =
      block === "center" ? (container.clientHeight - targetRect.height) / 2 : 0;
    const top = Math.max(0, container.scrollTop + targetRect.top - containerRect.top - blockOffset);

    if (typeof container.scrollTo === "function") {
      container.scrollTo({ top, behavior: "smooth" });
      return;
    }
    container.scrollTop = top;
  };

  const jumpToStudyCard = (studyCardId) => {
    const container = readingContentRef.current;
    if (!container || !studyCardId) {
      return;
    }
    const target = container.querySelector(`#reading-study-${studyCardId}`);
    if (target) {
      scrollTargetIntoReadingContainer(target, "start");
    }
  };

  const jumpToCleanSource = (studyCardId, rangeIndex = null) => {
    const container = readingContentRef.current;
    if (!container || !studyCardId) {
      return;
    }
    const target =
      Number.isInteger(rangeIndex)
        ? container.querySelector(
            `[data-clean-card-id="${studyCardId}"][data-source-range-index="${rangeIndex}"]`
          ) || container.querySelector(`[data-clean-card-id="${studyCardId}"]`)
        : container.querySelector(`[data-clean-card-id="${studyCardId}"]`);
    if (target) {
      scrollTargetIntoReadingContainer(target, "center");
    }
  };

  const scrollToCleanSourceRange = (studyCardId, rangeIndex) => {
    window.setTimeout(() => jumpToCleanSource(studyCardId, rangeIndex), 0);
  };

  const handleReadingModeChange = (nextMode) => {
    setReadingMode(nextMode);
    const targetCardId = readingPinnedCardId || readingHoverCardId;
    if (!targetCardId) {
      return;
    }
    window.setTimeout(() => {
      if (nextMode === "clean") {
        jumpToCleanSource(targetCardId);
      } else {
        jumpToStudyCard(targetCardId);
      }
    }, 0);
  };

  const handleReadingTitleClick = (studyCardId) => {
    setReadingHoverCardId(studyCardId);
    setReadingPinnedCardId((current) => (current === studyCardId ? "" : studyCardId));
    window.setTimeout(() => {
      if (readingMode === "clean") {
        jumpToCleanSource(studyCardId);
      } else {
        jumpToStudyCard(studyCardId);
      }
    }, 0);
  };

  const handleReadingToggleMode = (event, studyCardId) => {
    event.stopPropagation();
    const nextMode = readingMode === "study" ? "clean" : "study";
    setReadingMode(nextMode);
    setReadingHoverCardId(studyCardId);
    window.setTimeout(() => {
      if (nextMode === "clean") {
        jumpToCleanSource(studyCardId);
      } else {
        jumpToStudyCard(studyCardId);
      }
    }, 0);
  };

  const handleReadingViewInClean = (event, studyCardId, rangeIndex = 0) => {
    event.stopPropagation();
    setReadingMode("clean");
    setReadingHoverCardId(studyCardId);
    setReadingPinnedCardId(studyCardId);
    setActiveSourceRangeIndex(rangeIndex);
    scrollToCleanSourceRange(studyCardId, rangeIndex);
  };

  const handleReadingSourceRangeNext = (rangeCount) => {
    if (!readingPinnedCardId || rangeCount < 1) {
      return;
    }
    setActiveSourceRangeIndex((current) => {
      const next = Math.min(current + 1, rangeCount - 1);
      if (next === current) {
        return current;
      }
      scrollToCleanSourceRange(readingPinnedCardId, next);
      return next;
    });
  };

  const handleReadingSourceRangePrevious = (rangeCount) => {
    if (!readingPinnedCardId || rangeCount < 1) {
      return;
    }
    setActiveSourceRangeIndex((current) => {
      const next = Math.max(current - 1, 0);
      if (next === current) {
        return current;
      }
      scrollToCleanSourceRange(readingPinnedCardId, next);
      return next;
    });
  };

  const getAdjacentStudyCardId = (direction) => {
    if (!orderedStudyCardIds.length) {
      return "";
    }
    const currentIndex = orderedStudyCardIds.indexOf(readingPinnedCardId);
    if (currentIndex < 0) {
      return "";
    }
    const nextIndex = direction === "previous" ? currentIndex - 1 : currentIndex + 1;
    return orderedStudyCardIds[nextIndex] || "";
  };

  const pinAdjacentStudyCard = (direction) => {
    const nextStudyCardId = getAdjacentStudyCardId(direction);
    if (!nextStudyCardId) {
      return;
    }
    setReadingPinnedCardId(nextStudyCardId);
    setReadingHoverCardId(nextStudyCardId);
    setActiveSourceRangeIndex(0);
    scrollToCleanSourceRange(nextStudyCardId, 0);
  };

  const handleReadingNextStudyCard = () => {
    pinAdjacentStudyCard("next");
  };

  const handleReadingPreviousStudyCard = () => {
    pinAdjacentStudyCard("previous");
  };

  const handleReadingUnpin = () => {
    setReadingPinnedCardId("");
    setReadingHoverCardId("");
    setActiveSourceRangeIndex(0);
  };

  const handleScrollNavToCard = (studyCardId) => {
    const navEl = document.getElementById(`reading-nav-${studyCardId}`);
    if (navEl) {
      navEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };

  return {
    handleReadingModeChange,
    handleReadingNextStudyCard,
    handleReadingPreviousStudyCard,
    handleReadingSourceRangeNext,
    handleReadingSourceRangePrevious,
    handleReadingTitleClick,
    handleReadingToggleMode,
    handleReadingUnpin,
    handleReadingViewInClean,
    handleScrollNavToCard
  };
}
