import { useEffect, useState } from "react";

import {
  getConcept,
  getConceptStudySources,
  getModule,
  getModuleStudySources,
  getNoteGroup,
  listAllModules,
  listConceptQuestionCards,
  listConceptStudyCards,
  listQuestionCards,
  listStudyCards
} from "@/api";

const withRouteRestoreTimeout = (promise, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error(`${label} timed out`)), 8000);
    })
  ]);

const resolveModuleForRouteRestore = async (moduleId) => {
  try {
    return await withRouteRestoreTimeout(getModule(moduleId), "Module restore");
  } catch (error) {
    const modules = await withRouteRestoreTimeout(listAllModules(), "Module list restore");
    const module = modules.find((item) => item.id === moduleId);
    if (!module) {
      throw error;
    }
    return module;
  }
};

export function useStudyScopeData({
  selectedModuleId = "",
  selectedNoteGroupId = "",
  selectedConceptId = "",
  isStudyPage = false,
  includeDescendantStudyCards = true,
  routeNoteGroupId = "",
  routeConceptId = "",
  shouldHoldContent = false,
  selectedModuleIdRef,
  selectedSubjectIdRef,
  setSelectedSubjectId,
  setSelectedModuleId,
  setRouteRestoreError
} = {}) {
  const [studyCards, setStudyCards] = useState([]);
  const [studySourceNoteGroups, setStudySourceNoteGroups] = useState([]);
  const [studyCardError, setStudyCardError] = useState("");
  const [questionCards, setQuestionCards] = useState([]);
  const [questionCardError, setQuestionCardError] = useState("");
  const [questionJobStatus, setQuestionJobStatus] = useState("idle");
  const [noteGroupConceptIds, setNoteGroupConceptIds] = useState([]);
  const [metadataTitleDraft, setMetadataTitleDraft] = useState("");
  const [formattedSections, setFormattedSections] = useState([]);
  const [cleanedTextMarkdown, setCleanedTextMarkdown] = useState("");
  const [conceptTitleDraft, setConceptTitleDraft] = useState("");
  const [conceptDescriptionDraft, setConceptDescriptionDraft] = useState("");

  useEffect(() => {
    const canLoadModuleStudySources = Boolean(selectedModuleId && isStudyPage);

    if (!selectedNoteGroupId && !selectedConceptId && !canLoadModuleStudySources) {
      setStudyCards([]);
      setStudySourceNoteGroups([]);
      setQuestionCards([]);
      setNoteGroupConceptIds([]);
      setMetadataTitleDraft("");
      setConceptTitleDraft("");
      setConceptDescriptionDraft("");
      setFormattedSections([]);
      setCleanedTextMarkdown("");
      return undefined;
    }

    if (shouldHoldContent) {
      setStudyCards([]);
      setStudySourceNoteGroups([]);
      setQuestionCards([]);
      setNoteGroupConceptIds([]);
      setMetadataTitleDraft("");
      setFormattedSections([]);
      setCleanedTextMarkdown("");
      setStudyCardError("");
      setQuestionCardError("");
      setQuestionJobStatus("idle");
      return undefined;
    }

    setStudyCardError("");
    setQuestionCardError("");
    setQuestionJobStatus("idle");
    let cancelled = false;
    const conceptOptions = { includeDescendants: includeDescendantStudyCards };
    const noteGroupRequest =
      selectedNoteGroupId && !selectedConceptId
        ? withRouteRestoreTimeout(getNoteGroup(selectedNoteGroupId), "Note group restore")
        : null;

    const loadScope = async () => {
      try {
        if (selectedConceptId) {
          const concept = await withRouteRestoreTimeout(
            getConcept(selectedConceptId),
            "Concept restore"
          );
          if (cancelled) {
            return;
          }
          setConceptTitleDraft(concept.label || "");
          setConceptDescriptionDraft(concept.description || "");
          setFormattedSections([]);
          setCleanedTextMarkdown("");
          setNoteGroupConceptIds([]);
          return;
        }

        const data = await noteGroupRequest;
        if (cancelled) {
          return;
        }
        setNoteGroupConceptIds((data.topic_chips || []).map((chip) => chip.id));
        setMetadataTitleDraft(data.title || "");
        setFormattedSections(data.formatted_sections || []);
        setCleanedTextMarkdown(data.cleaned_text_markdown || "");

        if (data.subject_id && data.module_id) {
          setSelectedSubjectId(data.subject_id);
          setSelectedModuleId(data.module_id);
          setRouteRestoreError("");
          return;
        }

        if (
          data.module_id &&
          (selectedModuleIdRef?.current !== data.module_id || !selectedSubjectIdRef?.current)
        ) {
          const module = await resolveModuleForRouteRestore(data.module_id);
          if (cancelled) {
            return;
          }
          setSelectedSubjectId(module.subject_id);
          setSelectedModuleId(module.id);
          setRouteRestoreError("");
        }
      } catch (error) {
        if (!cancelled) {
          if (routeNoteGroupId === selectedNoteGroupId) {
            setRouteRestoreError(error.message || "Unable to restore note group page");
          } else if (routeConceptId === selectedConceptId) {
            setRouteRestoreError(error.message || "Unable to restore concept page");
          }
          setStudyCardError(error.message);
        }
      }
    };

    if (selectedNoteGroupId || selectedConceptId) {
      loadScope();
    }

    const studyRequest = selectedConceptId
      ? listConceptStudyCards(selectedConceptId, conceptOptions)
      : selectedNoteGroupId
        ? listStudyCards(selectedNoteGroupId)
        : Promise.resolve({ study_cards: [] });
    studyRequest
      .then((data) => {
        if (!cancelled) {
          setStudyCards(data.study_cards || []);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setStudyCardError(error.message);
        }
      });

    const sourceRequest = isStudyPage
      ? selectedConceptId
        ? getConceptStudySources(selectedConceptId, conceptOptions)
        : selectedNoteGroupId
          ? noteGroupRequest.then((group) => ({
              note_groups: [
                {
                  id: group.id,
                  title: group.title,
                  sort_order: group.sort_order,
                  cleaned_text_markdown: group.cleaned_text_markdown || "",
                  formatted_sections: group.formatted_sections || [],
                  study_cards: []
                }
              ]
            }))
          : canLoadModuleStudySources
            ? getModuleStudySources(selectedModuleId)
            : Promise.resolve({ note_groups: [] })
      : Promise.resolve({ note_groups: [] });
    sourceRequest
      .then((data) => {
        if (!cancelled) {
          setStudySourceNoteGroups(data.note_groups || []);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setStudySourceNoteGroups([]);
          setStudyCardError(error.message || "Failed to load Study source text");
        }
      });

    const questionRequest = selectedConceptId
      ? listConceptQuestionCards(selectedConceptId, conceptOptions)
      : selectedNoteGroupId
        ? listQuestionCards(selectedNoteGroupId)
        : Promise.resolve({ question_cards: [] });
    questionRequest
      .then((data) => {
        if (!cancelled) {
          setQuestionCards(data.question_cards || []);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setQuestionCardError(error.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    routeConceptId,
    routeNoteGroupId,
    includeDescendantStudyCards,
    selectedConceptId,
    selectedModuleId,
    selectedModuleIdRef,
    selectedNoteGroupId,
    selectedSubjectIdRef,
    setRouteRestoreError,
    setSelectedModuleId,
    setSelectedSubjectId,
    shouldHoldContent,
    isStudyPage
  ]);

  return {
    studyCards,
    setStudyCards,
    studySourceNoteGroups,
    studyCardError,
    setStudyCardError,
    questionCards,
    setQuestionCards,
    questionCardError,
    setQuestionCardError,
    questionJobStatus,
    setQuestionJobStatus,
    noteGroupConceptIds,
    setNoteGroupConceptIds,
    metadataTitleDraft,
    setMetadataTitleDraft,
    formattedSections,
    setFormattedSections,
    cleanedTextMarkdown,
    setCleanedTextMarkdown,
    conceptTitleDraft,
    setConceptTitleDraft,
    conceptDescriptionDraft,
    setConceptDescriptionDraft
  };
}
