import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { useConceptPageModel } from "@/features/concepts/useConceptPageModel";
import { useModulePageModel } from "@/features/modules/useModulePageModel";
import { useNoteGroupPageModel } from "@/features/note-groups/useNoteGroupPageModel";
import {
  ConceptOverviewPage,
  ModuleOverviewPage,
  NoteGroupOverviewPage
} from "./pages";

vi.mock("@/features/modules/useModulePageModel", () => ({
  useModulePageModel: vi.fn(() => ({ owner: "module" }))
}));

vi.mock("@/features/note-groups/useNoteGroupPageModel", () => ({
  useNoteGroupPageModel: vi.fn(() => ({ owner: "note-group" }))
}));

vi.mock("@/features/concepts/useConceptPageModel", () => ({
  useConceptPageModel: vi.fn(() => ({ owner: "concept" }))
}));

describe("route page model ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("Module route pages consume the Module page model directly", () => {
    const html = renderToStaticMarkup(
      <ModuleOverviewPage
        renderAppShell={({ routePageModels }) => (
          <span>{routePageModels.modulePageModel.owner}</span>
        )}
      />
    );

    expect(useModulePageModel).toHaveBeenCalledOnce();
    expect(html).toContain("module");
  });

  test("Note Group route pages consume the Note Group page model directly", () => {
    const html = renderToStaticMarkup(
      <NoteGroupOverviewPage
        renderAppShell={({ routePageModels }) => (
          <span>{routePageModels.noteGroupPageModel.owner}</span>
        )}
      />
    );

    expect(useNoteGroupPageModel).toHaveBeenCalledOnce();
    expect(html).toContain("note-group");
  });

  test("Concept route pages consume the Concept page model directly", () => {
    const html = renderToStaticMarkup(
      <ConceptOverviewPage
        renderAppShell={({ routePageModels }) => (
          <span>{routePageModels.conceptPageModel.owner}</span>
        )}
      />
    );

    expect(useConceptPageModel).toHaveBeenCalledOnce();
    expect(html).toContain("concept");
  });
});
