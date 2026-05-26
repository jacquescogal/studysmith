import { useCallback, useEffect, useRef, useState } from "react";

import { getStudyCard, sendChat } from "@/api";

export function buildTutorChatRequest({
  moduleId,
  noteGroupId,
  conceptId,
  message,
  messages = []
}) {
  const hasConceptContext = Boolean(conceptId);
  return {
    module_id: moduleId,
    message,
    note_group_id: hasConceptContext ? null : noteGroupId || null,
    concept_id: conceptId || null,
    history: messages
      .slice(-10)
      .filter((item) => item?.content)
      .map((item) => ({
        role: item.role,
        content: item.content
      }))
  };
}

export function useTutorChat({
  moduleId = "",
  noteGroupId = "",
  conceptId = "",
  isOpen = false
} = {}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState("chat");
  const [cardId, setCardId] = useState("");
  const [cardCache, setCardCache] = useState({});
  const [cardLoading, setCardLoading] = useState(false);
  const [cardError, setCardError] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    setMessages([]);
    setError("");
    setInput("");
    setView("chat");
    setCardId("");
    setCardLoading(false);
    setCardError("");
  }, [conceptId, moduleId, noteGroupId]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const container = listRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setView("chat");
    setCardId("");
    setCardLoading(false);
    setCardError("");
  }, [isOpen]);

  const hydrateRefs = useCallback((studyCardRefs = []) => {
    studyCardRefs.forEach((refId) => {
      setCardCache((prev) => {
        if (prev[refId]) {
          return prev;
        }
        getStudyCard(refId)
          .then((card) =>
            setCardCache((next) => ({
              ...next,
              [refId]: card
            }))
          )
          .catch(() => null);
        return prev;
      });
    });
  }, []);

  const sendMessage = useCallback(async () => {
    if (!moduleId || !input.trim()) {
      return;
    }
    setLoading(true);
    setError("");
    const message = input.trim();
    const request = buildTutorChatRequest({
      moduleId,
      noteGroupId,
      conceptId,
      message,
      messages
    });
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    try {
      const response = await sendChat(request);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: response.answer, refs: response.study_card_refs || [] }
      ]);
      hydrateRefs(response.study_card_refs || []);
    } catch (sendError) {
      setError(sendError.message || "Chat failed");
    } finally {
      setLoading(false);
    }
  }, [conceptId, hydrateRefs, input, messages, moduleId, noteGroupId]);

  const openStudyCard = useCallback(
    (studyCardId) => {
      if (!studyCardId) {
        return;
      }
      setView("card");
      setCardId(studyCardId);
      setCardError("");
      if (cardCache[studyCardId]) {
        return;
      }
      setCardLoading(true);
      getStudyCard(studyCardId)
        .then((card) =>
          setCardCache((prev) => ({
            ...prev,
            [studyCardId]: card
          }))
        )
        .catch((loadError) => setCardError(loadError.message || "Failed to load study card"))
        .finally(() => setCardLoading(false));
    },
    [cardCache]
  );

  const backToChat = useCallback(() => {
    setView("chat");
    setCardId("");
    setCardError("");
  }, []);

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key !== "Enter" || event.shiftKey) {
        return;
      }
      event.preventDefault();
      if (!loading && moduleId && input.trim()) {
        sendMessage();
      }
    },
    [input, loading, moduleId, sendMessage]
  );

  return {
    messages,
    setMessages,
    input,
    setInput,
    error,
    setError,
    loading,
    setLoading,
    view,
    setView,
    cardId,
    setCardId,
    cardCache,
    setCardCache,
    cardLoading,
    setCardLoading,
    cardError,
    setCardError,
    listRef,
    sendMessage,
    openStudyCard,
    backToChat,
    handleKeyDown
  };
}
