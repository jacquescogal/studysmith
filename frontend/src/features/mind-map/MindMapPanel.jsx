import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ArrowLeft, GitBranch, Loader2, Map, MoreHorizontal, RefreshCw } from "lucide-react";

import { ErrorAlert } from "@/components/common/ErrorAlert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildMindMapElements, layoutMindMapElements } from "./mindMapLayout";

export function MindMapNode({ data }) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const isTopicGroup =
    data.nodeType === "concept_parent_group" ||
    data.nodeType === "concept_current_group" ||
    data.nodeType === "concept_children_group" ||
    data.nodeType === "topic_parent_group" ||
    data.nodeType === "topic_current_group" ||
    data.nodeType === "topic_children_group";
  const fullText = String(data.summary || "").trim();
  const showFullTextTooltip = Boolean(fullText && !isTopicGroup);
  const className = [
    "mind-map-node",
    data.nodeType ? `mind-map-node-${data.nodeType}` : "",
    data.status ? `mind-map-node-status-${data.status}` : "",
    data.importance ? `mind-map-node-${data.importance}` : "",
    data.canOpenTopicMindMap ? "mind-map-node-clickable" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      {isTopicGroup ? (
        <>
          <Handle id="top" className="mind-map-node-handle" type="target" position={Position.Top} />
          <Handle id="bottom" className="mind-map-node-handle" type="source" position={Position.Bottom} />
          <Handle id="right" className="mind-map-node-handle" type="source" position={Position.Right} />
          <Handle id="left" className="mind-map-node-handle" type="target" position={Position.Left} />
        </>
      ) : (
        <Handle id="left" className="mind-map-node-handle" type="target" position={Position.Left} />
      )}
      <div className="mind-map-node-title">{data.title}</div>
      {data.summary ? <div className="mind-map-node-summary">{data.summary}</div> : null}
      {showFullTextTooltip ? (
        <div className="mind-map-node-full-text" role="tooltip">
          {fullText}
        </div>
      ) : null}
      {data.reviewReason ? <div className="mind-map-node-warning">{data.reviewReason}</div> : null}
      {data.badges?.length ? (
        <div className="mind-map-node-badges">
          {data.badges.slice(0, 4).map((badge) => (
            <span key={badge}>{badge}</span>
          ))}
        </div>
      ) : null}
      {data.canRegenerateKnowledgeNodes ? (
        <div className="mind-map-node-actions">
          <button
            className="mind-map-node-menu-trigger"
            type="button"
            aria-label="Concept actions"
            aria-expanded={actionsOpen}
            onClick={(event) => {
              event.stopPropagation();
              setActionsOpen((current) => !current);
            }}
          >
            <MoreHorizontal aria-hidden="true" />
          </button>
          <div className={`mind-map-node-menu ${actionsOpen ? "mind-map-node-menu-open" : ""}`} aria-hidden={!actionsOpen}>
            <button
              className="mind-map-node-menu-item"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setActionsOpen(false);
                data.onRegenerateKnowledgeNodes?.(data.actionTopicId || data.id);
              }}
              disabled={data.regeneratingKnowledgeNodes}
            >
              {data.regeneratingKnowledgeNodes ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Regenerating...
                </>
              ) : (
                "Regenerate"
              )}
            </button>
          </div>
        </div>
      ) : null}
      {!isTopicGroup ? <Handle id="right" className="mind-map-node-handle" type="source" position={Position.Right} /> : null}
    </div>
  );
}

const nodeTypes = {
  mindMapNode: MindMapNode
};

export const MIND_MAP_FIT_VIEW_OPTIONS = { padding: 0.24, duration: 240 };

export function fitMindMapView(flowInstance) {
  flowInstance?.fitView?.(MIND_MAP_FIT_VIEW_OPTIONS);
}

function statusLabel(graph) {
  if (!graph) {
    return "Not loaded";
  }
  if (graph.stale) {
    return "Stale";
  }
  return (graph.status || "not_generated").replace(/_/g, " ");
}

function mindMapViewKey(graph, fallbackTitle = "Mind Map") {
  if (!graph) {
    return `empty:${fallbackTitle}`;
  }
  const scope = graph.scope || "mind_map";
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const parts = [scope, graph.module_id || ""];

  if (scope === "concept" || scope === "topic") {
    const currentTopicGroup = nodes.find(
      (node) => node.node_type === "concept_current_group" || node.node_type === "topic_current_group"
    );
    parts.push(
      graph.concept_id ||
        graph.topic_id ||
        currentTopicGroup?.concept_ids?.[0] ||
        currentTopicGroup?.topic_ids?.[0] ||
        currentTopicGroup?.id ||
        ""
    );
  } else if (scope === "note_group") {
    parts.push(graph.note_group_id || "");
  }

  const key = parts.filter(Boolean).join(":");
  return key || `${scope}:${fallbackTitle}`;
}

