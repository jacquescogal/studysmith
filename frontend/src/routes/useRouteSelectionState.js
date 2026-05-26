import { useEffect, useRef, useState } from "react";

export function useRouteSelectionState() {
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [selectedNoteGroupId, setSelectedNoteGroupId] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState("");

  const selectedSubjectIdRef = useRef(selectedSubjectId);
  const selectedModuleIdRef = useRef(selectedModuleId);
  const selectedNoteGroupIdRef = useRef(selectedNoteGroupId);

  useEffect(() => {
    selectedSubjectIdRef.current = selectedSubjectId;
  }, [selectedSubjectId]);

  useEffect(() => {
    selectedModuleIdRef.current = selectedModuleId;
  }, [selectedModuleId]);

  useEffect(() => {
    selectedNoteGroupIdRef.current = selectedNoteGroupId;
  }, [selectedNoteGroupId]);

  return {
    selectedSubjectId,
    setSelectedSubjectId,
    selectedModuleId,
    setSelectedModuleId,
    selectedNoteGroupId,
    setSelectedNoteGroupId,
    selectedTopicId,
    setSelectedTopicId,
    selectedSubjectIdRef,
    selectedModuleIdRef,
    selectedNoteGroupIdRef
  };
}
