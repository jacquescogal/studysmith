export function resolveConceptKnowledgeNodeTarget(conceptIdOverride, selectedConceptId) {
  return typeof conceptIdOverride === "string" && conceptIdOverride.trim()
    ? conceptIdOverride.trim()
    : selectedConceptId;
}
