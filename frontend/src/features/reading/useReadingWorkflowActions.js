export function useReadingWorkflowActions({
  activeSourceRangeIndex = 0,
  readingContentRef,
  readingHoverCardId,
  readingMode,
  readingPinnedCardId,
  studyNoteSections = [],
  setActiveSourceRangeIndex = () => {},
  setReadingHoverCardId,
  setReadingMode,
  setReadingPinnedCardId
}) {
  const jumpToStudyCard = (studyCardId) => {
    const container = readingContentRef.current;
    if (!container || !studyCardId) {
      return;
    }
    const target = container.querySelector(`#reading-study-${studyCardId}`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
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
      target.scrollIntoView({ behavior: "smooth", block: "center" });
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
      const next = (current + 1) % rangeCount;
      scrollToCleanSourceRange(readingPinnedCardId, next);
      return next;
    });
  };

  const handleReadingSourceRangePrevious = (rangeCount) => {
    if (!readingPinnedCardId || rangeCount < 1) {
      return;
    }
    setActiveSourceRangeIndex((current) => {
      const next = (current - 1 + rangeCount) % rangeCount;
      scrollToCleanSourceRange(readingPinnedCardId, next);
      return next;
    });
  };

  const getAdjacentStudyCardId = (direction) => {
    const orderedIds = studyNoteSections
      .map((section) => section.study_card_id)
      .filter(Boolean);
    if (!orderedIds.length) {
      return "";
    }
    const currentIndex = orderedIds.indexOf(readingPinnedCardId);
    const baseIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex =
      direction === "previous"
        ? (baseIndex - 1 + orderedIds.length) % orderedIds.length
        : (baseIndex + 1) % orderedIds.length;
    return orderedIds[nextIndex];
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
