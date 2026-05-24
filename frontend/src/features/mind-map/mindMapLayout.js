import ELK from "elkjs/lib/elk.bundled.js";

const elk = new ELK();

const NODE_WIDTH = 240;
const NODE_HEIGHT = 112;
const ROOT_NODE_HEIGHT = 92;

const relationLabels = {
  contains: "contains",
  defines: "defines",
  part_of: "part of",
  requires: "requires",
  enables: "enables",
  causes: "causes",
  contrasts_with: "contrasts",
  example_of: "example",
  sequence: "then",
  related_to: "related"
};

const conceptTypeLabels = {
  topic: "concept area"
};

function compactTitle(value, fallback) {
  const title = String(value || "").trim();
  return title || fallback;
}

function conceptTypeLabel(value) {
  return conceptTypeLabels[value] || value.replace(/_/g, " ");
}

function conceptBadges(concept) {
  const badges = [];
  if (concept.concept_type) {
    badges.push(conceptTypeLabel(concept.concept_type));
  }
  if (concept.importance) {
    badges.push(concept.importance);
  }
  if (concept.study_card_count) {
    badges.push(`${concept.study_card_count} ${concept.study_card_count === 1 ? "card" : "cards"}`);
  }
  if (concept.note_group_count > 1) {
    badges.push(`${concept.note_group_count} Note Groups`);
  }
  return badges;
}

function emptyGraph(graph) {
  return !graph || !Array.isArray(graph.nodes) || graph.nodes.length === 0;
}

export function buildMindMapElements(graph, { title = "Mind Map" } = {}) {
  if (emptyGraph(graph)) {
    return { nodes: [], edges: [] };
  }

  const graphScope = graph.scope || "module";
  const rootId = `mind-map-root:${graph.note_group_id || graph.module_id || "graph"}`;
  const noteGroups = Array.isArray(graph.note_groups) ? graph.note_groups : [];
  const graphEdges = Array.isArray(graph.edges) ? graph.edges : [];
  const noteGroupById = new Map(noteGroups.map((group) => [group.id, group]));
  const nodes = [
    {
      id: rootId,
      type: "mindMapNode",
      position: { x: 0, y: 0 },
      data: {
        title: compactTitle(title, graphScope === "note_group" ? "Note Group" : "Module"),
        summary: graphScope === "note_group" ? "Note Group root" : "Module root",
        nodeType: "root",
        badges: [graphScope === "note_group" ? "Note Group" : "Module"]
      },
      width: NODE_WIDTH,
      height: ROOT_NODE_HEIGHT
    }
  ];
  const edges = [];
  const conceptIds = new Set(graph.nodes.map((node) => node.id));

  if (graphScope !== "note_group") {
    noteGroups.forEach((group) => {
      const noteGroupNodeId = `mind-map-note-group:${group.id}`;
      nodes.push({
        id: noteGroupNodeId,
        type: "mindMapNode",
        position: { x: 0, y: 0 },
        data: {
          title: compactTitle(group.title, "Untitled Note Group"),
          summary: "Note Group",
          nodeType: "note_group",
          badges: ["Note Group"]
        },
        width: NODE_WIDTH,
        height: ROOT_NODE_HEIGHT
      });
      edges.push({
        id: `mind-map-root-edge:${group.id}`,
        source: rootId,
        target: noteGroupNodeId,
        type: "smoothstep",
        label: "includes",
        data: { relationType: "contains" }
      });
    });
  }

  graph.nodes.forEach((concept) => {
    nodes.push({
      id: concept.id,
      type: "mindMapNode",
      position: { x: 0, y: 0 },
      data: {
        title: compactTitle(concept.title, "Untitled Concept"),
        summary: concept.summary || "",
        nodeType: "concept",
        importance: concept.importance || "supporting",
        badges: conceptBadges(concept),
        studyCardIds: concept.study_card_ids || [],
        noteGroupIds: concept.note_group_ids || []
      },
      width: NODE_WIDTH,
      height: NODE_HEIGHT
    });

    if (graphScope === "note_group") {
      edges.push({
        id: `mind-map-root-edge:${concept.id}`,
        source: rootId,
        target: concept.id,
        type: "smoothstep",
        label: "contains",
        data: { relationType: "contains" }
      });
    } else {
      const linkedNoteGroupIds = Array.isArray(concept.note_group_ids) ? concept.note_group_ids : [];
      linkedNoteGroupIds
        .filter((noteGroupId) => noteGroupById.has(noteGroupId))
        .forEach((noteGroupId) => {
          edges.push({
            id: `mind-map-note-group-edge:${noteGroupId}:${concept.id}`,
            source: `mind-map-note-group:${noteGroupId}`,
            target: concept.id,
            type: "smoothstep",
            label: "contains",
            data: { relationType: "contains" }
          });
        });
    }
  });

  graphEdges
    .filter((edge) => conceptIds.has(edge.source) && conceptIds.has(edge.target))
    .forEach((edge) => {
      const label = edge.label || relationLabels[edge.relation_type] || edge.relation_type || "related";
      edges.push({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: "smoothstep",
        animated: edge.relation_type === "sequence",
        label,
        data: {
          relationType: edge.relation_type,
          confidence: edge.confidence,
          sourceNoteGroupId: edge.source_note_group_id
        }
      });
    });

  return { nodes, edges };
}

export async function layoutMindMapElements(nodes, edges) {
  if (!nodes.length) {
    return { nodes, edges };
  }

  const graph = {
    id: "mind-map",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.spacing.nodeNode": "42",
      "elk.layered.spacing.nodeNodeBetweenLayers": "72",
      "elk.edgeRouting": "SPLINES"
    },
    children: nodes.map((node) => ({
      id: node.id,
      width: node.width || NODE_WIDTH,
      height: node.height || NODE_HEIGHT
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target]
    }))
  };
  const layout = await elk.layout(graph);
  const positioned = new Map((layout.children || []).map((node) => [node.id, node]));

  return {
    nodes: nodes.map((node) => {
      const position = positioned.get(node.id);
      return {
        ...node,
        position: {
          x: position?.x || 0,
          y: position?.y || 0
        }
      };
    }),
    edges
  };
}
