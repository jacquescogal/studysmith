import { describe, expect, test, vi } from "vitest";

import { useStudyAppWorkflowActions } from "./useStudyAppWorkflowActions";

const noop = () => {};

function makeContext(overrides = {}) {
  return {
    auth: { signInWithEmail: vi.fn(), signOut: vi.fn() },
    conceptPath: (subjectCode, moduleCode, conceptCode, panel) =>
      `/concept/${subjectCode}/${moduleCode}/${conceptCode}/${panel || "overview"}`,
    isQuestionPage: false,
    isStudyPage: false,
    modulePath: (subjectCode, moduleCode) => `/module/${subjectCode}/${moduleCode}`,
    navigate: vi.fn(),
    routePanel: "",
    selectedModuleCode: "module-a",
    selectedSubjectCode: "subject-a",
    selectedTopicId: "",
    setChipFilterIds: vi.fn(),
    setIsChatOpen: vi.fn(),
    setIsMetadataOpen: vi.fn(),
    setIsModuleMetadataOpen: vi.fn(),
    setNoteGroupMode: vi.fn(),
    setReviewSummary: vi.fn(),
    setSelectedNoteGroupId: vi.fn(),
    setSelectedTopicId: vi.fn(),
    setSidebarScope: vi.fn(),
    subjectPath: (subjectCode) => `/subject/${subjectCode}`,
    ...overrides
  };
}

describe("useStudyAppWorkflowActions concept navigation", () => {
  test("navigates to the selected Concept route from loaded concepts", () => {
    const ctx = makeContext({
      topicChips: [{ id: "topic-1", short_code: "concept-a" }]
    });

    useStudyAppWorkflowActions(ctx).handleSelectTopic({ value: "topic-1" });

    expect(ctx.navigate).toHaveBeenCalledWith("/concept/subject-a/module-a/concept-a/overview");
  });

  test("does not throw when concepts are not loaded into the action context", () => {
    const ctx = makeContext();

    expect(() =>
      useStudyAppWorkflowActions(ctx).handleSelectTopic({ value: "topic-1" })
    ).not.toThrow();
    expect(ctx.navigate).toHaveBeenCalledWith("/");
  });
});
