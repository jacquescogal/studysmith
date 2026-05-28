import { readFileSync } from "node:fs";
import { join } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

import { ScopeInteractionDock, getReviewCountFromSliderValue } from "./ScopeInteractionDock";

const styles = readFileSync(join(process.cwd(), "src/styles.css"), "utf8");

function getCssRule(selector) {
  const match = styles.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`));
  return match?.[1] || "";
}

function expectCssDeclaration(rule, property, value) {
  expect(rule).toMatch(new RegExp(`${property}\\s*:\\s*${value}\\b`));
}

describe("ScopeInteractionDock", () => {
  test("renders scope actions, Review section, Due count, and a bounded review count slider", () => {
    const html = renderToStaticMarkup(
      <ScopeInteractionDock
        scopeLabel="Note Group"
        actions={[
          { id: "mind-map", label: "Mind Map", onClick: vi.fn() },
          { id: "view-cards", label: "View Cards", onClick: vi.fn() },
          { id: "study", label: "Study", onClick: vi.fn() }
        ]}
        review={{
          dueCount: 4,
          count: 10,
          maxCount: 23,
          onCountChange: vi.fn(),
          onReviewDue: vi.fn(),
          onReviewCount: vi.fn()
        }}
      />
    );

    expect(html).toContain("scope-interaction-dock");
    expect(html).toContain(">Note Group</");
    expect(html).toContain(">Mind Map</");
    expect(html).toContain(">View Cards</");
    expect(html).toContain(">Study</");
    expect(html).toContain("scope-dock-review-divider");
    expect(html).toContain("scope-dock-review-title");
    expect(html).toContain(">Review Questions</div>");
    expect(html).toContain(">Total</span>");
    expect(html).toContain(">23</span>");
    expect(html).toContain(">Due</span>");
    expect(html).toContain(">Review Due</");
    expect(html).toContain(">4</span>");
    expect(html.indexOf(">Total</span>")).toBeLessThan(html.indexOf(">Due</span>"));
    expect(html).toContain("type=\"range\"");
    expect(html).toContain("aria-label=\"Review count\"");
    expect(html).toContain("min=\"0\"");
    expect(html).toContain("max=\"22\"");
    expect(html).toContain("value=\"9\"");
    expect(html).toContain(">Review 10</button>");
    expect(html).not.toContain(">Review 10</span>");
  });

  test("maps the slider right endpoint to the full review count", () => {
    expect(getReviewCountFromSliderValue("22", 23)).toBe(23);
  });

  test("disables review controls when a scope has no questions", () => {
    const html = renderToStaticMarkup(
      <ScopeInteractionDock
        scopeLabel="Note Group"
        review={{
          dueCount: 0,
          count: 10,
          maxCount: 0,
          onCountChange: vi.fn(),
          onReviewDue: vi.fn(),
          onReviewCount: vi.fn()
        }}
      />
    );

    expect(html).toContain(">Review 0</button>");
    expect(html).not.toContain(">Review 0</span>");
    expect(html).toContain("min=\"0\"");
    expect(html).toContain("max=\"0\"");
    expect(html).toContain("value=\"0\"");
    expect(html.match(/disabled=""/g)).toHaveLength(3);
  });

  test("does not clip the review slider thumb at its max endpoint", () => {
    const dockRule = getCssRule(".scope-interaction-dock");

    expect(dockRule).not.toMatch(/overflow\s*:\s*hidden\b/);
  });

  test("removes global form padding from the review range input", () => {
    const sliderInputRule = getCssRule(".scope-dock-slider input[type=\"range\"]");

    expectCssDeclaration(sliderInputRule, "padding", "0");
  });

  test("renders a visible divider above the review dock section", () => {
    const dividerRule = getCssRule(".scope-dock-review-divider");

    expectCssDeclaration(dividerRule, "height", "1px");
    expect(dividerRule).toContain("background: #cbd5e1");
  });

  test("omits Study when it is not supplied for a scope", () => {
    const html = renderToStaticMarkup(
      <ScopeInteractionDock
        scopeLabel="Concept"
        actions={[
          { id: "mind-map", label: "Mind Map", onClick: vi.fn() },
          { id: "view-cards", label: "View Cards", onClick: vi.fn() }
        ]}
      />
    );

    expect(html).toContain(">Concept</");
    expect(html).not.toContain(">Study</");
    expect(html).not.toContain("Topic");
  });

  test("renders include descendant Study Cards control in the dock", () => {
    const html = renderToStaticMarkup(
      <ScopeInteractionDock
        scopeLabel="Concept"
        actions={[
          { id: "mind-map", label: "Mind Map", onClick: vi.fn() },
          { id: "view-cards", label: "View Cards", onClick: vi.fn() }
        ]}
        studyCardScope={{
          includeDescendants: true,
          onIncludeDescendantsChange: vi.fn()
        }}
      />
    );

    expect(html).toContain("scope-dock-toggle");
    expect(html).toContain("Include descendant Study Cards");
    expect(html).toContain("checked");
  });

  test("renders include descendant Study Cards unchecked when disabled in the dock", () => {
    const html = renderToStaticMarkup(
      <ScopeInteractionDock
        scopeLabel="Concept"
        studyCardScope={{
          includeDescendants: false,
          onIncludeDescendantsChange: vi.fn()
        }}
      />
    );

    expect(html).toContain("Include descendant Study Cards");
    expect(html).not.toContain("checked");
  });

  test("renders a scope settings gear as icon chrome separate from action rows", () => {
    const html = renderToStaticMarkup(
      <ScopeInteractionDock
        scopeLabel="Module"
        actions={[{ id: "mind-map", label: "Mind Map", active: true, onClick: vi.fn() }]}
        settings={{
          label: "Module settings",
          onClick: vi.fn(),
          disabled: false
        }}
      />
    );

    expect(html).toContain("aria-label=\"Module settings\"");
    expect(html).toContain("scope-dock-settings-button");
    expect(html).toContain("data-size=\"icon-sm\"");
    expect(html).not.toContain(">Module settings</span>");
  });

  test("disables scope settings when management is unavailable", () => {
    const html = renderToStaticMarkup(
      <ScopeInteractionDock
        scopeLabel="Concept"
        actions={[{ id: "mind-map", label: "Mind Map", active: true, onClick: vi.fn() }]}
        settings={{
          label: "Concept settings",
          onClick: vi.fn(),
          disabled: true
        }}
      />
    );

    expect(html).toContain("aria-label=\"Concept settings\"");
    expect(html).toContain("disabled=\"\"");
  });
});
