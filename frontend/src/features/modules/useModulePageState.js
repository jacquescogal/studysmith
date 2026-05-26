import { useState } from "react";

export function useModulePageState() {
  const [moduleTitleDraft, setModuleTitleDraft] = useState("");
  const [moduleDescriptionDraft, setModuleDescriptionDraft] = useState("");
  const [moduleAdditionalInstructionsDraft, setModuleAdditionalInstructionsDraft] = useState("");
  const [moduleGoalDraft, setModuleGoalDraft] = useState("");
  const [moduleScopeDraft, setModuleScopeDraft] = useState("");
  const [moduleMetadataSaving, setModuleMetadataSaving] = useState(false);
  const [moduleMetadataError, setModuleMetadataError] = useState("");
  const [chipFilterIds, setChipFilterIds] = useState([]);
  const [moduleChipLabel, setModuleChipLabel] = useState("");
  const [moduleChipDescription, setModuleChipDescription] = useState("");
  const [draggedNoteGroupId, setDraggedNoteGroupId] = useState("");
  const [dragOverNoteGroupId, setDragOverNoteGroupId] = useState("");
  const [isReorderingNoteGroups, setIsReorderingNoteGroups] = useState(false);

  return {
    moduleTitleDraft,
    setModuleTitleDraft,
    moduleDescriptionDraft,
    setModuleDescriptionDraft,
    moduleAdditionalInstructionsDraft,
    setModuleAdditionalInstructionsDraft,
    moduleGoalDraft,
    setModuleGoalDraft,
    moduleScopeDraft,
    setModuleScopeDraft,
    moduleMetadataSaving,
    setModuleMetadataSaving,
    moduleMetadataError,
    setModuleMetadataError,
    chipFilterIds,
    setChipFilterIds,
    moduleChipLabel,
    setModuleChipLabel,
    moduleChipDescription,
    setModuleChipDescription,
    draggedNoteGroupId,
    setDraggedNoteGroupId,
    dragOverNoteGroupId,
    setDragOverNoteGroupId,
    isReorderingNoteGroups,
    setIsReorderingNoteGroups
  };
}
