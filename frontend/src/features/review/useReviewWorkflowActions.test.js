import { afterEach, describe, expect, test, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  deleteQuestionCard: vi.fn(),
  getStudyCard: vi.fn(),
  listConceptReviewQuestionCards: vi.fn(() =>
    Promise.resolve({ question_cards: [{ id: "question-1" }] })
  ),
  listModuleReviewQuestionCards: vi.fn(),
  listReviewQuestionCards: vi.fn(),
  reviewQuestionCard: vi.fn(),
  sendChat: vi.fn()
}));

vi.mock("@/api", () => apiMocks);

import { listConceptReviewQuestionCards } from "@/api";
import { useReviewWorkflowActions } from "./useReviewWorkflowActions";

const noop = () => {};

function makeContext(overrides = {}) {
  return {
    buildReviewCard: (card) => card,
    canUseProtectedActions: true,
    currentReviewCard: null,
    deleteQuestionCard: vi.fn(),
    formatAnswerLabels: vi.fn(),
    getStudyCard: vi.fn(),
    includeDescendantStudyCards: false,
    listConceptReviewQuestionCards,
    listModuleReviewQuestionCards: vi.fn(),
    listReviewQuestionCards: vi.fn(),
    requestConfirm: vi.fn(),
    reviewAnswer: [],
    reviewChatCardCache: {},
    reviewChatInput: "",
    reviewChatLoading: false,
    reviewChatMessages: [],
    reviewCount: "",
    reviewDeleteLoading: false,
    reviewFeedback: null,
    reviewIndex: 0,
    reviewMode: "due",
    reviewNoteGroupId: "",
    reviewQuestionCard: vi.fn(),
    reviewQueue: [],
    reviewScope: "topic",
    reviewStartTime: null,
    reviewStats: { correct: 0, incorrect: 0, answered: 0, total: 0, totalMs: 0 },
    selectedModuleId: "",
    selectedNoteGroupId: "",
    selectedTopicId: "concept-1",
    sendChat: vi.fn(),
    setFocusQuestionCardId: noop,
    setIsQuestionFocusOpen: noop,
    setIsReviewing: vi.fn(),
    setQuestionCards: noop,
    setReviewAnswer: noop,
    setReviewChatCardCache: noop,
    setReviewChatCardError: noop,
    setReviewChatCardId: noop,
    setReviewChatCardLoading: noop,
    setReviewChatError: noop,
    setReviewChatInput: noop,
    setReviewChatLoading: noop,
    setReviewChatMessages: noop,
    setReviewChatView: noop,
    setReviewDeleteLoading: noop,
    setReviewDeleteStep: noop,
    setReviewError: vi.fn(),
    setReviewExplanationOpen: noop,
    setReviewFeedback: noop,
    setReviewIndex: noop,
    setReviewMode: noop,
    setReviewQueue: noop,
    setReviewRefreshToken: noop,
    setReviewScope: noop,
    setReviewStartTime: noop,
    setReviewStats: noop,
    setReviewSummary: noop,
    ...overrides
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("useReviewWorkflowActions", () => {
  test("starts Concept review with descendant Concept inclusion disabled", async () => {
    const ctx = makeContext();

    await useReviewWorkflowActions(ctx).startReview("due", "topic");

    expect(listConceptReviewQuestionCards).toHaveBeenCalledWith(
      "concept-1",
      "due",
      undefined,
      { includeDescendants: false }
    );
  });
});
