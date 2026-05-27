import { expect, test } from "@playwright/test";

const graph = { nodes: [], edges: [] };

async function mockStudyWorkspaceApi(page) {
  const subject = {
    id: "subject-1",
    title: "Biology",
    short_code: "S1",
    current_user_access_level: "reader"
  };
  const module = {
    id: "module-1",
    subject_id: "subject-1",
    title: "Cell Biology",
    short_code: "M1",
    settings: {}
  };
  const noteGroup = {
    id: "note-group-1",
    module_id: "module-1",
    subject_id: "subject-1",
    title: "Cell membranes",
    short_code: "N1",
    created_at: "2026-01-01T00:00:00Z",
    generation_status: "completed",
    topic_chips: []
  };
  const concept = {
    id: "concept-1",
    module_id: "module-1",
    label: "Membrane transport",
    short_code: "C1",
    description: "Movement across membranes"
  };
  const routeContext = {
    subject_id: subject.id,
    subject_short_code: subject.short_code,
    module_id: module.id,
    module_short_code: module.short_code
  };
  const ok = (body) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (
      route.request().resourceType() === "document" ||
      path.startsWith("/@") ||
      path.startsWith("/src/") ||
      path.startsWith("/node_modules/")
    ) {
      await route.continue();
      return;
    }

    if (path === "/public/subjects" || path === "/subjects") {
      await route.fulfill(ok([subject]));
    } else if (path === "/routes/app/subject/S1") {
      await route.fulfill(ok({ subject_id: subject.id, subject_short_code: subject.short_code }));
    } else if (path === "/routes/app/subject/S1/module/M1") {
      await route.fulfill(ok(routeContext));
    } else if (path === "/routes/app/subject/S1/module/M1/note-groups/N1") {
      await route.fulfill(ok({ ...routeContext, note_group_id: noteGroup.id, note_group_short_code: noteGroup.short_code }));
    } else if (path === "/routes/app/subject/S1/module/M1/concepts/C1") {
      await route.fulfill(ok({ ...routeContext, concept_id: concept.id, concept_short_code: concept.short_code }));
    } else if (path === "/subjects/subject-1/modules") {
      await route.fulfill(ok([module]));
    } else if (path === "/modules/module-1") {
      await route.fulfill(ok(module));
    } else if (path === "/modules") {
      await route.fulfill(ok([module]));
    } else if (path === "/modules/module-1/overview") {
      await route.fulfill(ok({
        note_groups: [noteGroup],
        note_group_stats: [{ id: noteGroup.id, timeline: {} }],
        module_stats: {},
        module_timeline: {}
      }));
    } else if (path === "/modules/module-1/concepts") {
      await route.fulfill(ok([concept]));
    } else if (path === "/modules/module-1/mind-map") {
      await route.fulfill(ok(graph));
    } else if (path === "/note-groups/note-group-1") {
      await route.fulfill(ok({ ...noteGroup, formatted_sections: [], cleaned_text_markdown: "" }));
    } else if (path === "/note-groups/note-group-1/study-cards") {
      await route.fulfill(ok({ study_cards: [] }));
    } else if (path === "/note-groups/note-group-1/question-cards") {
      await route.fulfill(ok({ question_cards: [] }));
    } else if (path === "/note-groups/note-group-1/mind-map") {
      await route.fulfill(ok(graph));
    } else if (path === "/note-groups/note-group-1/question-cards/timeline") {
      await route.fulfill(ok({ timeline: {} }));
    } else if (path === "/note-groups/note-group-1/progress") {
      await route.fulfill(ok({}));
    } else if (path === "/concepts/concept-1") {
      await route.fulfill(ok(concept));
    } else if (path === "/concepts/concept-1/study-cards") {
      await route.fulfill(ok({ study_cards: [] }));
    } else if (path === "/concepts/concept-1/question-cards") {
      await route.fulfill(ok({ question_cards: [] }));
    } else if (path === "/concepts/concept-1/mind-map") {
      await route.fulfill(ok(graph));
    } else if (path === "/concepts/concept-1/question-cards/timeline") {
      await route.fulfill(ok({ timeline: {} }));
    } else {
      await route.fulfill(ok({}));
    }
  });
}

const routes = [
  "/",
  "/app/subject/S1",
  "/app/subject/S1/module/M1",
  "/app/subject/S1/module/M1/mind-map",
  "/app/subject/S1/module/M1/create-note-group",
  "/app/subject/S1/module/M1/note-groups/N1",
  "/app/subject/S1/module/M1/note-groups/N1/mind-map",
  "/app/subject/S1/module/M1/note-groups/N1/view-cards",
  "/app/subject/S1/module/M1/note-groups/N1/study-cards",
  "/app/subject/S1/module/M1/note-groups/N1/question-cards",
  "/app/subject/S1/module/M1/concepts/C1",
  "/app/subject/S1/module/M1/concepts/C1/view-cards",
  "/app/subject/S1/module/M1/concepts/C1/study-cards",
  "/app/subject/S1/module/M1/concepts/C1/question-cards"
];

test.describe("app route browser smoke", () => {
  for (const route of routes) {
    test(`loads ${route}`, async ({ page }) => {
      const pageErrors = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));

      await page.goto(route);

      await expect(page).toHaveTitle("Study System");
      await expect(page.locator("#root")).not.toBeEmpty();
      expect(pageErrors).toEqual([]);
    });
  }
});

test.describe("Module workspace sidebar persistence", () => {
  test("keeps sidebar search while navigating inside the active Module", async ({ page }) => {
    await mockStudyWorkspaceApi(page);

    await page.goto("/app/subject/S1/module/M1");

    const search = page.getByPlaceholder("Search note groups");
    await expect(search).toBeVisible();
    await search.fill("Cell");
    await page.getByRole("button", { name: /Cell membranes/ }).click();

    await expect(page).toHaveURL(/\/app\/subject\/S1\/module\/M1\/note-groups\/N1$/);
    await expect(page.getByPlaceholder("Search note groups")).toHaveValue("Cell");
  });
});
