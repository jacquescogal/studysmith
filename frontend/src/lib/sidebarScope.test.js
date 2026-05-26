import { describe, expect, test } from "vitest";

import { moduleRouteSidebarScope } from "./sidebarScope";

describe("moduleRouteSidebarScope", () => {
  test("defaults module routes to note groups", () => {
    expect(moduleRouteSidebarScope()).toBe("note-groups");
    expect(moduleRouteSidebarScope({})).toBe("note-groups");
  });

  test("preserves the concepts tab when module navigation requests it", () => {
    expect(moduleRouteSidebarScope({ sidebarScope: "concepts" })).toBe("concepts");
    expect(moduleRouteSidebarScope({ sidebarScope: "topics" })).toBe("concepts");
  });
});
