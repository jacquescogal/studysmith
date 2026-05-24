import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { SubjectIndex } from "./SubjectIndex";

describe("SubjectIndex permission controls", () => {
  test("renders disabled edit and delete controls for signed-in read-only users", () => {
    const html = renderToStaticMarkup(
      <SubjectIndex
        subjects={[{ id: "subject-1", title: "Biology" }]}
        showCreate
        canCreate={false}
        showEditControls
        canEditSubject={() => false}
        canDeleteSubject={() => false}
        onOpenWizard={() => {}}
        onSelect={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
      />
    );

    expect(html).toContain("Create new subject");
    expect(html).toContain('aria-label="Edit Biology"');
    expect(html).toContain('aria-label="Delete Biology"');
    expect(html.match(/disabled=""/g)).toHaveLength(3);
  });
});
