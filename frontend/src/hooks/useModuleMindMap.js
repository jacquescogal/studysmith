import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  getModuleMindMap,
  regenerateModuleNeedsReviewKnowledgeNodes
} from "@/api";

function syncConceptStatusesFromMindMap(graph, setConcepts) {
  const conceptNodes = Array.isArray(graph?.nodes)
    ? graph.nodes.filter((node) => node.node_type === "concept" || node.node_type === "topic")
    : [];
  if (!conceptNodes.length) {
    return;
  }

  const conceptStatusById = new Map(
    conceptNodes.map((node) => [
      node.id,
      {
        knowledge_node_status: node.knowledge_node_status,
        knowledge_node_review_reason: node.knowledge_node_review_reason
      }
    ])
  );

  setConcepts?.((prev) =>
    prev.map((concept) => {
      const status = conceptStatusById.get(concept.id);
      return status ? { ...concept, ...status } : concept;
    })
  );
}

export function useModuleMindMap({
  moduleId = "",
  selectedNoteGroupId = "",
  selectedConceptId = "",
  noteGroupMode = "overview",
  refreshToken = 0,
  canManageSelectedSubject = false,
  canUseProtectedActions = false,
  setConcepts,
  setRefreshToken
} = {}) {
  const [moduleMindMap, setModuleMindMap] = useState(null);
  const [moduleMindMapLoading, setModuleMindMapLoading] = useState(false);
  const [moduleMindMapError, setModuleMindMapError] = useState("");
  const [moduleNeedsReviewRegenerating, setModuleNeedsReviewRegenerating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!moduleId || selectedNoteGroupId || selectedConceptId || noteGroupMode === "auto") {
      setModuleMindMap(null);
      setModuleMindMapError("");
      setModuleMindMapLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const loadModuleMindMap = async () => {
      setModuleMindMapLoading(true);
      setModuleMindMapError("");
      try {
        const data = await getModuleMindMap(moduleId);
        if (!cancelled) {
          setModuleMindMap(data);
        }
      } catch (error) {
        if (!cancelled) {
          setModuleMindMap(null);
          setModuleMindMapError(error.message || "Failed to load module Mind Map");
        }
      } finally {
        if (!cancelled) {
          setModuleMindMapLoading(false);
        }
      }
    };

    loadModuleMindMap();
    return () => {
      cancelled = true;
    };
  }, [moduleId, selectedConceptId, selectedNoteGroupId, noteGroupMode, refreshToken]);

  const handleRegenerateModuleNeedsReviewKnowledgeNodes = useCallback(async () => {
    if (!canManageSelectedSubject) {
      setModuleMindMapError(
        canUseProtectedActions
          ? "Maintainer access is required to regenerate Knowledge Nodes."
          : "Sign in to regenerate Knowledge Nodes."
      );
      return;
    }
    if (!moduleId || moduleNeedsReviewRegenerating) {
      return;
    }

    setModuleNeedsReviewRegenerating(true);
    setModuleMindMapError("");
    try {
      const graph = await regenerateModuleNeedsReviewKnowledgeNodes(moduleId);
      setModuleMindMap(graph);
      syncConceptStatusesFromMindMap(graph, setConcepts);
      toast.success("Needs review Knowledge Nodes regenerated.");
      setRefreshToken?.((prev) => prev + 1);
    } catch (error) {
      setModuleMindMapError(error.message || "Failed to regenerate needs review Knowledge Nodes");
    } finally {
      setModuleNeedsReviewRegenerating(false);
    }
  }, [
    canManageSelectedSubject,
    canUseProtectedActions,
    moduleId,
    moduleNeedsReviewRegenerating,
    setConcepts,
    setRefreshToken
  ]);

  return {
    moduleMindMap,
    moduleMindMapLoading,
    moduleMindMapError,
    moduleNeedsReviewRegenerating,
    handleRegenerateModuleNeedsReviewKnowledgeNodes
  };
}
