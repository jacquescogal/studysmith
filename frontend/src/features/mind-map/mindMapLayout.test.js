import { describe, expect, test } from "vitest";

import { buildMindMapElements } from "./mindMapLayout";

describe("buildMindMapElements", () => {
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
      target: "concept-2",
      label: "requires"
    });
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
        target: "concept-1",
        label: "contains"
      })
    ]);
  });

  test("labels extracted topic concepts as concept areas", () => {
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
          concept_type: "topic",
          note_group_ids: ["note-a"],
          study_card_count: 1
        }
      ],
      edges: []
    };

    const { nodes } = buildMindMapElements(graph, { title: "Authentication" });
    const conceptNode = nodes.find((node) => node.id === "concept-1");

    expect(conceptNode.data.badges).toContain("concept area");
    expect(conceptNode.data.badges).not.toContain("topic");
  });

  test("renders topics as intermediary nodes and knowledge nodes as leaves", () => {
    const graph = {
      scope: "module",
      module_id: "module-1",
      note_groups: [],
      nodes: [
        {
          id: "topic-auth",
          node_type: "topic",
          title: "Authentication",
          parent_topic_id: null,
          study_card_count: 2
        },
        {
          id: "topic-magic-links",
          node_type: "topic",
          title: "Magic Links",
          parent_topic_id: "topic-auth",
          study_card_count: 1
        },
        {
          id: "node-definition",
          node_type: "knowledge_node",
          title: "Magic link definition",
          parent_topic_id: "topic-magic-links",
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
      "topic-auth",
      "topic-magic-links",
      "node-definition"
    ]);
    expect(nodes.find((node) => node.id === "topic-auth").data.nodeType).toBe("topic");
    expect(nodes.find((node) => node.id === "node-definition").data.badges).toContain("definition");
    expect(edges.map((edge) => [edge.source, edge.target])).toEqual([
      ["mind-map-root:module-1", "topic-auth"],
      ["topic-auth", "topic-magic-links"],
      ["topic-magic-links", "node-definition"]
    ]);
  });
});
