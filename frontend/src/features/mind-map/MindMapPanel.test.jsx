import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { MindMapPanel } from "./MindMapPanel";

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
});
