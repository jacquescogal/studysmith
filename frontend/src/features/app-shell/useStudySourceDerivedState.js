import { useCallback, useMemo } from "react";

export function useStudySourceDerivedState({
  activeSourceRangeIndex,
  cleanedTextMarkdown,
  filteredStudyCards,
  formattedSections,
  isInlineStudyPage,
  isStudyPage,
  moduleNoteGroupsForDisplay,
  moduleNoteGroupStatsById,
  noteGroups,
  readingHoverCardId,
  readingPinnedCardId,
  selectedModuleId,
  selectedNoteGroupId,
  selectedTopicId,
  studyCards,
  studySourceNoteGroups
}) {
  const scopedSourceContent = useMemo(() => {
    let text = "";
    const sections = [];
    const rangesByCardId = new Map();

    studySourceNoteGroups.forEach((group, groupIndex) => {
      const groupText = group.cleaned_text_markdown || "";
      if (text && groupText) {
        text += "\n\n";
      }
      const groupTextOffset = text.length;
      text += groupText;

      const noteGroupTitle = group.title || `Note Group ${groupIndex + 1}`;
      const formattedSourceSections = Array.isArray(group.formatted_sections)
        ? group.formatted_sections
        : [];
      const sourceCards = Array.isArray(group.study_cards) ? group.study_cards : [];
      const sourceCardIds = new Set(sourceCards.map((card) => card.id));
      const scopedFormattedSections = sourceCardIds.size
        ? formattedSourceSections.filter((section) => sourceCardIds.has(section.study_card_id))
        : formattedSourceSections;

      if (scopedFormattedSections.length) {
        scopedFormattedSections.forEach((section, sectionIndex) => {
          sections.push({
            ...section,
            source_note_group_id: group.id,
            source_note_group_title: noteGroupTitle,
            anchor:
              section.anchor ||
              `source-${group.id}-${section.study_card_id || sectionIndex + 1}`
          });
        });
      } else {
        sourceCards.forEach((card, cardIndex) => {
          sections.push({
            study_card_id: card.id,
            title: card.front || card.title || `Study card ${cardIndex + 1}`,
            content: card.back || card.content || "",
            anchor: `source-${group.id}-${card.id}`,
            source_note_group_id: group.id,
            source_note_group_title: noteGroupTitle
          });
        });
      }

      sourceCards.forEach((card) => {
        const sourceRanges = Array.isArray(card.source_ranges) ? card.source_ranges : [];
        rangesByCardId.set(
          card.id,
          sourceRanges.map((range) => ({
            ...range,
            start_index: range.start_index + groupTextOffset,
            end_index: range.end_index + groupTextOffset
          }))
        );
      });
    });

    return { text, sections, rangesByCardId };
  }, [studySourceNoteGroups]);

  const fallbackCleanText = useMemo(() => {
    let text = "";
    const rangesByCardId = new Map();
    studyCards.forEach((card, index) => {
      const title = card.title || `Study card ${index + 1}`;
      const block = `## ${title}\n\n${card.content || ""}`.trim();
      if (text) {
        text += "\n\n";
      }
      const startIndex = text.length;
      text += block;
      rangesByCardId.set(card.id, [{ start_index: startIndex, end_index: text.length }]);
    });
    return { text, rangesByCardId };
  }, [studyCards]);

  const shouldUseScopedSourceContent =
    (isStudyPage || isInlineStudyPage) &&
    (Boolean(selectedTopicId) || Boolean(selectedModuleId && !selectedNoteGroupId));
  const effectiveCleanedText = shouldUseScopedSourceContent
    ? scopedSourceContent.text
    : cleanedTextMarkdown || fallbackCleanText.text;

  const studyNoteSections = useMemo(() => {
    if (shouldUseScopedSourceContent) {
      return scopedSourceContent.sections;
    }
    if (formattedSections.length) {
      return formattedSections;
    }
    return studyCards.map((card, index) => ({
      study_card_id: card.id,
      title: card.title || `Study card ${index + 1}`,
      content: card.content || "",
      anchor: `study-card-${card.id}`
    }));
  }, [formattedSections, scopedSourceContent.sections, shouldUseScopedSourceContent, studyCards]);

  const sourceRangesByCardId = useMemo(() => {
    if (shouldUseScopedSourceContent) {
      return scopedSourceContent.rangesByCardId;
    }
    if (!cleanedTextMarkdown) {
      return fallbackCleanText.rangesByCardId;
    }
    const map = new Map();
    studyCards.forEach((card) => {
      map.set(card.id, Array.isArray(card.source_ranges) ? card.source_ranges : []);
    });
    return map;
  }, [
    cleanedTextMarkdown,
    fallbackCleanText,
    scopedSourceContent.rangesByCardId,
    shouldUseScopedSourceContent,
    studyCards
  ]);

  const getValidSourceRanges = useCallback((studyCardId) => {
    const ranges = sourceRangesByCardId.get(studyCardId) || [];
    return ranges.filter(
      (range) =>
        Number.isInteger(range.start_index) &&
        Number.isInteger(range.end_index) &&
        range.end_index > range.start_index
    );
  }, [sourceRangesByCardId]);

  const pinnedSourceRanges = useMemo(
    () => getValidSourceRanges(readingPinnedCardId),
    [getValidSourceRanges, readingPinnedCardId]
  );

  const pinnedStudyCard = useMemo(
    () => studyCards.find((card) => card.id === readingPinnedCardId) || null,
    [readingPinnedCardId, studyCards]
  );

  const readingHighlights = useMemo(() => {
    const highlights = [];
    const addRanges = (studyCardId, kind, activeIndex = -1) => {
      if (!studyCardId) {
        return;
      }
      const ranges = getValidSourceRanges(studyCardId);
      ranges.forEach((range, index) => {
        highlights.push({
          ...range,
          study_card_id: studyCardId,
          kind: activeIndex === index ? "active" : kind,
          range_index: index
        });
      });
    };
    addRanges(readingHoverCardId, "hovered");
    addRanges(readingPinnedCardId, "related", activeSourceRangeIndex);
    return highlights;
  }, [activeSourceRangeIndex, getValidSourceRanges, readingHoverCardId, readingPinnedCardId]);

  const resolveNoteGroupLabel = useCallback((noteGroupId) => {
    if (!noteGroupId) {
      return "";
    }
    const statsEntry = moduleNoteGroupStatsById.get(noteGroupId);
    if (statsEntry) {
      return statsEntry.title;
    }
    const group = noteGroups.find((item) => item.id === noteGroupId);
    return group?.title || noteGroupId.slice(0, 8);
  }, [moduleNoteGroupStatsById, noteGroups]);

  const studyNoteGroups = useMemo(() => {
    const sourceGroupsById = new Map(
      (studySourceNoteGroups || []).map((group) => [group.id, group])
    );
    const orderIndexByNoteGroupId = new Map(
      moduleNoteGroupsForDisplay.map((group, index) => [group.id, index])
    );
    const cardsByGroup = new Map();

    filteredStudyCards.forEach((card) => {
      const groupId = card.note_group_id || selectedNoteGroupId || "";
      if (!groupId) {
        return;
      }
      if (!cardsByGroup.has(groupId)) {
        cardsByGroup.set(groupId, []);
      }
      if (!cardsByGroup.get(groupId).some((item) => item.id === card.id)) {
        cardsByGroup.get(groupId).push(card);
      }
    });

    const groupedCards = Array.from(cardsByGroup.entries())
      .map(([groupId, cards]) => {
        const sourceGroup = sourceGroupsById.get(groupId);
        return {
          id: groupId,
          title: sourceGroup?.title || resolveNoteGroupLabel(groupId) || "Untitled Note Group",
          orderIndex: orderIndexByNoteGroupId.get(groupId) ?? Number.POSITIVE_INFINITY,
          studyCards: cards
        };
      })
      .sort((a, b) => a.orderIndex - b.orderIndex || a.title.localeCompare(b.title));

    if (groupedCards.length || !studySourceNoteGroups.length) {
      return groupedCards;
    }

    return studySourceNoteGroups
      .map((group, index) => ({
        id: group.id,
        title: group.title || resolveNoteGroupLabel(group.id) || "Untitled Note Group",
        orderIndex: orderIndexByNoteGroupId.get(group.id) ?? index,
        studyCards: (Array.isArray(group.study_cards) ? group.study_cards : []).map((card) => ({
          ...card,
          title: card.title || card.front || "Untitled Study Card",
          content: card.content || card.back || "",
          note_group_id: card.note_group_id || group.id
        }))
      }))
      .filter((group) => group.studyCards.length)
      .sort((a, b) => a.orderIndex - b.orderIndex || a.title.localeCompare(b.title));
  }, [
    filteredStudyCards,
    moduleNoteGroupsForDisplay,
    resolveNoteGroupLabel,
    selectedNoteGroupId,
    studySourceNoteGroups
  ]);

  const visibleStudyCardOrder = useMemo(
    () =>
      studyNoteGroups.flatMap((group) =>
        group.studyCards.map((card) => ({ id: card.id, noteGroupId: group.id }))
      ),
    [studyNoteGroups]
  );

  const readingAvailable =
    studyNoteSections.length > 0 ||
    studyNoteGroups.some((group) => group.studyCards?.length) ||
    Boolean(effectiveCleanedText);

  return {
    effectiveCleanedText,
    getValidSourceRanges,
    pinnedSourceRanges,
    pinnedStudyCard,
    readingAvailable,
    readingHighlights,
    resolveNoteGroupLabel,
    sourceRangesByCardId,
    studyNoteGroups,
    studyNoteSections,
    visibleStudyCardOrder
  };
}
