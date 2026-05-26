import { renderToStaticMarkup } from "react-dom/server";
import { ReactFlowProvider } from "@xyflow/react";
import { describe, expect, test } from "vitest";

import { MIND_MAP_FIT_VIEW_OPTIONS, fitMindMapView, MindMapNode, MindMapPanel } from "./MindMapPanel";

describe("MindMapPanel", () => {
  test("renders an empty state with generate control", () => {
    const html = renderToStaticMarkup(
      <MindMapPanel
        graph={{ status: "not_generated", nodes: [], edges: [] }}
        title="Authentication Map"
        canGenerate
        onGenerate={() => {}}
      />
    );

    expect(html).toContain("Authentication Map");
    expect(html).toContain("No Mind Map generated yet.");
    expect(html).toContain("Generate");
  });

  test("labels stale generated maps", () => {
    const html = renderToStaticMarkup(
      <MindMapPanel
        graph={{ status: "complete", stale: true, nodes: [], edges: [] }}
        title="Stale Map"
      />
    );

    expect(html).toContain("Stale");
  });

  test("renders a back button and concept title while showing a concept drilldown graph", () => {
    const html = renderToStaticMarkup(
      <MindMapPanel
        graph={{ scope: "module", status: "complete", module_id: "module-1", nodes: [], edges: [] }}
        title="Module Mind Map"
        drilldownGraph={{
          scope: "concept",
          status: "complete",
          module_id: "module-1",
          nodes: [
            {
              id: "concept-map-current-group:concept-auth",
              node_type: "concept_current_group",
              title: "Magic Links"
            }
          ],
          edges: []
        }}
        drilldownTitle="Magic Links Mind Map"
        onBackFromDrilldown={() => {}}
      />
    );

    expect(html).toContain("Back to Module Mind Map");
    expect(html).toContain("Magic Links Mind Map");
  });

  test("renders a back button to the source note group mind map from drilldown", () => {
    const html = renderToStaticMarkup(
      <MindMapPanel
        graph={{ scope: "note_group", status: "complete", module_id: "module-1", nodes: [], edges: [] }}
        title="Note Group Mind Map"
        drilldownGraph={{
          scope: "concept",
          status: "complete",
          module_id: "module-1",
          nodes: [
            {
              id: "concept-map-current-group:concept-auth",
              node_type: "concept_current_group",
              title: "Magic Links"
            }
          ],
          edges: []
        }}
        drilldownTitle="Magic Links Mind Map"
        onBackFromDrilldown={() => {}}
      />
    );

    expect(html).toContain("Back to Note Group Mind Map");
  });

  test("changes the rendered flow key between base graph and concept drilldown", () => {
    const baseGraph = {
      scope: "module",
      status: "complete",
      module_id: "module-1",
      nodes: [
        {
          id: "concept-auth",
          node_type: "concept",
          title: "Authentication"
        }
      ],
      edges: []
    };
    const conceptGraph = {
      scope: "concept",
      status: "complete",
      module_id: "module-1",
      nodes: [
        {
          id: "concept-map-current-group:concept-auth",
          node_type: "concept_current_group",
          title: "Authentication",
          concept_ids: ["concept-auth"]
        }
      ],
      edges: []
    };

    const baseHtml = renderToStaticMarkup(
      <MindMapPanel graph={baseGraph} title="Module Mind Map" />
    );
    const drilldownHtml = renderToStaticMarkup(
      <MindMapPanel
        graph={baseGraph}
        title="Module Mind Map"
        drilldownGraph={conceptGraph}
        drilldownTitle="Authentication Mind Map"
        onBackFromDrilldown={() => {}}
      />
    );

    expect(baseHtml).toContain("data-mind-map-view-key=\"module:module-1\"");
    expect(drilldownHtml).toContain("data-mind-map-view-key=\"concept:module-1:concept-auth\"");
  });

  test("calls the React Flow fitView SDK function with Mind Map fit options", () => {
    let receivedOptions = null;
    const instance = {
      fitView: (options) => {
        receivedOptions = options;
      }
    };

    fitMindMapView(instance);

    expect(receivedOptions).toEqual(MIND_MAP_FIT_VIEW_OPTIONS);
  });

  test("renders source and target handles for edge drawing", () => {
    const html = renderToStaticMarkup(
      <ReactFlowProvider>
        <MindMapNode
          data={{
            title: "Magic Links",
            summary: "Passwordless sign-in links.",
            nodeType: "concept",
            badges: ["term"]
          }}
        />
      </ReactFlowProvider>
    );

    expect(html).toContain("react-flow__handle-left");
    expect(html).toContain("react-flow__handle-right");
  });

  test("renders a hover tooltip with the full node body text", () => {
    const html = renderToStaticMarkup(
      <ReactFlowProvider>
        <MindMapNode
          data={{
            title: "Definition",
            summary: "Magic links are one-time sign-in links that let users authenticate without a password.",
            nodeType: "knowledge_node",
            badges: ["definition"]
          }}
        />
      </ReactFlowProvider>
    );

    expect(html).toContain("mind-map-node-full-text");
    expect(html).toContain("role=\"tooltip\"");
    expect(html).toContain("Magic links are one-time sign-in links that let users authenticate without a password.");
  });

  test("hides concept regeneration behind a compact node menu", () => {
    const html = renderToStaticMarkup(
      <ReactFlowProvider>
        <MindMapNode
          data={{
            id: "concept-1",
            title: "Authentication",
            nodeType: "concept",
            badges: ["Concept"],
            canRegenerateKnowledgeNodes: true,
            onRegenerateKnowledgeNodes: () => {}
          }}
        />
      </ReactFlowProvider>
    );

    expect(html).toContain("aria-label=\"Concept actions\"");
    expect(html).toContain("Regenerate");
    expect(html).not.toContain("Regenerate Knowledge Nodes");
  });

  test("blocks graph interaction while a regeneration is running", () => {
    const html = renderToStaticMarkup(
      <MindMapPanel
        graph={{
          status: "complete",
          module_id: "module-1",
          nodes: [
            {
              id: "concept-1",
              node_type: "concept",
              title: "Authentication"
            }
          ],
          edges: []
        }}
        title="Authentication Map"
        regeneratingConceptId="concept-1"
      />
    );

    expect(html).toContain("mind-map-regeneration-overlay");
    expect(html).toContain("Regenerating Mind Map...");
  });

  test("renders embedded mode without card header chrome", () => {
    const html = renderToStaticMarkup(
      <MindMapPanel
        embedded
        graph={{ status: "complete", module_id: "module-1", nodes: [], edges: [] }}
        title="Module Mind Map"
        canGenerate
        onGenerate={() => {}}
      />
    );

    expect(html).toContain("mind-map-panel-embedded");
    expect(html).not.toContain("mind-map-panel-header");
    expect(html).not.toContain("mind-map-status-badge");
    expect(html).not.toContain("Module Mind Map");
    expect(html).not.toContain("mind-map-floating-actions");
    expect(html).not.toContain("Regenerate");
  });

  test("keeps embedded drilldown back control available", () => {
    const html = renderToStaticMarkup(
      <MindMapPanel
        embedded
        graph={{ scope: "module", status: "complete", module_id: "module-1", nodes: [], edges: [] }}
        title="Module Mind Map"
        drilldownGraph={{
          scope: "concept",
          status: "complete",
          module_id: "module-1",
          nodes: [],
          edges: []
        }}
        drilldownTitle="Authentication Mind Map"
        onBackFromDrilldown={() => {}}
      />
    );

    expect(html).toContain("mind-map-floating-actions");
    expect(html).toContain("Back to Module Mind Map");
  });

  test("hides the minimap by default and renders a minimap toggle", () => {
    const html = renderToStaticMarkup(
      <MindMapPanel
        graph={{
          status: "complete",
          module_id: "module-1",
          nodes: [
            {
              id: "concept-1",
              node_type: "concept",
              title: "Authentication"
            }
          ],
          edges: []
        }}
        title="Module Mind Map"
      />
    );

    expect(html).toContain("aria-label=\"Show minimap\"");
    expect(html).not.toContain("react-flow__minimap");
  });
});
