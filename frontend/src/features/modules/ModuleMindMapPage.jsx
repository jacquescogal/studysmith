import { MindMapPanel } from "@/features/mind-map/MindMapPanel";
import { PageMindMapCard } from "@/features/mind-map/PageMindMapCard";

export function ModuleMindMapPage({
  moduleTitle,
  graph,
  loading,
  error,
  canRegenerateTopicKnowledgeNodes,
  regeneratingTopicId,
  onRegenerateTopicKnowledgeNodes,
  canRegenerateNeedsReview,
  regeneratingNeedsReview,
  onRegenerateNeedsReview,
  onTopicNodeClick,
  drilldownGraph,
  drilldownTitle,
  drilldownLoading,
  drilldownError,
  onBackFromDrilldown
}) {
  return (
    <PageMindMapCard id="module-mind-map">
      <MindMapPanel
        embedded
        graph={graph}
        title={`${moduleTitle || "Module"} Mind Map`}
        description="Concepts across generated Note Group Mind Maps in this module."
        loading={loading}
        error={error}
        canRegenerateTopicKnowledgeNodes={canRegenerateTopicKnowledgeNodes}
        regeneratingTopicId={regeneratingTopicId}
        onRegenerateTopicKnowledgeNodes={onRegenerateTopicKnowledgeNodes}
        canRegenerateNeedsReview={canRegenerateNeedsReview}
        regeneratingNeedsReview={regeneratingNeedsReview}
        onRegenerateNeedsReview={onRegenerateNeedsReview}
        onTopicNodeClick={onTopicNodeClick}
        drilldownGraph={drilldownGraph}
        drilldownTitle={drilldownTitle}
        drilldownLoading={drilldownLoading}
        drilldownError={drilldownError}
        onBackFromDrilldown={onBackFromDrilldown}
      />
    </PageMindMapCard>
  );
}
