import { toast } from "sonner";

import { deleteConcept, regenerateConceptKnowledgeNodes, updateConcept } from "@/api";
import { resolveConceptKnowledgeNodeTarget } from "@/lib/conceptKnowledgeNodes";
import { modulePath } from "@/lib/routes";

export function useConceptPageActions({
  canManageSelectedSubject,
  canUseProtectedActions,
  conceptDescriptionDraft,
  conceptKnowledgeNodeRegenerating,
  conceptTitleDraft,
  selectedConcept,
  selectedConceptId,
  selectedModuleCode,
  selectedSubjectCode,
  navigate,
  requestConfirm,
  setConceptDescriptionDraft,
  setConceptError,
  setConceptKnowledgeNodeRegenerating,
  setConceptKnowledgeNodeRegeneratingId,
  setConceptTitleDraft,
  setConcepts,
  setConceptSaving,
  setIsChatOpen,
  setMindMapRefreshToken,
  setNoteGroupMode,
  setReviewSummary,
  setSelectedConceptId,
  setSidebarError,
  setSidebarScope
}) {
  const handleSaveConcept = async () => {
    if (!canManageSelectedSubject) {
      setConceptError(
        canUseProtectedActions ? "Maintainer access is required to edit concepts." : "Sign in to edit concepts."
      );
      return;
    }
    if (!selectedConceptId) {
      return;
    }
    const trimmed = conceptTitleDraft.trim();
    if (!trimmed) {
      setConceptError("Concept name cannot be empty.");
      return;
    }
    setConceptSaving(true);
    setConceptError("");
    try {
      const updated = await updateConcept(selectedConceptId, {
        label: trimmed,
        description: conceptDescriptionDraft.trim() || null
      });
      setConcepts((prev) => prev.map((concept) => (concept.id === updated.id ? updated : concept)));
      setConceptTitleDraft(updated.label || "");
      setConceptDescriptionDraft(updated.description || "");
    } catch (error) {
      setConceptError(error.message || "Failed to update concept");
    } finally {
      setConceptSaving(false);
    }
  };

  const handleDeleteConcept = async () => {
    if (!canManageSelectedSubject) {
      setSidebarError(
        canUseProtectedActions ? "Maintainer access is required to delete concepts." : "Sign in to delete concepts."
      );
      return;
    }
    if (!selectedConceptId) {
      return;
    }
    const conceptLabel = selectedConcept?.label || "this concept";
    const confirmed = await requestConfirm({
      title: `Delete "${conceptLabel}"?`,
      description: "This removes the concept from cards but keeps the cards.",
      confirmLabel: "Delete concept"
    });
    if (!confirmed) {
      return;
    }
    setSidebarError("");
    try {
      await deleteConcept(selectedConceptId);
      setConcepts((prev) => prev.filter((concept) => concept.id !== selectedConceptId));
      setSelectedConceptId("");
      setSidebarScope("concepts");
      setNoteGroupMode("overview");
      setReviewSummary(null);
      setIsChatOpen(false);
      navigate(
        selectedSubjectCode && selectedModuleCode
          ? modulePath(selectedSubjectCode, selectedModuleCode)
          : "/",
        { state: { sidebarScope: "concepts" } }
      );
    } catch (error) {
      setSidebarError(error.message || "Failed to delete concept");
    }
  };

  const handleRegenerateConceptKnowledgeNodes = async (conceptIdOverride = "") => {
    if (!canManageSelectedSubject) {
      setConceptError(
        canUseProtectedActions
          ? "Maintainer access is required to regenerate Knowledge Nodes."
          : "Sign in to regenerate Knowledge Nodes."
      );
      return;
    }
    const targetConceptId = resolveConceptKnowledgeNodeTarget(conceptIdOverride, selectedConceptId);
    if (!targetConceptId || conceptKnowledgeNodeRegenerating) {
      return;
    }
    setConceptKnowledgeNodeRegenerating(true);
    setConceptKnowledgeNodeRegeneratingId(targetConceptId);
    setConceptError("");
    try {
      const updated = await regenerateConceptKnowledgeNodes(targetConceptId);
      setConcepts((prev) => prev.map((concept) => (concept.id === updated.id ? updated : concept)));
      toast.success("Knowledge Nodes regenerated.");
      setMindMapRefreshToken((prev) => prev + 1);
    } catch (error) {
      setConceptError(error.message || "Failed to regenerate Knowledge Nodes");
    } finally {
      setConceptKnowledgeNodeRegenerating(false);
      setConceptKnowledgeNodeRegeneratingId("");
    }
  };

  return {
    handleDeleteConcept,
    handleRegenerateConceptKnowledgeNodes,
    handleSaveConcept
  };
}
