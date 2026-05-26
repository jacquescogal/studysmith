import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, test } from "vitest";

import { ConceptLayout, ModuleLayout, NoteGroupLayout } from "./layouts";
import {
  useConceptRouteContext,
  useModuleRouteContext,
  useNoteGroupRouteContext
} from "./routeContext";

function ModuleProbe() {
  const context = useModuleRouteContext();
  return <div data-module={context.moduleCode} data-subject={context.subjectCode} />;
}

function NoteGroupProbe() {
  const context = useNoteGroupRouteContext();
  return (
    <div
      data-module={context.moduleCode}
      data-note-group={context.noteGroupCode}
      data-subject={context.subjectCode}
    />
  );
}

function ConceptProbe() {
  const context = useConceptRouteContext();
  return (
    <div
      data-concept={context.conceptCode}
      data-module={context.moduleCode}
      data-subject={context.subjectCode}
    />
  );
}

describe("route context layouts", () => {
  test("exposes Module route params", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/app/subject/sub/module/mod"]}>
        <Routes>
          <Route path="/app/subject/:subjectCode/module/:moduleCode" element={<ModuleLayout />}>
            <Route index element={<ModuleProbe />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(html).toContain('data-subject="sub"');
    expect(html).toContain('data-module="mod"');
  });

  test("exposes Note Group route params", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/app/subject/sub/module/mod/note-groups/ng"]}>
        <Routes>
          <Route
            path="/app/subject/:subjectCode/module/:moduleCode/note-groups/:noteGroupCode"
            element={<NoteGroupLayout />}
          >
            <Route index element={<NoteGroupProbe />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(html).toContain('data-subject="sub"');
    expect(html).toContain('data-module="mod"');
    expect(html).toContain('data-note-group="ng"');
  });

  test("exposes Concept route params", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/app/subject/sub/module/mod/concepts/con"]}>
        <Routes>
          <Route
            path="/app/subject/:subjectCode/module/:moduleCode/concepts/:conceptCode"
            element={<ConceptLayout />}
          >
            <Route index element={<ConceptProbe />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(html).toContain('data-subject="sub"');
    expect(html).toContain('data-module="mod"');
    expect(html).toContain('data-concept="con"');
  });
});
