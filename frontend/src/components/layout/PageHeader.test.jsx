import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { PageHeader } from "./PageHeader";

const longTitlesByScope = [
  {
    pageType: "Module",
    tone: "module",
    title:
      "Cloud Computing Architecture Patterns for Highly Regulated Teams With Long Governance Requirements"
  },
  {
    pageType: "Note Group",
    tone: "note-group",
    title:
      "Vendor Pricing Notes and Migration Constraints Collected From Several Dense Source Documents"
  },
  {
    pageType: "Concept",
    tone: "concept",
    title:
      "Elasticity Tradeoffs Across Reserved Capacity, Autoscaling Policies, and Queue Backpressure"
  }
];

describe("PageHeader", () => {
  test.each(longTitlesByScope)(
    "renders stable regions for a long $pageType title with actions",
    ({ pageType, tone, title }) => {
      const html = renderToStaticMarkup(
        <PageHeader
          title={title}
          pageType={pageType}
          tone={tone}
          breadcrumbs={[{ label: pageType, current: true, badge: "Draft" }]}
          actions={<button type="button">Open menu</button>}
        />
      );

      expect(html).toContain("study-page-header");
      expect(html).toContain(`page-header-tone-${tone}`);
      expect(html).toContain("page-header-frame");
      expect(html).toContain("page-header-content");
      expect(html).toContain("page-header-title-block");
      expect(html).toContain("page-header-meta-row");
      expect(html).toContain("page-header-title");
      expect(html).toContain("page-header-actions");
      expect(html).toContain(`>${pageType}</span>`);
      expect(html).toContain(`>${title}</h1>`);
      expect(html).toContain(">Open menu</button>");
    }
  );

  test("renders the page type in metadata separate from the title text flow", () => {
    const html = renderToStaticMarkup(
      <PageHeader title="Cloud Computing" pageType="Module" tone="module" breadcrumbs={[]} />
    );

    expect(html).not.toContain("class=\"page-header ");
    expect(html).toMatch(
      /<div class="page-header-meta-row">.*<span class="page-header-type-badge">Module<\/span>.*<\/div><h1 class="page-header-title/
    );
  });
});
