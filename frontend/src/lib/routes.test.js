import { describe, expect, test } from "vitest";

import {
  conceptPath,
  matchAppRoute,
  moduleMindMapPath,
  noteGroupMindMapPath
} from "./routes";

describe("mind map routes", () => {
  test("builds and matches module mind map routes", () => {
    const pathname = moduleMindMapPath("S1", "M1");

    expect(pathname).toBe("/app/subject/S1/module/M1/mind-map");

    const match = matchAppRoute(pathname);
    expect(match.moduleMindMap).toBeTruthy();
    expect(match.subjectCode).toBe("S1");
    expect(match.moduleCode).toBe("M1");
    expect(match.panel).toBe("mind-map");
  });

  test("builds and matches note group mind map routes", () => {
    const pathname = noteGroupMindMapPath("S1", "M1", "N1");

    expect(pathname).toBe("/app/subject/S1/module/M1/note-groups/N1/mind-map");

    const match = matchAppRoute(pathname);
    expect(match.noteGroupMindMap).toBeTruthy();
    expect(match.subjectCode).toBe("S1");
    expect(match.moduleCode).toBe("M1");
    expect(match.noteGroupCode).toBe("N1");
    expect(match.panel).toBe("mind-map");
  });

  test("builds and matches concept routes", () => {
    const pathname = conceptPath("S1", "M1", "C1", "study-cards");

    expect(pathname).toBe("/app/subject/S1/module/M1/concepts/C1/study-cards");

    const match = matchAppRoute(pathname);
    expect(match.concept).toBeTruthy();
    expect(match.subjectCode).toBe("S1");
    expect(match.moduleCode).toBe("M1");
    expect(match.conceptCode).toBe("C1");
    expect(match.topicCode).toBe("C1");
    expect(match.panel).toBe("study-cards");
  });
});
