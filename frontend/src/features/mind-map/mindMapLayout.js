import { MarkerType } from "@xyflow/react";
import ELK from "elkjs/lib/elk.bundled.js";

const elk = new ELK();

const NODE_WIDTH = 260;
const STANDARD_CONCEPT_NODE_WIDTH = 280;
const NODE_HEIGHT = 148;
const ROOT_NODE_HEIGHT = 132;
const NOTE_GROUP_NODE_HEIGHT = 120;
const TOPIC_NODE_HEIGHT = 164;
const RELATIONSHIP_NODE_WIDTH = 120;
const RELATIONSHIP_NODE_HEIGHT = 58;
const TOPIC_GROUP_MIN_WIDTH = 320;
const TOPIC_GROUP_HEADER_HEIGHT = 64;
const TOPIC_CURRENT_GROUP_HEADER_HEIGHT = 96;
const TOPIC_GROUP_CHILD_GAP = 28;
const TOPIC_GROUP_PADDING = 24;
const TOPIC_GROUP_MAX_COLUMNS = 3;
const TOPIC_TREE_COMPACT_TOPIC_HEIGHT = 48;
const TOPIC_TREE_VERTICAL_GAP = 110;
const TOPIC_TREE_STUDY_CARD_GAP = 28;
const TOPIC_TREE_STUDY_CARD_OFFSET = 170;
const NODE_VERTICAL_GAP = 88;
const NODE_LAYER_GAP = 140;

const conceptTypeLabels = {
  concept: "concept area",
  topic: "concept area"
};

function directedEdge(edge) {
  const { label: _label, ...edgeWithoutLabel } = edge;
  return {
    ...edgeWithoutLabel,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 18,
      height: 18,
      color: "#64748b"
    }
  };
}

function compactTitle(value, fallback) {
  const title = String(value || "").trim();
  return title || fallback;
}

function conceptTypeLabel(value) {
  return conceptTypeLabels[value] || value.replace(/_/g, " ");
}

function studyCardCountBadges(node) {
  const badges = [];
  const hasAggregateCountSet =
    Object.hasOwn(node, "direct_study_card_count") &&
    Object.hasOwn(node, "descendant_study_card_count") &&
    Object.hasOwn(node, "total_study_card_count");
  const hasMeaningfulAggregateCounts =
    hasAggregateCountSet &&
    (Number(node.direct_study_card_count || 0) > 0 ||
      Number(node.descendant_study_card_count || 0) > 0 ||
      Number(node.total_study_card_count || 0) > 0 ||
      !node.study_card_count);
  if (hasMeaningfulAggregateCounts && Object.hasOwn(node, "direct_study_card_count")) {
    badges.push(`${node.direct_study_card_count} direct ${node.direct_study_card_count === 1 ? "card" : "cards"}`);
  }
  if (hasMeaningfulAggregateCounts && Object.hasOwn(node, "descendant_study_card_count")) {
    badges.push(`${node.descendant_study_card_count} descendant ${node.descendant_study_card_count === 1 ? "card" : "cards"}`);
  }
  if (hasMeaningfulAggregateCounts && Object.hasOwn(node, "total_study_card_count")) {
    badges.push(`${node.total_study_card_count} total ${node.total_study_card_count === 1 ? "card" : "cards"}`);
  }
  if (!badges.length && node.study_card_count) {
    badges.push(`${node.study_card_count} ${node.study_card_count === 1 ? "card" : "cards"}`);
  }
  return badges;
}

function conceptBadges(concept) {
  const badges = studyCardCountBadges(concept);
  if (concept.concept_type) {
    badges.push(conceptTypeLabel(concept.concept_type));
  }
  if (concept.importance) {
    badges.push(concept.importance);
  }
  if (concept.note_group_count > 1) {
    badges.push(`${concept.note_group_count} Note Groups`);
  }
  return badges;
}

function countBadge(count, singular, plural) {
  return count ? `${count} ${count === 1 ? singular : plural}` : null;
}

function topicBadges(topic) {
  return [
    ...studyCardCountBadges(topic),
    topic.knowledge_node_status === "needs_review" ? "Needs review" : null,
    "Concept",
    topic.note_group_count > 1 ? `${topic.note_group_count} Note Groups` : null
  ].filter(Boolean);
}

