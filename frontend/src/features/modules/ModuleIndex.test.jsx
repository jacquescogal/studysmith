import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { ModuleIndex } from "./ModuleIndex";

describe("ModuleIndex permission controls", () => {
  test("renders disabled create and delete controls for signed-in read-only users", () => {
    const html = renderToStaticMarkup(
      <ModuleIndex
        modules={[{ id: "module-1", title: "Cell biology" }]}
        dueCounts={{}}
        showCreate
        canCreate={false}
        showEditControls
        canEdit={false}
        onOpenWizard={() => {}}
        onBack={() => {}}
        onSelect={() => {}}
        onDelete={() => {}}
      />
    );

    expect(html).toContain("Create module");
    expect(html).toContain('aria-label="Delete Cell biology"');
    expect(html.match(/disabled=""/g)).toHaveLength(2);
  });
});
