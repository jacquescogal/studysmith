import { useEffect, useMemo, useRef, useState } from "react";

export const getReviewScopeForContext = ({ conceptId = "" } = {}) =>
  conceptId ? "topic" : "note-group";

export function getReviewCardType(card) {
  if (!card) {
    return "mcq";
  }
  const correctIndices =
    card.reviewCorrectIndices ||
    card.correct_option_indices ||
    [];
  if (card.type === "mcq" && correctIndices.length > 1) {
    return "multi_select";
  }
  return card.type || "mcq";
}

export function useReviewSession({
  selectedNoteGroupId = "",
  selectedConceptId = "",
  selectedModuleId = ""
} = {}) {
  const [reviewQueue, setReviewQueue] = useState([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewMode, setReviewMode] = useState("due");
  const [reviewScope, setReviewScope] = useState("note-group");
  const [reviewCount, setReviewCount] = useState(10);
  const [reviewError, setReviewError] = useState("");
  const [reviewAnswer, setReviewAnswer] = useState([]);
  const [reviewStartTime, setReviewStartTime] = useState(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewFeedback, setReviewFeedback] = useState(null);
  const [reviewExplanationOpen, setReviewExplanationOpen] = useState([]);
  const [reviewDeleteStep, setReviewDeleteStep] = useState(0);
  const [reviewDeleteLoading, setReviewDeleteLoading] = useState(false);
  const [reviewStats, setReviewStats] = useState({
    correct: 0,
    incorrect: 0,
    answered: 0,
    total: 0,
    totalMs: 0
  });
  const [reviewRefreshToken, setReviewRefreshToken] = useState(0);
  const [reviewSummary, setReviewSummary] = useState(null);
  const [reviewChatMessages, setReviewChatMessages] = useState([]);
  const [reviewChatInput, setReviewChatInput] = useState("");
  const [reviewChatError, setReviewChatError] = useState("");
  const [reviewChatLoading, setReviewChatLoading] = useState(false);
  const [reviewChatView, setReviewChatView] = useState("chat");
  const [reviewChatCardId, setReviewChatCardId] = useState("");
  const [reviewChatCardCache, setReviewChatCardCache] = useState({});
  const [reviewChatCardLoading, setReviewChatCardLoading] = useState(false);
  const [reviewChatCardError, setReviewChatCardError] = useState("");
  const reviewChatListRef = useRef(null);
  const reviewDeleteKeyRef = useRef(0);

  const currentReviewCard = reviewQueue[reviewIndex];
  const reviewCardType = useMemo(() => getReviewCardType(currentReviewCard), [currentReviewCard]);
  const reviewNoteGroupId =
    reviewScope === "module" || reviewScope === "topic"
      ? currentReviewCard?.note_group_id
      : selectedNoteGroupId;
  const reviewCardRefs = currentReviewCard?.study_card_refs || [];
  const isReviewOverlayVisible = isReviewing || Boolean(reviewSummary);

  useEffect(() => {
    setReviewQueue([]);
    setReviewIndex(0);
    setReviewError("");
    setReviewAnswer([]);
    setReviewExplanationOpen([]);
    setReviewStartTime(null);
    setIsReviewing(false);
    setReviewFeedback(null);
    setReviewSummary(null);
    setReviewScope(getReviewScopeForContext({ conceptId: selectedConceptId }));
    setReviewDeleteStep(0);
    setReviewDeleteLoading(false);
  }, [selectedConceptId, selectedModuleId, selectedNoteGroupId]);

  useEffect(() => {
    setReviewChatMessages([]);
    setReviewChatInput("");
    setReviewChatError("");
    setReviewChatLoading(false);
    setReviewChatView("chat");
    setReviewChatCardId("");
    setReviewChatCardLoading(false);
    setReviewChatCardError("");
    setReviewDeleteStep(0);
    setReviewDeleteLoading(false);
    setReviewExplanationOpen([]);
  }, [reviewIndex, reviewSummary, selectedConceptId, selectedModuleId, selectedNoteGroupId]);

  useEffect(() => {
    if (reviewChatView !== "chat") {
      return;
    }
    const container = reviewChatListRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    }
  }, [reviewChatMessages, reviewChatView]);

  return {
    reviewQueue,
    setReviewQueue,
    reviewIndex,
    setReviewIndex,
    reviewMode,
    setReviewMode,
    reviewScope,
    setReviewScope,
    reviewCount,
    setReviewCount,
    reviewError,
    setReviewError,
    reviewAnswer,
    setReviewAnswer,
    reviewStartTime,
    setReviewStartTime,
    isReviewing,
    setIsReviewing,
    reviewFeedback,
    setReviewFeedback,
    reviewExplanationOpen,
    setReviewExplanationOpen,
    reviewDeleteStep,
    setReviewDeleteStep,
    reviewDeleteLoading,
    setReviewDeleteLoading,
    reviewStats,
    setReviewStats,
    reviewRefreshToken,
    setReviewRefreshToken,
    reviewSummary,
    setReviewSummary,
    reviewChatMessages,
    setReviewChatMessages,
    reviewChatInput,
    setReviewChatInput,
    reviewChatError,
    setReviewChatError,
    reviewChatLoading,
    setReviewChatLoading,
    reviewChatView,
    setReviewChatView,
    reviewChatCardId,
    setReviewChatCardId,
    reviewChatCardCache,
    setReviewChatCardCache,
    reviewChatCardLoading,
    setReviewChatCardLoading,
    reviewChatCardError,
    setReviewChatCardError,
    reviewChatListRef,
    reviewDeleteKeyRef,
    currentReviewCard,
    reviewCardType,
    reviewNoteGroupId,
    reviewCardRefs,
    isReviewOverlayVisible
  };
}
