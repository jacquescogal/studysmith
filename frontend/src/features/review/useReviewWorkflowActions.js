import { deleteQuestionCard, getStudyCard, listConceptReviewQuestionCards, listModuleReviewQuestionCards, listReviewQuestionCards, reviewQuestionCard, sendChat } from "@/api";
import { formatAnswerLabels } from "@/lib/format";
import { buildReviewCard } from "@/lib/review";

export function useReviewWorkflowActions(ctx) {
  const {
    buildReviewCard,
    canUseProtectedActions,
    currentReviewCard,
    deleteQuestionCard,
    formatAnswerLabels,
    getStudyCard,
    listConceptReviewQuestionCards,
    listModuleReviewQuestionCards,
    listReviewQuestionCards,
    requestConfirm,
    reviewAnswer,
    reviewChatCardCache,
    reviewChatInput,
    reviewChatLoading,
    reviewChatMessages,
    reviewCount,
    reviewDeleteLoading,
    reviewFeedback,
    reviewIndex,
    reviewMode,
    reviewNoteGroupId,
    reviewQuestionCard,
    reviewQueue,
    reviewScope,
    reviewStartTime,
    reviewStats,
    selectedModuleId,
    selectedNoteGroupId,
    selectedTopicId,
    sendChat,
    setFocusQuestionCardId,
    setIsQuestionFocusOpen,
    setIsReviewing,
    setQuestionCards,
    setReviewAnswer,
    setReviewChatCardCache,
    setReviewChatCardError,
    setReviewChatCardId,
    setReviewChatCardLoading,
    setReviewChatError,
    setReviewChatInput,
    setReviewChatLoading,
    setReviewChatMessages,
    setReviewChatView,
    setReviewDeleteLoading,
    setReviewDeleteStep,
    setReviewError,
    setReviewExplanationOpen,
    setReviewFeedback,
    setReviewIndex,
    setReviewMode,
    setReviewQueue,
    setReviewRefreshToken,
    setReviewScope,
    setReviewStartTime,
    setReviewStats,
    setReviewSummary
  } = ctx;

const startReview = async (mode, scope = "note-group") => {
    if (!canUseProtectedActions) {
      setReviewError("Sign in to review question cards.");
      return;
    }
    if (scope === "module") {
      if (!selectedModuleId) {
        return;
      }
    } else if (scope === "topic") {
      if (!selectedTopicId) {
        return;
      }
    } else if (!selectedNoteGroupId) {
      return;
    }
    setReviewError("");
    setReviewMode(mode);
    setReviewScope(scope);
    try {
      const response =
        scope === "module"
          ? await listModuleReviewQuestionCards(
              selectedModuleId,
              mode,
              mode === "queue" ? Number(reviewCount) || 10 : undefined
            )
          : scope === "topic"
            ? await listConceptReviewQuestionCards(
                selectedTopicId,
                mode,
                mode === "queue" ? Number(reviewCount) || 10 : undefined
              )
          : await listReviewQuestionCards(
              selectedNoteGroupId,
              mode,
              mode === "queue" ? Number(reviewCount) || 10 : undefined
            );
      const cards = response.question_cards || [];
      if (cards.length === 0) {
        setReviewQueue([]);
        setIsReviewing(false);
        setReviewError("No cards available for this review mode.");
        return;
      }
      const reviewCards = cards.map((card) => buildReviewCard(card));
      setReviewQueue(reviewCards);
      setReviewIndex(0);
      setReviewAnswer([]);
      setReviewStartTime(Date.now());
      setReviewFeedback(null);
      setReviewDeleteStep(0);
      setReviewDeleteLoading(false);
      setReviewSummary(null);
      setReviewStats({
        correct: 0,
        incorrect: 0,
        answered: 0,
        total: reviewCards.length,
        totalMs: 0
      });
      setIsReviewing(true);
    } catch (error) {
      setReviewError(error.message || "Failed to load review cards");
    }
  };

  const toggleReviewAnswer = (index, cardType) => {
    setReviewAnswer((prev) => {
      if (cardType === "mcq") {
        return [index];
      }
      return prev.includes(index) ? prev.filter((value) => value !== index) : [...prev, index];
    });
  };

  const toggleReviewExplanation = (index) => {
    setReviewExplanationOpen((prev) =>
      prev.includes(index) ? prev.filter((value) => value !== index) : [...prev, index]
    );
  };

  const submitReviewAnswer = async (card) => {
    if (!card) {
      return;
    }
    if (!reviewAnswer.length) {
      setReviewError("Select an answer before submitting.");
      return;
    }
    if (reviewFeedback) {
      return;
    }
    setReviewDeleteStep(0);
    const correctIndices = card.reviewCorrectIndices || card.correct_option_indices || [];
    const correct =
      correctIndices.slice().sort().join(",") === reviewAnswer.slice().sort().join(",");
    const responseTimeMs = reviewStartTime ? Date.now() - reviewStartTime : 0;
    const answerOptionIndices = reviewAnswer.map((index) => {
      const choice = card.reviewChoices?.[index];
      return Number.isInteger(choice?.originalIndex) ? choice.originalIndex : index;
    });
    try {
      const updated = await reviewQuestionCard(card.id, {
        correct,
        response_time_ms: responseTimeMs,
        answer_option_indices: answerOptionIndices
      });
      setQuestionCards((prev) =>
        prev.map((item) => (item.id === card.id ? updated : item))
      );
      setReviewFeedback({
        correct,
        correctIndices,
        responseTimeMs
      });
      setReviewStats((prev) => ({
        correct: prev.correct + (correct ? 1 : 0),
        incorrect: prev.incorrect + (correct ? 0 : 1),
        answered: prev.answered + 1,
        total: prev.total,
        totalMs: prev.totalMs + responseTimeMs
      }));
    } catch (error) {
      setReviewError(error.message || "Failed to submit review");
    }
  };

  const finalizeReview = (statsOverride = null) => {
    const stats = statsOverride || reviewStats;
    const answered = stats.answered;
    const total = stats.total;
    const totalMs = stats.totalMs;
    const accuracy = answered ? Math.round((stats.correct / answered) * 100) : 0;
    const avgSeconds = answered ? (totalMs / answered / 1000).toFixed(1) : "0.0";
    setReviewSummary({
      scope: reviewScope,
      mode: reviewMode,
      answered,
      total,
      correct: stats.correct,
      incorrect: stats.incorrect,
      remaining: Math.max(total - answered, 0),
      accuracy,
      avgSeconds
    });
    setReviewRefreshToken((prev) => prev + 1);
    setIsReviewing(false);
    setReviewQueue([]);
    setReviewIndex(0);
    setReviewAnswer([]);
    setReviewStartTime(null);
    setReviewError("");
    setReviewFeedback(null);
    setReviewDeleteStep(0);
    setReviewDeleteLoading(false);
  };

  const endReview = () => {
    finalizeReview();
  };

  const requestReviewDelete = () => {
    if (!currentReviewCard || reviewDeleteLoading) {
      return;
    }
    setReviewError("");
    setReviewDeleteStep(1);
  };

  const cancelReviewDelete = () => {
    setReviewDeleteStep(0);
  };

  const executeReviewDelete = async () => {
    if (!currentReviewCard || reviewDeleteLoading) {
      return;
    }
    setReviewDeleteLoading(true);
    setReviewError("");
    try {
      await deleteQuestionCard(currentReviewCard.id);
      setQuestionCards((prev) => prev.filter((card) => card.id !== currentReviewCard.id));
      const nextQueue = reviewQueue.filter((_, index) => index !== reviewIndex);
      let nextStats = {
        ...reviewStats,
        total: Math.max(reviewStats.total - 1, 0)
      };
      if (reviewFeedback) {
        const responseTimeMs = reviewFeedback.responseTimeMs || 0;
        nextStats = {
          ...nextStats,
          answered: Math.max(nextStats.answered - 1, 0),
          correct: Math.max(nextStats.correct - (reviewFeedback.correct ? 1 : 0), 0),
          incorrect: Math.max(nextStats.incorrect - (reviewFeedback.correct ? 0 : 1), 0),
          totalMs: Math.max(nextStats.totalMs - responseTimeMs, 0)
        };
      }
      if (nextQueue.length === 0 || reviewIndex >= nextQueue.length) {
        setReviewStats(nextStats);
        finalizeReview(nextStats);
        return;
      }
      setReviewQueue(nextQueue);
      setReviewIndex(reviewIndex);
      setReviewAnswer([]);
      setReviewStartTime(Date.now());
      setReviewFeedback(null);
      setReviewDeleteStep(0);
      setReviewStats(nextStats);
      setReviewChatMessages([]);
      setReviewChatInput("");
      setReviewChatError("");
      setReviewChatLoading(false);
      setReviewChatView("chat");
      setReviewChatCardId("");
      setReviewChatCardLoading(false);
      setReviewChatCardError("");
    } catch (error) {
      setReviewError(error.message || "Failed to delete question card");
    } finally {
      setReviewDeleteLoading(false);
    }
  };

  const confirmReviewDelete = async () => {
    if (!currentReviewCard || reviewDeleteLoading) {
      return;
    }
    const shouldDelete = await requestConfirm({
      title: "Delete this question card?",
      description: "This cannot be undone.",
      confirmLabel: "Delete question card"
    });
    if (!shouldDelete) {
      return;
    }
    await executeReviewDelete();
  };

  const nextReviewCard = () => {
    if (!reviewFeedback) {
      setReviewError("Submit your answer first.");
      return;
    }
    const nextIndex = reviewIndex + 1;
    if (nextIndex >= reviewQueue.length) {
      endReview();
      return;
    }
    setReviewIndex(nextIndex);
    setReviewAnswer([]);
    setReviewStartTime(Date.now());
    setReviewFeedback(null);
    setReviewError("");
    setReviewDeleteStep(0);
  };

  const openQuestionFocus = (cardId) => {
    setFocusQuestionCardId(cardId);
    setIsQuestionFocusOpen(true);
  };

  const closeQuestionFocus = () => {
    setIsQuestionFocusOpen(false);
    setFocusQuestionCardId("");
  };

  const handleSendReviewChat = async () => {
    if (!selectedModuleId || !reviewNoteGroupId || !reviewChatInput.trim()) {
      return;
    }
    setReviewChatLoading(true);
    setReviewChatError("");
    const message = reviewChatInput.trim();
    const history = reviewChatMessages
      .slice(-10)
      .filter((item) => item?.content)
      .map((item) => ({
        role: item.role,
        content: item.content
      }));
    setReviewChatInput("");
    setReviewChatMessages((prev) => [...prev, { role: "user", content: message }]);
    try {
      const questionPrompt = currentReviewCard?.prompt || "";
      const userAnswer = formatAnswerLabels(currentReviewCard, reviewAnswer);
      const correctAnswer = formatAnswerLabels(
        currentReviewCard,
        currentReviewCard?.reviewCorrectIndices ||
          currentReviewCard?.correct_option_indices ||
          []
      );
      const response = await sendChat({
        module_id: selectedModuleId,
        message,
        note_group_id: reviewNoteGroupId,
        question_prompt: questionPrompt,
        user_answer: userAnswer,
        correct_answer: correctAnswer,
        history
      });
      setReviewChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: response.answer, refs: response.study_card_refs || [] }
      ]);
      if (response.study_card_refs && response.study_card_refs.length) {
        response.study_card_refs.forEach((refId) => {
          setReviewChatCardCache((prev) => {
            if (prev[refId]) {
              return prev;
            }
            getStudyCard(refId)
              .then((card) =>
                setReviewChatCardCache((next) => ({
                  ...next,
                  [refId]: card
                }))
              )
              .catch(() => null);
            return prev;
          });
        });
      }
    } catch (error) {
      setReviewChatError(error.message || "Chat failed");
    } finally {
      setReviewChatLoading(false);
    }
  };

  const openReviewStudyCard = (studyCardId) => {
    if (!studyCardId) {
      return;
    }
    setReviewChatView("card");
    setReviewChatCardId(studyCardId);
    setReviewChatCardError("");
    if (reviewChatCardCache[studyCardId]) {
      return;
    }
    setReviewChatCardLoading(true);
    getStudyCard(studyCardId)
      .then((card) =>
        setReviewChatCardCache((prev) => ({
          ...prev,
          [studyCardId]: card
        }))
      )
      .catch((error) => setReviewChatCardError(error.message || "Failed to load study card"))
      .finally(() => setReviewChatCardLoading(false));
  };

  const handleBackToReviewChat = () => {
    setReviewChatView("chat");
    setReviewChatCardId("");
    setReviewChatCardError("");
  };

  const handleReviewChatKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (
        !reviewChatLoading &&
        selectedModuleId &&
        reviewNoteGroupId &&
        reviewChatInput.trim()
      ) {
        handleSendReviewChat();
      }
    }
  };

  return {
    cancelReviewDelete,
    closeQuestionFocus,
    confirmReviewDelete,
    endReview,
    executeReviewDelete,
    handleBackToReviewChat,
    handleReviewChatKeyDown,
    handleSendReviewChat,
    nextReviewCard,
    openQuestionFocus,
    openReviewStudyCard,
    requestReviewDelete,
    startReview,
    submitReviewAnswer,
    toggleReviewAnswer,
    toggleReviewExplanation
  };
}