function knowledgeNodeBadges(node) {
  return [
    node.knowledge_type,
    node.importance,
    countBadge(node.study_card_count, "card", "cards"),
    node.note_group_count > 1 ? `${node.note_group_count} Note Groups` : null
  ].filter(Boolean);
}

function estimatedLineCount(value, charsPerLine, maxLines) {
  const text = String(value || "").trim();
  if (!text) {
    return 0;
  }
  return Math.max(1, Math.min(maxLines, Math.ceil(text.length / charsPerLine)));
}

function estimatedBadgeRows(badges, contentWidth = 206) {
  const visibleBadges = (badges || []).slice(0, 4);
  if (!visibleBadges.length) {
    return 0;
  }

  let rows = 1;
  let rowWidth = 0;
  visibleBadges.forEach((badge) => {
    const badgeWidth = Math.min(contentWidth, Math.max(44, String(badge).length * 5.5 + 14));
    const nextWidth = rowWidth ? rowWidth + 5 + badgeWidth : badgeWidth;
    if (nextWidth > contentWidth && rowWidth) {
      rows += 1;
      rowWidth = badgeWidth;
      return;
    }
    rowWidth = nextWidth;
  });
  return rows;
}

function estimateMindMapNodeHeight(data, nodeWidth = NODE_WIDTH) {
  const titleLines = estimatedLineCount(data.title, 30, 3);
  const summaryLines = estimatedLineCount(data.summary, 42, 3);
  const warningLines = estimatedLineCount(data.reviewReason, 38, 2);
  const badgeRows = estimatedBadgeRows(data.badges, nodeWidth - 54);
  const actionHeight = 0;
  const baseHeight =
    28 +
    titleLines * 20 +
    (summaryLines ? 7 + summaryLines * 17 : 0) +
    (warningLines ? 7 + warningLines * 17 : 0) +
    (badgeRows ? 10 + badgeRows * 22 : 0) +
    actionHeight;

  if (data.nodeType === "root") {
    return Math.max(ROOT_NODE_HEIGHT, baseHeight);
  }
  if (data.nodeType === "note_group") {
    return Math.max(NOTE_GROUP_NODE_HEIGHT, baseHeight);
  }
  if (data.nodeType === "concept" || data.nodeType === "topic") {
    return Math.max(TOPIC_NODE_HEIGHT, baseHeight);
  }
  if (data.nodeType === "relationship") {
    return RELATIONSHIP_NODE_HEIGHT;
  }
  if (
    data.nodeType === "concept_parent_group" ||
    data.nodeType === "concept_current_group" ||
    data.nodeType === "concept_children_group" ||
    data.nodeType === "topic_parent_group" ||
    data.nodeType === "topic_current_group" ||
    data.nodeType === "topic_children_group"
  ) {
    return topicGroupHeaderHeight(data.nodeType) + TOPIC_GROUP_PADDING;
  }
  return Math.max(NODE_HEIGHT, baseHeight);
}

function estimateTopicTreeNodeHeight(data) {
  if (
    data.nodeType === "concept_parent" ||
    data.nodeType === "concept_child" ||
    data.nodeType === "topic_parent" ||
    data.nodeType === "topic_child"
  ) {
    const titleLines = estimatedLineCount(data.title, 30, 2);
    const badgeRows = Math.ceil((data.badges || []).length / 2);
    const compactHeight =
      22 +
      Math.max(1, titleLines) * 17 +
      (badgeRows ? 8 + badgeRows * 20 : 0);
    return Math.max(TOPIC_TREE_COMPACT_TOPIC_HEIGHT, compactHeight);
  }
  return estimateMindMapNodeHeight(data);
}

function emptyGraph(graph) {
  return !graph || !Array.isArray(graph.nodes) || graph.nodes.length === 0;
}

function hasTopicTreeNodes(graph) {
  return graph.nodes.some((node) => node.node_type === "concept" || node.node_type === "topic");
}

function isConceptTreeGroup(nodeType) {
  return [
    "concept_parent_group",
    "concept_current_group",
    "concept_children_group",
    "topic_parent_group",
    "topic_current_group",
    "topic_children_group"
  ].includes(nodeType);
}

function isCurrentConceptGroup(nodeType) {
  return nodeType === "concept_current_group" || nodeType === "topic_current_group";
}

