import { useEffect, useMemo, useState } from "react";
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
import { GitBranch, Loader2, RefreshCw } from "lucide-react";

import { ErrorAlert } from "@/components/common/ErrorAlert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildMindMapElements, layoutMindMapElements } from "./mindMapLayout";

export function MindMapNode({ data }) {
  const className = [
    "mind-map-node",
    data.nodeType ? `mind-map-node-${data.nodeType}` : "",
    data.importance ? `mind-map-node-${data.importance}` : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      <Handle className="mind-map-node-handle" type="target" position={Position.Left} />
      <div className="mind-map-node-title">{data.title}</div>
      {data.summary ? <div className="mind-map-node-summary">{data.summary}</div> : null}
      {data.badges?.length ? (
        <div className="mind-map-node-badges">
          {data.badges.slice(0, 4).map((badge) => (
            <span key={badge}>{badge}</span>
          ))}
        </div>
      ) : null}
      {data.canRegenerateKnowledgeNodes ? (
        <button
          className="mind-map-node-action"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            data.onRegenerateKnowledgeNodes?.(data.id);
          }}
          disabled={data.regeneratingKnowledgeNodes}
        >
          {data.regeneratingKnowledgeNodes ? "Regenerating..." : "Regenerate Knowledge Nodes"}
        </button>
      ) : null}
      <Handle className="mind-map-node-handle" type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = {
  mindMapNode: MindMapNode
};

function statusLabel(graph) {
  if (!graph) {
    return "Not loaded";
  }
  if (graph.stale) {
    return "Stale";
  }
  return (graph.status || "not_generated").replace(/_/g, " ");
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
  regeneratingTopicId = "",
  onRegenerateTopicKnowledgeNodes
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [layoutError, setLayoutError] = useState("");
  const elementInput = useMemo(
    () =>
      buildMindMapElements(graph, {
        title,
        canRegenerateTopicKnowledgeNodes,
        regeneratingTopicId,
        onRegenerateTopicKnowledgeNodes
      }),
    [canRegenerateTopicKnowledgeNodes, graph, onRegenerateTopicKnowledgeNodes, regeneratingTopicId, title]
  );
  const hasGraph = elementInput.nodes.length > 0;

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

  return (
    <Card className="mind-map-panel">
      <CardHeader className="mind-map-panel-header">
        <div className="mind-map-panel-heading">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="mind-map-panel-actions">
            <Badge variant="outline" className="mind-map-status-badge">
              {loading ? "Loading" : statusLabel(graph)}
            </Badge>
            {canGenerate ? (
              <Button type="button" variant="outline" size="sm" onClick={onGenerate} disabled={generating || loading}>
                {generating ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                {graph?.status === "complete" ? "Regenerate" : "Generate"}
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="mind-map-panel-content">
        <ErrorAlert title="Mind Map failed" message={error || layoutError} />
        {loading ? (
          <div className="mind-map-empty-state">
            <Loader2 className="animate-spin" />
            <span>Loading Mind Map...</span>
          </div>
        ) : hasGraph ? (
          <div className="mind-map-flow" aria-label={title}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              fitView
              fitViewOptions={{ padding: 0.18 }}
              minZoom={0.25}
              maxZoom={1.5}
              nodesDraggable
              nodesConnectable={false}
              elementsSelectable
            >
              <Background gap={28} size={1} />
              <Controls showInteractive={false} />
              <MiniMap pannable zoomable nodeStrokeWidth={3} />
            </ReactFlow>
          </div>
        ) : (
          <div className="mind-map-empty-state">
            <GitBranch />
            <span>No Mind Map generated yet.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
