import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { PageHeader } from "./PageHeader";

describe("PageHeader", () => {
  test("renders the page type as a tone-coded badge beside the title", () => {
    const html = renderToStaticMarkup(
      <PageHeader title="Cloud Computing" pageType="Module" tone="module" breadcrumbs={[]} />
    );

    expect(html).toContain("study-page-header");
    expect(html).not.toContain("class=\"page-header ");
    expect(html).toContain("page-header-tone-module");
    expect(html).toContain("page-header-type-badge");
    expect(html).toContain(">Module</span>");
    expect(html).toContain(">Cloud Computing</h1>");
  });
});
