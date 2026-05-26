import { describe, expect, test } from "vitest";
import { MarkerType } from "@xyflow/react";

import { buildMindMapElements, layoutMindMapElements } from "./mindMapLayout";

describe("buildMindMapElements", () => {
  const expectDirectedEdgesWithoutLabels = (edges) => {
    edges.forEach((edge) => {
      expect(edge).not.toHaveProperty("label");
      expect(edge.markerEnd).toMatchObject({
        type: MarkerType.ArrowClosed,
        color: "#64748b"
      });
    });
  };

  test("builds root, note group, concept, and relation elements", () => {
    const graph = {
      scope: "module",
      module_id: "module-1",
      note_groups: [
        { id: "note-a", title: "Authentication" },
        { id: "note-b", title: "Authorization" }
      ],
      nodes: [
        {
          id: "concept-1",
          title: "Magic Links",
          summary: "Passwordless sign-in links.",
          importance: "core",
          concept_type: "term",
          note_group_ids: ["note-a"],
          study_card_count: 2
        },
        {
          id: "concept-2",
          title: "Row-Level Security",
          summary: "Policy-controlled rows.",
          importance: "supporting",
          concept_type: "principle",
          note_group_ids: ["note-b"],
          study_card_count: 1
        }
      ],
      edges: [
        {
          id: "edge-1",
          source: "concept-1",
          target: "concept-2",
          relation_type: "requires",
          label: "requires",
          confidence: 0.88
        }
      ]
    };

    const { nodes, edges } = buildMindMapElements(graph, { title: "StudySmith" });

    expect(nodes.map((node) => node.id)).toEqual([
      "mind-map-root:module-1",
      "mind-map-note-group:note-a",
      "mind-map-note-group:note-b",
      "concept-1",
      "concept-2"
    ]);
    expect(nodes[0].data.title).toBe("StudySmith");
    expect(nodes.find((node) => node.id === "concept-1").data.badges).toContain("2 cards");
    expect(edges.map((edge) => edge.id)).toEqual([
      "mind-map-root-edge:note-a",
      "mind-map-root-edge:note-b",
      "mind-map-note-group-edge:note-a:concept-1",
      "mind-map-note-group-edge:note-b:concept-2",
      "edge-1"
    ]);
    expect(edges.find((edge) => edge.id === "edge-1")).toMatchObject({
      source: "concept-1",
      target: "concept-2"
    });
    expectDirectedEdgesWithoutLabels(edges);
  });

  test("uses the note group title as root in note group scope", () => {
    const graph = {
      scope: "note_group",
      module_id: "module-1",
      note_group_id: "note-a",
      note_groups: [{ id: "note-a", title: "Authentication" }],
      nodes: [
        {
          id: "concept-1",
          title: "Magic Links",
          summary: "Passwordless sign-in links.",
          importance: "core",
          concept_type: "term",
          note_group_ids: ["note-a"],
          study_card_count: 2
        }
      ],
      edges: []
    };

    const { nodes, edges } = buildMindMapElements(graph, { title: "Authentication Mind Map" });

    expect(nodes.map((node) => node.id)).toEqual(["mind-map-root:note-a", "concept-1"]);
    expect(nodes[0].data.title).toBe("Authentication Mind Map");
    expect(edges).toEqual([
      expect.objectContaining({
        id: "mind-map-root-edge:concept-1",
        source: "mind-map-root:note-a",
        target: "concept-1"
      })
    ]);
    expectDirectedEdgesWithoutLabels(edges);
  });

  test("labels extracted concept concepts as concept areas", () => {
    const graph = {
      scope: "note_group",
      module_id: "module-1",
      note_group_id: "note-a",
      note_groups: [{ id: "note-a", title: "Authentication" }],
      nodes: [
        {
          id: "concept-1",
          title: "Authentication Flow",
          summary: "How users prove identity.",
          importance: "core",
          concept_type: "concept",
          note_group_ids: ["note-a"],
          study_card_count: 1
        }
      ],
      edges: []
    };

    const { nodes } = buildMindMapElements(graph, { title: "Authentication" });
    const conceptNode = nodes.find((node) => node.id === "concept-1");

    expect(conceptNode.data.badges).toContain("concept area");
    expect(conceptNode.data.badges).not.toContain("concept");
  });

  test("renders concepts as intermediary nodes with definition text and hides knowledge nodes", () => {
    const graph = {
      scope: "module",
      module_id: "module-1",
      note_groups: [],
      nodes: [
        {
          id: "concept-auth",
          node_type: "concept",
          title: "Authentication",
          parent_concept_id: null,
          study_card_count: 2
        },
        {
          id: "concept-magic-links",
          node_type: "concept",
          title: "Magic Links",
          parent_concept_id: "concept-auth",
          study_card_count: 1
        },
        {
          id: "node-definition",
          node_type: "knowledge_node",
          title: "Magic link definition",
          summary: "Magic links are passwordless sign-in links.",
          parent_concept_id: "concept-magic-links",
          knowledge_type: "definition",
          importance: "core",
          study_card_count: 1
        }
      ],
      edges: []
    };

    const { nodes, edges } = buildMindMapElements(graph, { title: "Supabase Auth" });

    expect(nodes.map((node) => node.id)).toEqual([
      "mind-map-root:module-1",
      "concept-auth",
      "concept-magic-links"
    ]);
    expect(nodes.find((node) => node.id === "concept-auth").data.nodeType).toBe("concept");
    expect(nodes.find((node) => node.id === "concept-magic-links").data.summary).toBe(
      "Magic links are passwordless sign-in links."
    );
    expect(nodes.find((node) => node.id === "node-definition")).toBeUndefined();
    expect(edges.map((edge) => [edge.source, edge.target])).toEqual([
      ["mind-map-root:module-1", "concept-auth"],
      ["concept-auth", "concept-magic-links"]
    ]);
    expectDirectedEdgesWithoutLabels(edges);
  });

  test("adds selected-concept regeneration actions only to concept nodes when enabled", () => {
    const graph = {
      scope: "module",
      module_id: "module-1",
      note_groups: [],
      nodes: [
        {
          id: "concept-auth",
          node_type: "concept",
          title: "Authentication"
        },
        {
          id: "node-definition",
          node_type: "knowledge_node",
          title: "Authentication definition",
          parent_concept_id: "concept-auth",
          knowledge_type: "definition",
          importance: "core"
        }
      ],
      edges: []
    };
    const regenerate = () => {};

    const { nodes } = buildMindMapElements(graph, {
      title: "Supabase Auth",
      canRegenerateConceptKnowledgeNodes: true,
      onRegenerateConceptKnowledgeNodes: regenerate,
      regeneratingConceptId: "concept-auth"
    });

    const conceptNode = nodes.find((node) => node.id === "concept-auth");

    expect(conceptNode.data.canRegenerateKnowledgeNodes).toBe(true);
    expect(conceptNode.data.onRegenerateKnowledgeNodes).toBe(regenerate);
    expect(conceptNode.data.regeneratingKnowledgeNodes).toBe(true);
    expect(nodes.find((node) => node.id === "node-definition")).toBeUndefined();
  });

  test("builds concept-scope maps as parent, current concept, and children group cards", () => {
    const graph = {
      scope: "concept",
      module_id: "module-1",
      nodes: [
        {
          id: "concept-map-parent-group:concept-auth",
          node_type: "concept_parent_group",
          title: "Parent"
        },
        {
          id: "concept-parent",
          node_type: "concept_parent",
          title: "Authentication",
          parent_group_id: "concept-map-parent-group:concept-auth"
        },
        {
          id: "concept-map-current-group:concept-auth",
          node_type: "concept_current_group",
          title: "Magic Links",
          concept_ids: ["concept-auth"]
        },
        {
          id: "node-definition",
          node_type: "knowledge_node",
          title: "Definition",
          summary: "Magic links are one-time sign-in links.",
          parent_group_id: "concept-map-current-group:concept-auth",
          knowledge_type: "definition",
          importance: "core"
        },
        {
          id: "node-example",
          node_type: "knowledge_node",
          title: "Example",
          summary: "An email login link is an example.",
          parent_group_id: "concept-map-current-group:concept-auth",
          knowledge_type: "example",
          importance: "supporting"
        },
        {
          id: "concept-map-children-group:concept-auth",
          node_type: "concept_children_group",
          title: "Children"
        },
        {
          id: "concept-child",
          node_type: "concept_child",
          title: "Link Expiry",
          parent_group_id: "concept-map-children-group:concept-auth"
        },
        {
          id: "concept-map-study-card:study-card-1",
          node_type: "study_card",
          title: "Magic link purpose",
          summary: "Magic links let users sign in without a password."
        }
      ],
      edges: [
        {
          id: "edge-parent",
          source: "concept-map-parent-group:concept-auth",
          target: "concept-map-current-group:concept-auth",
          relation_type: "parent_of",
          label: null
        },
        {
          id: "edge-children",
          source: "concept-map-current-group:concept-auth",
          target: "concept-map-children-group:concept-auth",
          relation_type: "parent_of",
          label: null
        },
        {
          id: "edge-card",
          source: "concept-map-current-group:concept-auth",
          target: "concept-map-study-card:study-card-1",
          relation_type: "has_study_card",
          label: null
        }
      ]
    };

    const regenerate = () => {};
    const { nodes, edges } = buildMindMapElements(graph, {
      title: "Magic Links Mind Map",
      canRegenerateConceptKnowledgeNodes: true,
      canOpenConceptMindMap: true,
      onRegenerateConceptKnowledgeNodes: regenerate,
      regeneratingConceptId: "concept-auth"
    });

    expect(nodes.map((node) => node.id)).toEqual([
      "concept-map-parent-group:concept-auth",
      "concept-parent",
      "concept-map-current-group:concept-auth",
      "node-definition",
      "node-example",
      "concept-map-children-group:concept-auth",
      "concept-child",
      "concept-map-study-card:study-card-1"
    ]);
    const parentGroup = nodes.find((node) => node.id === "concept-map-parent-group:concept-auth");
    const currentGroup = nodes.find((node) => node.id === "concept-map-current-group:concept-auth");
    const childrenGroup = nodes.find((node) => node.id === "concept-map-children-group:concept-auth");
    const parentNode = nodes.find((node) => node.id === "concept-parent");
    const definitionNode = nodes.find((node) => node.id === "node-definition");
    const exampleNode = nodes.find((node) => node.id === "node-example");
    const childNode = nodes.find((node) => node.id === "concept-child");
    const studyCardNode = nodes.find((node) => node.id === "concept-map-study-card:study-card-1");

    expect(parentGroup.data.nodeType).toBe("concept_parent_group");
    expect(parentGroup.zIndex).toBe(0);
    expect(parentGroup.width).toBe(320);
    expect(parentGroup.height).toBe(136);
    expect(currentGroup.data.nodeType).toBe("concept_current_group");
    expect(currentGroup.zIndex).toBe(0);
    expect(currentGroup.data.title).toBe("Magic Links");
    expect(currentGroup.width).toBe(596);
    expect(currentGroup.height).toBe(236);
    expect(currentGroup.data.actionConceptId).toBe("concept-auth");
    expect(currentGroup.data.canRegenerateKnowledgeNodes).toBe(true);
    expect(currentGroup.data.onRegenerateKnowledgeNodes).toBe(regenerate);
    expect(currentGroup.data.regeneratingKnowledgeNodes).toBe(true);
    expect(childrenGroup.data.nodeType).toBe("concept_children_group");
    expect(childrenGroup.width).toBe(320);
    expect(childrenGroup.height).toBe(136);
    expect(parentNode.parentId).toBeUndefined();
    expect(definitionNode.parentId).toBeUndefined();
    expect(exampleNode.parentId).toBeUndefined();
    expect(childNode.parentId).toBeUndefined();
    expect(studyCardNode.parentId).toBeUndefined();
    expect(parentNode.extent).toBeUndefined();
    expect(definitionNode.extent).toBeUndefined();
    expect(parentNode.zIndex).toBe(2);
    expect(definitionNode.zIndex).toBe(2);
    expect(studyCardNode.zIndex).toBe(2);
    expect(parentNode.height).toBe(48);
    expect(childNode.height).toBe(48);
    expect(parentNode.data.canOpenConceptMindMap).toBe(true);
    expect(childNode.data.canOpenConceptMindMap).toBe(true);
    expect(definitionNode.data.canOpenConceptMindMap).toBe(false);
    expect(parentNode.position.x).toBe(parentGroup.position.x + 24);
    expect(definitionNode.position.x).toBe(currentGroup.position.x + 24);
    expect(childNode.position.x).toBe(childrenGroup.position.x + 24);
    expect(definitionNode.position.x).toBeLessThan(exampleNode.position.x);
    expect(studyCardNode.data.nodeType).toBe("study_card");
    expect(edges.map((edge) => [edge.id, edge.source, edge.target, edge.sourceHandle, edge.targetHandle])).toEqual([
      ["edge-parent", "concept-map-parent-group:concept-auth", "concept-map-current-group:concept-auth", "bottom", "top"],
      ["edge-children", "concept-map-current-group:concept-auth", "concept-map-children-group:concept-auth", "bottom", "top"],
      ["edge-card", "concept-map-current-group:concept-auth", "concept-map-study-card:study-card-1", "right", "left"]
    ]);
    expectDirectedEdgesWithoutLabels(edges);
    expect(nodes.every((node) => node.data.layoutMode === "concept_tree")).toBe(true);
  });

  test("wraps concept-scope group card children after three inner nodes", () => {
    const graph = {
      scope: "concept",
      module_id: "module-1",
      nodes: [
        {
          id: "concept-map-current-group:concept-auth",
          node_type: "concept_current_group",
          title: "Magic Links"
        },
        ...["definition", "fact", "rule", "example"].map((knowledgeType) => ({
          id: `node-${knowledgeType}`,
          node_type: "knowledge_node",
          title: knowledgeType,
          summary: `${knowledgeType} summary`,
          parent_group_id: "concept-map-current-group:concept-auth",
          knowledge_type: knowledgeType,
          importance: "supporting"
        }))
      ],
      edges: []
    };

    const { nodes } = buildMindMapElements(graph, { title: "Magic Links Mind Map" });
    const currentGroup = nodes.find((node) => node.id === "concept-map-current-group:concept-auth");
    const firstNode = nodes.find((node) => node.id === "node-definition");
    const thirdNode = nodes.find((node) => node.id === "node-rule");
    const fourthNode = nodes.find((node) => node.id === "node-example");

    expect(currentGroup.width).toBe(884);
    expect(currentGroup.height).toBe(412);
    expect(firstNode.position).toEqual({
      x: currentGroup.position.x + 24,
      y: currentGroup.position.y + 64
    });
    expect(thirdNode.position).toEqual({
      x: currentGroup.position.x + 600,
      y: currentGroup.position.y + 64
    });
    expect(fourthNode.position).toEqual({
      x: currentGroup.position.x + 24,
      y: currentGroup.position.y + 240
    });
  });

  test("does not create parent or children group cards when concept has none", () => {
    const graph = {
      scope: "concept",
      module_id: "module-1",
      nodes: [
        {
          id: "concept-map-current-group:concept-auth",
          node_type: "concept_current_group",
          title: "Magic Links"
        },
        {
          id: "node-definition",
          node_type: "knowledge_node",
          title: "Definition",
          summary: "Magic links are one-time sign-in links.",
          parent_group_id: "concept-map-current-group:concept-auth",
          knowledge_type: "definition",
          importance: "core"
        }
      ],
      edges: []
    };

    const { nodes, edges } = buildMindMapElements(graph, { title: "Magic Links Mind Map" });

    expect(nodes.map((node) => node.id)).toEqual(["concept-map-current-group:concept-auth", "node-definition"]);
    expect(nodes.find((node) => node.id === "node-definition").parentId).toBeUndefined();
    expect(nodes.find((node) => node.id === "node-definition").extent).toBeUndefined();
    expect(nodes.find((node) => node.id.includes("parent-group"))).toBeUndefined();
    expect(nodes.find((node) => node.id.includes("children-group"))).toBeUndefined();
    expect(edges).toEqual([]);
  });

  test("reserves enough layout height for dense Concept nodes with menu actions", () => {
    const graph = {
      scope: "module",
      module_id: "module-1",
      note_groups: [],
      nodes: [
        {
          id: "concept-auth",
          node_type: "concept",
          title: "Authentication and authorization through cloud identity flows",
          summary:
            "Covers identity proof, session validation, token exchange, and passwordless sign-in flows in a module.",
          knowledge_node_status: "needs_review",
          knowledge_node_review_reason: "Missing definition Knowledge Node",
          study_card_count: 12,
          note_group_count: 3
        }
      ],
      edges: []
    };

    const { nodes } = buildMindMapElements(graph, {
      title: "Supabase Auth",
      canRegenerateConceptKnowledgeNodes: true,
      onRegenerateConceptKnowledgeNodes: () => {}
    });
    const conceptNode = nodes.find((node) => node.id === "concept-auth");

    expect(conceptNode.width).toBe(260);
    expect(conceptNode.height).toBeGreaterThanOrEqual(156);
  });
});

describe("layoutMindMapElements", () => {
  test("keeps sibling nodes separated by their estimated heights", async () => {
    const nodes = [
      {
        id: "root",
        width: 260,
        height: 112,
        position: { x: 0, y: 0 },
        data: { title: "Root" }
      },
      {
        id: "concept-a",
        width: 260,
        height: 190,
        position: { x: 0, y: 0 },
        data: { title: "Concept A" }
      },
      {
        id: "concept-b",
        width: 260,
        height: 190,
        position: { x: 0, y: 0 },
        data: { title: "Concept B" }
      }
    ];
    const edges = [
      { id: "edge-a", source: "root", target: "concept-a" },
      { id: "edge-b", source: "root", target: "concept-b" }
    ];

    const layout = await layoutMindMapElements(nodes, edges);
    const conceptA = layout.nodes.find((node) => node.id === "concept-a");
    const conceptB = layout.nodes.find((node) => node.id === "concept-b");
    const verticalGap = Math.abs(conceptA.position.y - conceptB.position.y);

    expect(verticalGap).toBeGreaterThanOrEqual(190);
  });
});
