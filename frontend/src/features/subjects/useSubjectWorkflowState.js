import { useState } from "react";

export function useSubjectWorkflowState() {
  const [newSubjectTitle, setNewSubjectTitle] = useState("");
  const [newSubjectDescription, setNewSubjectDescription] = useState("");
  const [isSubjectWizardOpen, setIsSubjectWizardOpen] = useState(false);
  const [subjectWizardMessages, setSubjectWizardMessages] = useState([]);
  const [subjectWizardInput, setSubjectWizardInput] = useState("");
  const [subjectWizardLoading, setSubjectWizardLoading] = useState(false);
  const [subjectWizardTitle, setSubjectWizardTitle] = useState("");
  const [subjectWizardGoal, setSubjectWizardGoal] = useState("");
  const [subjectWizardScope, setSubjectWizardScope] = useState("");
  const [subjectWizardError, setSubjectWizardError] = useState("");
  const [subjectWizardCreating, setSubjectWizardCreating] = useState(false);
  const [isSubjectMetadataOpen, setIsSubjectMetadataOpen] = useState(false);
  const [editingSubjectId, setEditingSubjectId] = useState(null);
  const [subjectTitleDraft, setSubjectTitleDraft] = useState("");
  const [subjectGoalDraft, setSubjectGoalDraft] = useState("");
  const [subjectScopeDraft, setSubjectScopeDraft] = useState("");
  const [subjectMetadataSaving, setSubjectMetadataSaving] = useState(false);
  const [subjectMetadataError, setSubjectMetadataError] = useState("");

  return {
    newSubjectTitle,
    setNewSubjectTitle,
    newSubjectDescription,
    setNewSubjectDescription,
    isSubjectWizardOpen,
    setIsSubjectWizardOpen,
    subjectWizardMessages,
    setSubjectWizardMessages,
    subjectWizardInput,
    setSubjectWizardInput,
    subjectWizardLoading,
    setSubjectWizardLoading,
    subjectWizardTitle,
    setSubjectWizardTitle,
    subjectWizardGoal,
    setSubjectWizardGoal,
    subjectWizardScope,
    setSubjectWizardScope,
    subjectWizardError,
    setSubjectWizardError,
    subjectWizardCreating,
    setSubjectWizardCreating,
    isSubjectMetadataOpen,
    setIsSubjectMetadataOpen,
    editingSubjectId,
    setEditingSubjectId,
    subjectTitleDraft,
    setSubjectTitleDraft,
    subjectGoalDraft,
    setSubjectGoalDraft,
    subjectScopeDraft,
    setSubjectScopeDraft,
    subjectMetadataSaving,
    setSubjectMetadataSaving,
    subjectMetadataError,
    setSubjectMetadataError
  };
}
