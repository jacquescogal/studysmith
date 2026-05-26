import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { ContextSidebar } from "./ContextSidebar";

describe("ContextSidebar permission controls", () => {
  test("renders a disabled create note group button for signed-in read-only users", () => {
    const html = renderToStaticMarkup(
      <ContextSidebar
        subjectTitle="Biology"
        moduleTitle="Cell biology"
        scope="note-groups"
        onScopeChange={() => {}}
        noteGroupSearch=""
        conceptSearch=""
        onNoteGroupSearchChange={() => {}}
        onConceptSearchChange={() => {}}
        noteGroups={[]}
        concepts={[]}
        showCreateNoteGroup
        canCreateNoteGroup={false}
        onSelectNoteGroup={() => {}}
        onSelectConcept={() => {}}
        onCreateNoteGroup={() => {}}
      />
    );

    expect(html).toContain('aria-label="Create note group"');
    expect(html).toContain('disabled=""');
  });

  test("renders concept directory rows with child indentation", () => {
    const html = renderToStaticMarkup(
      <ContextSidebar
        subjectTitle="Biology"
        moduleTitle="Cell biology"
        scope="concepts"
        onScopeChange={() => {}}
        noteGroupSearch=""
        conceptSearch=""
        onNoteGroupSearchChange={() => {}}
        onConceptSearchChange={() => {}}
        noteGroups={[]}
        concepts={[
          { value: "", label: "..", directoryRole: "up", directoryDepth: 0 },
          { value: "root-1", label: "root_1", directoryRole: "current", directoryDepth: 0 },
          { value: "a", label: "a", directoryRole: "concept", directoryDepth: 1 }
        ]}
        selectedConceptId="root-1"
        showCreateNoteGroup={false}
        onSelectNoteGroup={() => {}}
        onSelectConcept={() => {}}
        onCreateNoteGroup={() => {}}
      />
    );

    expect(html).toContain("..");
    expect(html).toContain("root_1");
    expect(html).toContain("lucide-undo-2");
    expect(html).toContain("lucide-corner-down-right");
    expect(html).not.toContain("|- a");
  });

  test("does not style the concept up row as selected", () => {
    const html = renderToStaticMarkup(
      <ContextSidebar
        subjectTitle="Biology"
        moduleTitle="Cell biology"
        scope="concepts"
        onScopeChange={() => {}}
        noteGroupSearch=""
        conceptSearch=""
        onNoteGroupSearchChange={() => {}}
        onConceptSearchChange={() => {}}
        noteGroups={[]}
        concepts={[
          { value: "", label: "..", directoryRole: "up", directoryDepth: 0 },
          { value: "root-1", label: "root_1", directoryRole: "current", directoryDepth: 0 },
          { value: "a", label: "a", directoryRole: "concept", directoryDepth: 1 }
        ]}
        selectedNoteGroupId=""
        selectedConceptId="root-1"
        showCreateNoteGroup={false}
        onSelectNoteGroup={() => {}}
        onSelectConcept={() => {}}
        onCreateNoteGroup={() => {}}
      />
    );

    expect(html.match(/border-primary/g) ?? []).toHaveLength(1);
  });
});
