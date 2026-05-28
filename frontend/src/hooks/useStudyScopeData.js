import { useEffect, useState } from "react";

import {
  getConcept,
  getModule,
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
  selectedNoteGroupId = "",
  selectedConceptId = "",
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
    if (!selectedNoteGroupId && !selectedConceptId) {
      setStudyCards([]);
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

        const data = await withRouteRestoreTimeout(
          getNoteGroup(selectedNoteGroupId),
          "Note group restore"
        );
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

    loadScope();

    const studyRequest = selectedConceptId
      ? listConceptStudyCards(selectedConceptId, conceptOptions)
      : listStudyCards(selectedNoteGroupId);
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

    const questionRequest = selectedConceptId
      ? listConceptQuestionCards(selectedConceptId, conceptOptions)
      : listQuestionCards(selectedNoteGroupId);
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
    selectedModuleIdRef,
    selectedNoteGroupId,
    selectedSubjectIdRef,
    setRouteRestoreError,
    setSelectedModuleId,
    setSelectedSubjectId,
    shouldHoldContent
  ]);

  return {
    studyCards,
    setStudyCards,
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
