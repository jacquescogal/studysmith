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
        topicSearch=""
        onNoteGroupSearchChange={() => {}}
        onTopicSearchChange={() => {}}
        noteGroups={[]}
        topics={[]}
        showCreateNoteGroup
        canCreateNoteGroup={false}
        onSelectNoteGroup={() => {}}
        onSelectTopic={() => {}}
        onCreateNoteGroup={() => {}}
      />
    );

    expect(html).toContain('aria-label="Create note group"');
    expect(html).toContain('disabled=""');
  });
});