export function MindMapPanel({
  graph,
  title = "Mind Map",
  description = "Concept relationships from this study material.",
  loading = false,
  error = "",
  canGenerate = false,
  generating = false,
  onGenerate,
  canRegenerateTopicKnowledgeNodes = false,
  canRegenerateConceptKnowledgeNodes = false,
  regeneratingTopicId = "",
  regeneratingConceptId = "",
  onRegenerateTopicKnowledgeNodes,
  onRegenerateConceptKnowledgeNodes,
  canRegenerateNeedsReview = false,
  regeneratingNeedsReview = false,
  onRegenerateNeedsReview,
  onTopicNodeClick,
  onConceptNodeClick,
  drilldownGraph = null,
  drilldownTitle = "",
  drilldownDescription = "Knowledge Nodes, child Concepts, parent Concept, and Study Cards for this Concept.",
  drilldownLoading = false,
  drilldownError = "",
  onBackFromDrilldown,
  embedded = false
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [layoutError, setLayoutError] = useState("");
  const [flowInstance, setFlowInstance] = useState(null);
  const [showMiniMap, setShowMiniMap] = useState(false);
  const drilldownActive = Boolean(drilldownGraph || drilldownLoading || drilldownError);
  const activeGraph = drilldownActive ? drilldownGraph : graph;
  const activeTitle = drilldownActive ? drilldownTitle || "Concept Mind Map" : title;
  const activeDescription = drilldownActive ? drilldownDescription : description;
  const activeLoading = drilldownActive ? drilldownLoading : loading;
  const activeError = drilldownActive ? drilldownError : error;
  const baseScopeLabel = graph?.scope === "note_group" ? "Note Group" : graph?.scope === "module" ? "Module" : "Mind Map";
  const activeViewKey = useMemo(() => mindMapViewKey(activeGraph, activeTitle), [activeGraph, activeTitle]);
  const handleConceptNodeClick = onConceptNodeClick || onTopicNodeClick;
  const canOpenTopicMindMap = Boolean(
    handleConceptNodeClick && (!drilldownActive || activeGraph?.scope === "concept" || activeGraph?.scope === "topic")
  );
  const elementInput = useMemo(
    () =>
      buildMindMapElements(activeGraph, {
        title: activeTitle,
        canRegenerateTopicKnowledgeNodes,
        canRegenerateConceptKnowledgeNodes,
        canOpenTopicMindMap,
        canOpenConceptMindMap: canOpenTopicMindMap,
        regeneratingTopicId,
        regeneratingConceptId,
        onRegenerateTopicKnowledgeNodes,
        onRegenerateConceptKnowledgeNodes
      }),
    [
      activeGraph,
      activeTitle,
      canOpenTopicMindMap,
      canRegenerateConceptKnowledgeNodes,
      canRegenerateTopicKnowledgeNodes,
      onRegenerateConceptKnowledgeNodes,
      onRegenerateTopicKnowledgeNodes,
      regeneratingConceptId,
      regeneratingTopicId
    ]
  );
  const hasGraph = elementInput.nodes.length > 0;
  const activeRegeneratingConceptId = regeneratingConceptId || regeneratingTopicId;
  const graphRegenerating = Boolean(generating || regeneratingNeedsReview || activeRegeneratingConceptId || drilldownLoading);
  const needsReviewCount = useMemo(
    () =>
      Array.isArray(activeGraph?.nodes)
        ? activeGraph.nodes.filter(
            (node) =>
              (node.node_type === "concept" || node.node_type === "topic") &&
              node.knowledge_node_status === "needs_review"
          ).length
        : 0,
    [activeGraph]
  );
  const handleNodeClick = useCallback(
    (_event, node) => {
      if (!canOpenTopicMindMap || graphRegenerating || !node?.data?.canOpenTopicMindMap) {
        return;
      }
      handleConceptNodeClick?.({
        topicId: node.data.id,
        conceptId: node.data.id,
        title: node.data.title
      });
    },
    [canOpenTopicMindMap, graphRegenerating, handleConceptNodeClick]
  );
  const showGenerateAction = !embedded && !drilldownActive && canGenerate;
  const showRegenerateNeedsReviewAction =
    !embedded && !drilldownActive && canRegenerateNeedsReview && needsReviewCount;
  const actions = (
    <>
      {drilldownActive ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mind-map-back-button"
          onClick={onBackFromDrilldown}
        >
          <ArrowLeft />
          Back to {baseScopeLabel} Mind Map
        </Button>
      ) : null}
      {showGenerateAction ? (
        <Button type="button" variant="outline" size="sm" onClick={onGenerate} disabled={generating || activeLoading}>
          {generating ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          {activeGraph?.status === "complete" ? "Regenerate" : "Generate"}
        </Button>
      ) : null}
      {showRegenerateNeedsReviewAction ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRegenerateNeedsReview}
          disabled={regeneratingNeedsReview || loading}
        >
          {regeneratingNeedsReview ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          Regenerate Needs Review
        </Button>
      ) : null}
    </>
  );
  const hasActions = Boolean(drilldownActive || showGenerateAction || showRegenerateNeedsReviewAction);
  const content = (
    <>
      <ErrorAlert title="Mind Map failed" message={activeError || layoutError} />
      {activeLoading ? (
        <div className="mind-map-empty-state">
          <Loader2 className="animate-spin" />
          <span>Loading Mind Map...</span>
        </div>
      ) : hasGraph ? (
        <div
          className={`mind-map-flow ${graphRegenerating ? "mind-map-flow-regenerating" : ""}`}
          aria-label={activeTitle}
          data-mind-map-view-key={activeViewKey}
        >
          <ReactFlow
            key={activeViewKey}
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onInit={setFlowInstance}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            fitView
            fitViewOptions={MIND_MAP_FIT_VIEW_OPTIONS}
            minZoom={0.25}
            maxZoom={1.5}
            nodesDraggable={!graphRegenerating}
            nodesConnectable={false}
            elementsSelectable={!graphRegenerating}
            panOnDrag={!graphRegenerating}
            zoomOnScroll={!graphRegenerating}
            zoomOnPinch={!graphRegenerating}
            >
              <Background gap={28} size={1} />
              <Controls showInteractive={false} />
              {showMiniMap ? <MiniMap pannable zoomable nodeStrokeWidth={3} /> : null}
            </ReactFlow>
          <button
            type="button"
            className="mind-map-minimap-toggle"
            aria-label={showMiniMap ? "Hide minimap" : "Show minimap"}
            aria-pressed={showMiniMap}
            onClick={() => setShowMiniMap((current) => !current)}
          >
            <Map aria-hidden="true" />
          </button>
          {hasActions ? <div className="mind-map-floating-actions">{actions}</div> : null}
          {graphRegenerating ? (
            <div className="mind-map-regeneration-overlay" role="status" aria-live="polite">
              <Loader2 className="animate-spin" />
              <span>Regenerating Mind Map...</span>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mind-map-empty-state">
          <GitBranch />
          <span>No Mind Map generated yet.</span>
          {hasActions ? <div className="mind-map-floating-actions">{actions}</div> : null}
        </div>
      )}
    </>
  );

  useEffect(() => {
    let active = true;
    setLayoutError("");
    if (!elementInput.nodes.length) {
      setNodes([]);
      setEdges([]);
      return () => {
        active = false;
      };
    }

    layoutMindMapElements(elementInput.nodes, elementInput.edges)
      .then((layout) => {
        if (!active) {
          return;
        }
        setNodes(layout.nodes);
        setEdges(layout.edges);
      })
      .catch((layoutException) => {
        if (!active) {
          return;
        }
        setLayoutError(layoutException?.message || "Unable to lay out the mind map.");
        setNodes(elementInput.nodes);
        setEdges(elementInput.edges);
      });

    return () => {
      active = false;
    };
  }, [elementInput, setEdges, setNodes]);

  useEffect(() => {
    if (!flowInstance || activeLoading || !nodes.length) {
      return undefined;
    }

    let cancelled = false;
    let animationFrameId = 0;
    let timeoutId = 0;
    const fitView = () => {
      if (!cancelled) {
        fitMindMapView(flowInstance);
      }
    };

    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      animationFrameId = window.requestAnimationFrame(() => {
        timeoutId = window.setTimeout(fitView, 0);
      });
    } else {
      timeoutId = setTimeout(fitView, 0);
    }

    return () => {
      cancelled = true;
      if (animationFrameId && typeof window !== "undefined" && typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(animationFrameId);
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [activeLoading, activeViewKey, flowInstance, nodes]);

  useEffect(() => {
    setShowMiniMap(false);
  }, [activeViewKey]);

  if (embedded) {
    return <div className="mind-map-panel-embedded">{content}</div>;
  }

  return (
    <Card className="mind-map-panel">
      <CardHeader className="mind-map-panel-header">
        <div className="mind-map-panel-heading">
          <div>
            {drilldownActive ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mind-map-back-button"
                onClick={onBackFromDrilldown}
              >
                <ArrowLeft />
                Back to {baseScopeLabel} Mind Map
              </Button>
            ) : null}
            <CardTitle>{activeTitle}</CardTitle>
            <CardDescription>{activeDescription}</CardDescription>
          </div>
          <div className="mind-map-panel-actions">
            <Badge variant="outline" className="mind-map-status-badge">
              {activeLoading ? "Loading" : statusLabel(activeGraph)}
            </Badge>
            {actions}
          </div>
        </div>
      </CardHeader>
      <CardContent className="mind-map-panel-content">
        {content}
      </CardContent>
    </Card>
  );
}
