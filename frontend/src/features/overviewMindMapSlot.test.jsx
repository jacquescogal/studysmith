import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { PageMindMapCard } from "./mind-map/PageMindMapCard";
import { ModuleOverview } from "./modules/ModuleOverview";
import { NoteGroupOverview } from "./note-groups/NoteGroupOverview";
import { ConceptOverview } from "./concepts/ConceptOverview";

describe("overview mind map slots", () => {
  test("renders a standalone zero-padding mind map card", () => {
    const html = renderToStaticMarkup(
      <PageMindMapCard id="module-mind-map">
        <div data-testid="mind-map">Mind Map</div>
      </PageMindMapCard>
    );

    expect(html).toContain("id=\"module-mind-map\"");
    expect(html).toContain("page-mind-map-card");
    expect(html).toContain("data-testid=\"mind-map\"");
  });

  test("does not render module mind map inside the hero card", () => {
    const html = renderToStaticMarkup(
      <ModuleOverview title="Module title" mindMap={<div data-testid="mind-map">Mind Map</div>} />
    );

    expect(html).not.toContain("overview-kicker");
    expect(html).not.toContain(">Module</span>");
    expect(html).not.toContain("data-testid=\"mind-map\"");
    expect(html).not.toContain("module-overview-mind-map");
  });

  test("does not render note group mind map inside the hero card", () => {
    const html = renderToStaticMarkup(
      <NoteGroupOverview noteGroup={{ title: "Note group" }} mindMap={<div data-testid="mind-map">Mind Map</div>} />
    );

    expect(html).not.toContain("overview-kicker");
    expect(html).not.toContain(">Note Group</span>");
    expect(html).not.toContain("data-testid=\"mind-map\"");
    expect(html).not.toContain("note-group-overview-mind-map");
  });

  test("does not render concept mind map inside the hero card", () => {
    const html = renderToStaticMarkup(
      <ConceptOverview concept={{ label: "Concept" }} mindMap={<div data-testid="mind-map">Mind Map</div>} />
    );

    expect(html).not.toContain("data-testid=\"mind-map\"");
    expect(html).not.toContain("concept-overview-mind-map");
  });
});
