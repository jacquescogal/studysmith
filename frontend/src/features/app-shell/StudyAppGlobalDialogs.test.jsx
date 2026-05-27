import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("@/components/common/LegacyDialog", () => ({
  LegacyDialog: ({ children }) => <div>{children}</div>
}));

import { StudyAppGlobalDialogs } from "./StudyAppGlobalDialogs";

function baseDialogModel(overrides = {}) {
  return {
    canManageSelectedSubject: true,
    canUseProtectedActions: true,
    chipOptions: [],
    closeQuestionFocus: vi.fn(),
    editingSubjectId: "",
    focusCardType: "question",
    focusQuestionCard: null,
    formatDueAt: vi.fn(),
    formatReviewAt: vi.fn(),
    handleCreateModuleFromWizard: vi.fn(),
    handleCreateQuestionCard: vi.fn(),
    handleCreateStudyCard: vi.fn(),
    handleCreateSubjectFromWizard: vi.fn(),
    handleDeleteModule: vi.fn(),
    handleDeleteNoteGroup: vi.fn(),
    handleDeleteTopic: vi.fn(),
    handleModuleWizardSend: vi.fn(),
    handleRegenerateTopicKnowledgeNodes: vi.fn(),
    handleSaveMetadataTitle: vi.fn(),
    handleSaveModuleMetadata: vi.fn(),
    handleSaveSubjectMetadata: vi.fn(),
    handleSubjectWizardSend: vi.fn(),
    isMetadataOpen: false,
    isModuleMetadataOpen: false,
    isModuleWizardOpen: false,
    isQuestionCreateOpen: false,
    isQuestionFocusOpen: false,
    isStudyCreateOpen: false,
    isSubjectMetadataOpen: false,
    isSubjectWizardOpen: false,
    isConceptSettingsOpen: false,
    metadataError: "",
    metadataSaving: false,
    metadataTitleDraft: "Photosynthesis",
    moduleAdditionalInstructionsDraft: "",
    moduleDescriptionDraft: "",
    moduleGoalDraft: "",
    moduleMetadataError: "",
    moduleMetadataSaving: false,
    moduleScopeDraft: "",
    moduleTitleDraft: "Cell biology",
    moduleWizardMessages: [],
    newQuestionCorrectIndices: "",
    newQuestionOptions: "",
    newQuestionPrompt: "",
    newQuestionRefs: [],
    newQuestionType: "mcq",
    newStudyCardChipIds: [],
    newStudyCardContent: "",
    newStudyCardTitle: "",
    questionCardError: "",
    selectedConcept: { id: "concept-1", label: "Elasticity" },
    selectedConceptId: "concept-1",
    selectedNoteGroupId: "note-group-1",
    selectedSubject: null,
    selectedSubjectId: "subject-1",
    setIsConceptSettingsOpen: vi.fn(),
    setIsMetadataOpen: vi.fn(),
    setIsModuleMetadataOpen: vi.fn(),
    setIsModuleWizardOpen: vi.fn(),
    setIsQuestionCreateOpen: vi.fn(),
    setIsStudyCreateOpen: vi.fn(),
    setIsSubjectMetadataOpen: vi.fn(),
    setIsSubjectWizardOpen: vi.fn(),
    setMetadataTitleDraft: vi.fn(),
    setModuleAdditionalInstructionsDraft: vi.fn(),
    setModuleDescriptionDraft: vi.fn(),
    setModuleGoalDraft: vi.fn(),
    setModuleScopeDraft: vi.fn(),
    setModuleTitleDraft: vi.fn(),
    setModuleWizardGoal: vi.fn(),
    setModuleWizardInput: vi.fn(),
    setModuleWizardScope: vi.fn(),
    setModuleWizardTitle: vi.fn(),
    setNewQuestionCorrectIndices: vi.fn(),
    setNewQuestionOptions: vi.fn(),
    setNewQuestionPrompt: vi.fn(),
    setNewQuestionRefs: vi.fn(),
    setNewQuestionType: vi.fn(),
    setNewStudyCardChipIds: vi.fn(),
    setNewStudyCardContent: vi.fn(),
    setNewStudyCardTitle: vi.fn(),
    setSubjectGoalDraft: vi.fn(),
    setSubjectScopeDraft: vi.fn(),
    setSubjectTitleDraft: vi.fn(),
    setSubjectWizardGoal: vi.fn(),
    setSubjectWizardInput: vi.fn(),
    setSubjectWizardScope: vi.fn(),
    setSubjectWizardTitle: vi.fn(),
    studyCardError: "",
    studyCards: [],
    subjectGoalDraft: "",
    subjectMetadataError: "",
    subjectMetadataSaving: false,
    subjectScopeDraft: "",
    subjectTitleDraft: "",
    subjectWizardMessages: [],
    wizardChatRef: { current: null },
    ...overrides
  };
}

describe("StudyAppGlobalDialogs settings", () => {
  test("Module settings includes delete Module", () => {
    const html = renderToStaticMarkup(
      <StudyAppGlobalDialogs model={baseDialogModel({ isModuleMetadataOpen: true })} />
    );

    expect(html).toContain("Module settings");
    expect(html).toContain("Delete module");
  });

  test("Note Group settings supports title rename and delete", () => {
    const html = renderToStaticMarkup(
      <StudyAppGlobalDialogs model={baseDialogModel({ isMetadataOpen: true })} />
    );

    expect(html).toContain("Note Group settings");
    expect(html).toContain("Note Group title");
    expect(html).toContain("Save title");
    expect(html).toContain("Delete Note Group");
  });

  test("Concept settings offers delete and regenerate only", () => {
    const html = renderToStaticMarkup(
      <StudyAppGlobalDialogs model={baseDialogModel({ isConceptSettingsOpen: true })} />
    );

    expect(html).toContain("Concept settings");
    expect(html).toContain("Regenerate Concept");
    expect(html).toContain("Delete Concept");
    expect(html).not.toContain("Concept title");
    expect(html).not.toContain("Concept description");
    expect(html).not.toContain("Rename concept");
  });
});
