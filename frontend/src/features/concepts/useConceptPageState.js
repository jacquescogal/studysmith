import { useState } from "react";

export function useConceptPageState() {
  const [conceptSaving, setConceptSaving] = useState(false);
  const [conceptKnowledgeNodeRegenerating, setConceptKnowledgeNodeRegenerating] = useState(false);
  const [conceptKnowledgeNodeRegeneratingId, setConceptKnowledgeNodeRegeneratingId] = useState("");
  const [conceptError, setConceptError] = useState("");

  return {
    conceptSaving,
    setConceptSaving,
    conceptKnowledgeNodeRegenerating,
    setConceptKnowledgeNodeRegenerating,
    conceptKnowledgeNodeRegeneratingId,
    setConceptKnowledgeNodeRegeneratingId,
    conceptError,
    setConceptError
  };
}
