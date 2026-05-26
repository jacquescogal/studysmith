import { expect, test } from "@playwright/test";

const routes = [
  "/",
  "/app/subject/S1",
  "/app/subject/S1/module/M1",
  "/app/subject/S1/module/M1/note-groups/N1",
  "/app/subject/S1/module/M1/note-groups/N1/study-cards",
  "/app/subject/S1/module/M1/note-groups/N1/question-cards",
  "/app/subject/S1/module/M1/concepts/C1",
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
