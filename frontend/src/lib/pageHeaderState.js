export function getStudyPageHeader({
  noteGroupMode,
  selectedTopic,
  selectedConcept,
  selectedNoteGroup,
  selectedModule,
  selectedSubject
}) {
  if (noteGroupMode === "auto") {
    return {
      title: "Create Note Group",
      description: "Paste raw text and we will create a Note Group and questions in the background.",
      pageType: "Note Group generation",
      tone: "note-group"
    };
  }

  const activeConcept = selectedConcept || selectedTopic;

  if (activeConcept) {
    return {
      title: activeConcept.label || "Concept",
      description: "",
      pageType: "Concept",
      tone: "concept"
    };
  }

  if (selectedNoteGroup) {
    return {
      title: selectedNoteGroup.title || "Note Group",
      description: "",
      pageType: "Note Group",
      tone: "note-group"
    };
  }

  if (selectedModule) {
    return {
      title: selectedModule.title || "Module",
      description: "",
      pageType: "Module",
      tone: "module"
    };
  }

  if (selectedSubject) {
    return {
      title: selectedSubject.title || "Subject",
      description: "Pick a module to get started.",
      pageType: "Subject",
      tone: "subject"
    };
  }

  return {
    title: "Subjects",
    description: "Choose a subject to get started.",
    pageType: "Subjects",
    tone: "default"
  };
}