function topicGroupHeaderHeight(nodeType) {
  return isCurrentConceptGroup(nodeType) ? TOPIC_CURRENT_GROUP_HEADER_HEIGHT : TOPIC_GROUP_HEADER_HEIGHT;
}

function isParentConceptGroup(nodeType) {
  return nodeType === "concept_parent_group" || nodeType === "topic_parent_group";
}

function isConceptTreeLinkNode(nodeType) {
  return ["concept_parent", "concept_child", "topic_parent", "topic_child"].includes(nodeType);
}

export function buildMindMapElements(
  graph,
  {
    title = "Mind Map",
    canRegenerateTopicKnowledgeNodes = false,
    canRegenerateConceptKnowledgeNodes = false,
    canOpenTopicMindMap = false,
    canOpenConceptMindMap = false,
    onRegenerateTopicKnowledgeNodes,
    onRegenerateConceptKnowledgeNodes,
    regeneratingTopicId = "",
    regeneratingConceptId = ""
  } = {}
) {
  if (emptyGraph(graph)) {
    return { nodes: [], edges: [] };
  }

  const graphScope = graph.scope === "topic" ? "concept" : graph.scope || "module";
  const canRegenerateKnowledgeNodes =
    canRegenerateConceptKnowledgeNodes || canRegenerateTopicKnowledgeNodes;
  const canOpenConceptDrilldown = canOpenConceptMindMap || canOpenTopicMindMap;
  const regenerateKnowledgeNodes = onRegenerateConceptKnowledgeNodes || onRegenerateTopicKnowledgeNodes;
  const regeneratingKnowledgeNodeConceptId = regeneratingConceptId || regeneratingTopicId;
  const rootId = `mind-map-root:${graph.note_group_id || graph.module_id || "graph"}`;
  const noteGroups = Array.isArray(graph.note_groups) ? graph.note_groups : [];
  const graphEdges = Array.isArray(graph.edges) ? graph.edges : [];
  const noteGroupById = new Map(noteGroups.map((group) => [group.id, group]));

  if (graphScope === "concept") {
    const groupNodes = graph.nodes.filter((node) => isConceptTreeGroup(node.node_type));
    const currentGroup = groupNodes.find((node) => isCurrentConceptGroup(node.node_type));
    const parentGroup = groupNodes.find((node) => isParentConceptGroup(node.node_type));
    const childrenGroup = groupNodes.find((node) => node.node_type === "concept_children_group" || node.node_type === "topic_children_group");
    const groupNodeById = new Map(groupNodes.map((node) => [node.id, node]));
    const groupedNodesByParentId = new Map();
    const studyCardNodes = [];

    graph.nodes
      .filter((node) => !isConceptTreeGroup(node.node_type))
      .forEach((node) => {
        if (node.node_type === "study_card") {
          studyCardNodes.push(node);
          return;
        }
        if (!node.parent_group_id) {
          return;
        }
        if (!groupedNodesByParentId.has(node.parent_group_id)) {
          groupedNodesByParentId.set(node.parent_group_id, []);
        }
        groupedNodesByParentId.get(node.parent_group_id).push(node);
      });

    const topicTreeNodeData = (item) => ({
      id: item.id,
      title: compactTitle(item.title, "Untitled"),
      summary: item.summary || "",
      nodeType: item.node_type,
      status: item.knowledge_node_status,
      reviewReason: item.knowledge_node_review_reason,
      importance: item.importance,
      badges: item.node_type === "knowledge_node" ? knowledgeNodeBadges(item) : topicBadges(item),
      studyCardIds: item.study_card_ids || [],
      noteGroupIds: item.note_group_ids || [],
      canOpenTopicMindMap: Boolean(canOpenConceptDrilldown && isConceptTreeLinkNode(item.node_type)),
      canOpenConceptMindMap: Boolean(canOpenConceptDrilldown && isConceptTreeLinkNode(item.node_type)),
      layoutMode: "concept_tree"
    });
    const groupMetrics = (groupId) => {
      const children = groupedNodesByParentId.get(groupId) || [];
      const columnCount = Math.min(TOPIC_GROUP_MAX_COLUMNS, Math.max(1, children.length));
      const rowHeights = [];
      children.forEach((child, index) => {
        const rowIndex = Math.floor(index / TOPIC_GROUP_MAX_COLUMNS);
        const childHeight = estimateTopicTreeNodeHeight(topicTreeNodeData(child));
        rowHeights[rowIndex] = Math.max(rowHeights[rowIndex] || 0, childHeight);
      });
      const contentHeight = rowHeights.length
        ? rowHeights.reduce((total, rowHeight) => total + rowHeight, 0) +
          Math.max(0, rowHeights.length - 1) * TOPIC_GROUP_CHILD_GAP
        : 0;
      const headerHeight = topicGroupHeaderHeight(groupNodeById.get(groupId)?.node_type);
      return {
        children,
        columnCount,
        rowHeights,
        width: Math.max(
          TOPIC_GROUP_MIN_WIDTH,
          TOPIC_GROUP_PADDING * 2 + columnCount * NODE_WIDTH + Math.max(0, columnCount - 1) * TOPIC_GROUP_CHILD_GAP
        ),
        height: Math.max(
          headerHeight + TOPIC_GROUP_PADDING,
          headerHeight + contentHeight + TOPIC_GROUP_PADDING
        )
      };
    };
    const currentGroupMetrics = currentGroup ? groupMetrics(currentGroup.id) : { width: TOPIC_GROUP_MIN_WIDTH, height: 0 };
    const parentGroupMetrics = parentGroup ? groupMetrics(parentGroup.id) : { width: 0, height: 0 };
    const childrenGroupMetrics = childrenGroup ? groupMetrics(childrenGroup.id) : { width: 0, height: 0 };
    const currentGroupWidth = currentGroupMetrics.width;
    const parentGroupWidth = parentGroupMetrics.width;
    const childrenGroupWidth = childrenGroupMetrics.width;
    const currentX = Math.max(
      80,
      (parentGroupWidth - currentGroupWidth) / 2 + 80,
      (childrenGroupWidth - currentGroupWidth) / 2 + 80
    );
    const currentY = parentGroup ? parentGroupMetrics.height + TOPIC_TREE_VERTICAL_GAP : 0;

    const groupPosition = (group) => {
      if (!group || isCurrentConceptGroup(group.node_type)) {
        return { x: currentX, y: currentY };
      }
      const width = groupMetrics(group.id).width;
      if (isParentConceptGroup(group.node_type)) {
        return { x: currentX + (currentGroupWidth - width) / 2, y: 0 };
      }
      return {
        x: currentX + (currentGroupWidth - width) / 2,
        y: currentY + currentGroupMetrics.height + TOPIC_TREE_VERTICAL_GAP
      };
    };

    const nodeIds = new Set(graph.nodes.map((node) => node.id));
    const nodes = [];

    groupNodes.forEach((item) => {
      const metrics = groupMetrics(item.id);
      const nodeData = {
        id: item.id,
        title: compactTitle(item.title, "Untitled"),
        summary: "",
        nodeType: item.node_type,
        status: item.knowledge_node_status,
        reviewReason: item.knowledge_node_review_reason,
        importance: item.importance,
        badges: isCurrentConceptGroup(item.node_type) ? topicBadges(item) : [],
        actionTopicId: item.concept_ids?.[0] || item.topic_ids?.[0] || item.id,
        actionConceptId: item.concept_ids?.[0] || item.topic_ids?.[0] || item.id,
        canRegenerateKnowledgeNodes: Boolean(isCurrentConceptGroup(item.node_type) && canRegenerateKnowledgeNodes),
        onRegenerateKnowledgeNodes: isCurrentConceptGroup(item.node_type) ? regenerateKnowledgeNodes : undefined,
        regeneratingKnowledgeNodes: Boolean(
          isCurrentConceptGroup(item.node_type) &&
            (item.concept_ids || item.topic_ids || [item.id]).includes(regeneratingKnowledgeNodeConceptId)
        ),
        layoutMode: "concept_tree"
      };
      nodes.push({
        id: item.id,
        type: "mindMapNode",
        position: groupPosition(item),
        data: nodeData,
        width: metrics.width,
        height: metrics.height,
        selectable: false,
        draggable: false,
        zIndex: 0
      });

      const children = metrics.children;
      const parentPosition = groupPosition(item);
      const headerHeight = topicGroupHeaderHeight(item.node_type);
      children.forEach((item, index) => {
        const nodeData = topicTreeNodeData(item);
        const rowIndex = Math.floor(index / TOPIC_GROUP_MAX_COLUMNS);
        const columnIndex = index % TOPIC_GROUP_MAX_COLUMNS;
        const previousRowsHeight = metrics.rowHeights
          .slice(0, rowIndex)
          .reduce((total, rowHeight) => total + rowHeight + TOPIC_GROUP_CHILD_GAP, 0);
        nodes.push({
          id: item.id,
          type: "mindMapNode",
          position: {
            x: parentPosition.x + TOPIC_GROUP_PADDING + columnIndex * (NODE_WIDTH + TOPIC_GROUP_CHILD_GAP),
            y: parentPosition.y + headerHeight + previousRowsHeight
          },
          data: nodeData,
          width: NODE_WIDTH,
          height: estimateTopicTreeNodeHeight(nodeData),
          zIndex: 2
        });
      });
    });

    studyCardNodes.forEach((item, index) => {
      const nodeData = {
        id: item.id,
        title: compactTitle(item.title, "Untitled Study Card"),
        summary: item.summary || "",
        nodeType: item.node_type,
        badges: ["Study Card"],
        studyCardIds: item.study_card_ids || [],
        layoutMode: "concept_tree"
      };
      nodes.push({
        id: item.id,
        type: "mindMapNode",
        position: {
          x: currentX + currentGroupWidth + TOPIC_TREE_STUDY_CARD_OFFSET,
          y: currentY + index * (NODE_HEIGHT + TOPIC_TREE_STUDY_CARD_GAP)
        },
        data: nodeData,
        width: NODE_WIDTH,
        height: estimateMindMapNodeHeight(nodeData),
        zIndex: 2
      });
    });

    const edges = graphEdges
      .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
      .map((edge) => directedEdge({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.relation_type === "parent_of" ? "bottom" : "right",
        targetHandle: edge.relation_type === "parent_of" ? "top" : "left",
        type: "smoothstep",
        animated: false,
        data: {
          relationType: edge.relation_type,
          confidence: edge.confidence,
          sourceNoteGroupId: edge.source_note_group_id
        }
      }));
    return { nodes, edges };
  }

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

  if (hasTopicTreeNodes(graph)) {
    const topics = graph.nodes.filter((node) => node.node_type === "concept" || node.node_type === "topic");
    const topicIds = new Set(topics.map((node) => node.id));
    const nodeIds = new Set([rootId, ...topicIds]);
    const definitionSummaryByTopicId = new Map();

    graph.nodes
      .filter(
        (node) =>
          node.node_type === "knowledge_node" &&
          node.knowledge_type === "definition" &&
          (node.parent_concept_id || node.parent_topic_id) &&
          node.summary
      )
      .forEach((node) => {
        const parentConceptId = node.parent_concept_id || node.parent_topic_id;
        if (!definitionSummaryByTopicId.has(parentConceptId)) {
          definitionSummaryByTopicId.set(parentConceptId, node.summary);
        }
      });

    topics.forEach((item) => {
      const nodeData = {
        id: item.id,
        title: compactTitle(item.title, "Untitled Concept"),
        summary: definitionSummaryByTopicId.get(item.id) || "",
        nodeType: "concept",
        status: item.knowledge_node_status,
        reviewReason: item.knowledge_node_review_reason,
        importance: item.importance,
        badges: topicBadges(item),
        studyCardIds: item.study_card_ids || [],
        noteGroupIds: item.note_group_ids || [],
        canOpenTopicMindMap: Boolean(canOpenConceptDrilldown),
        canOpenConceptMindMap: Boolean(canOpenConceptDrilldown),
        canRegenerateKnowledgeNodes: Boolean(canRegenerateKnowledgeNodes),
        onRegenerateKnowledgeNodes: regenerateKnowledgeNodes,
        regeneratingKnowledgeNodes: Boolean(regeneratingKnowledgeNodeConceptId === item.id)
      };
      nodes.push({
        id: item.id,
        type: "mindMapNode",
        position: { x: 0, y: 0 },
        data: nodeData,
        width: STANDARD_CONCEPT_NODE_WIDTH,
        height: estimateMindMapNodeHeight(nodeData, STANDARD_CONCEPT_NODE_WIDTH)
      });
    });

    graph.nodes
      .filter((item) => item.node_type === "concept" || item.node_type === "topic")
      .forEach((topic) => {
        const parentTopicId = topic.parent_concept_id || topic.parent_topic_id;
        if (parentTopicId && topicIds.has(parentTopicId)) {
          edges.push(directedEdge({
            id: `mind-map-topic-edge:${parentTopicId}:${topic.id}`,
            source: parentTopicId,
            target: topic.id,
            type: "smoothstep",
            data: { relationType: "contains" }
          }));
          return;
        }
        edges.push(directedEdge({
          id: `mind-map-root-edge:${topic.id}`,
          source: rootId,
          target: topic.id,
          type: "smoothstep",
          data: { relationType: "contains" }
        }));
      });

    graphEdges
      .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
      .forEach((edge) => {
        edges.push(directedEdge({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: "smoothstep",
          animated: edge.relation_type === "sequence",
          data: {
            relationType: edge.relation_type,
            confidence: edge.confidence,
            sourceNoteGroupId: edge.source_note_group_id
          }
        }));
      });

    return { nodes, edges };
  }

  if (graphScope !== "note_group") {
    noteGroups.forEach((group) => {
      const noteGroupNodeId = `mind-map-note-group:${group.id}`;
      const nodeData = {
        title: compactTitle(group.title, "Untitled Note Group"),
        summary: "Note Group",
        nodeType: "note_group",
        badges: ["Note Group"]
      };
      nodes.push({
        id: noteGroupNodeId,
        type: "mindMapNode",
        position: { x: 0, y: 0 },
        data: nodeData,
        width: NODE_WIDTH,
        height: estimateMindMapNodeHeight(nodeData)
      });
      edges.push(directedEdge({
        id: `mind-map-root-edge:${group.id}`,
        source: rootId,
        target: noteGroupNodeId,
        type: "smoothstep",
        data: { relationType: "contains" }
      }));
    });
  }

  graph.nodes.forEach((concept) => {
    const nodeData = {
      title: compactTitle(concept.title, "Untitled Concept"),
      summary: concept.summary || "",
      nodeType: "concept",
      importance: concept.importance || "supporting",
      badges: conceptBadges(concept),
      studyCardIds: concept.study_card_ids || [],
      noteGroupIds: concept.note_group_ids || []
    };
    nodes.push({
      id: concept.id,
      type: "mindMapNode",
      position: { x: 0, y: 0 },
      data: nodeData,
      width: STANDARD_CONCEPT_NODE_WIDTH,
      height: estimateMindMapNodeHeight(nodeData, STANDARD_CONCEPT_NODE_WIDTH)
    });

    if (graphScope === "note_group") {
      edges.push(directedEdge({
        id: `mind-map-root-edge:${concept.id}`,
        source: rootId,
        target: concept.id,
        type: "smoothstep",
        data: { relationType: "contains" }
      }));
    } else {
      const linkedNoteGroupIds = Array.isArray(concept.note_group_ids) ? concept.note_group_ids : [];
      linkedNoteGroupIds
        .filter((noteGroupId) => noteGroupById.has(noteGroupId))
        .forEach((noteGroupId) => {
          edges.push(directedEdge({
            id: `mind-map-note-group-edge:${noteGroupId}:${concept.id}`,
            source: `mind-map-note-group:${noteGroupId}`,
            target: concept.id,
            type: "smoothstep",
            data: { relationType: "contains" }
          }));
        });
    }
  });

  graphEdges
    .filter((edge) => conceptIds.has(edge.source) && conceptIds.has(edge.target))
    .forEach((edge) => {
      edges.push(directedEdge({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: "smoothstep",
        animated: edge.relation_type === "sequence",
        data: {
          relationType: edge.relation_type,
          confidence: edge.confidence,
          sourceNoteGroupId: edge.source_note_group_id
        }
      }));
    });

  return { nodes, edges };
}

export async function layoutMindMapElements(nodes, edges) {
  if (!nodes.length) {
    return { nodes, edges };
  }
  if (nodes.some((node) => ["concept_tree", "topic_tree"].includes(node.data?.layoutMode))) {
    return { nodes, edges };
  }

  const graph = {
    id: "mind-map",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.spacing.nodeNode": String(NODE_VERTICAL_GAP),
      "elk.spacing.edgeNode": "32",
      "elk.layered.spacing.nodeNodeBetweenLayers": String(NODE_LAYER_GAP),
      "elk.layered.spacing.edgeNodeBetweenLayers": "36",
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
