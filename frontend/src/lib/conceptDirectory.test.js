import { describe, expect, test } from "vitest";

import { buildConceptDirectoryRows } from "./conceptDirectory";

const concepts = [
  { value: "root-1", label: "root_1", parentConceptId: "" },
  { value: "root-2", label: "root_2", parentConceptId: "" },
  { value: "a", label: "a", parentConceptId: "root-1" },
  { value: "b", label: "b", parentConceptId: "root-1" },
  { value: "c", label: "c", parentConceptId: "a" },
  { value: "d", label: "d", parentConceptId: "a" }
];

describe("buildConceptDirectoryRows", () => {
  test("shows only root concepts when no concept directory is selected", () => {
    expect(buildConceptDirectoryRows(concepts).map((concept) => concept.label)).toEqual(["root_1", "root_2"]);
  });

  test("shows parent navigation, current concept, and immediate children", () => {
    expect(buildConceptDirectoryRows(concepts, "root-1").map((concept) => concept.label)).toEqual([
      "..",
      "root_1",
      "a",
      "b"
    ]);
  });

  test("moves one level deeper for child concepts", () => {
    expect(buildConceptDirectoryRows(concepts, "a").map((concept) => concept.label)).toEqual(["..", "a", "c", "d"]);
  });

  test("uses the parent concept id for the up row", () => {
    expect(buildConceptDirectoryRows(concepts, "a")[0]).toMatchObject({
      value: "root-1",
      directoryRole: "up"
    });
  });

  test("normalizes concept id and parent_concept_id fields into directory rows", () => {
    const rows = buildConceptDirectoryRows(
      [
        { id: "root-1", label: "root_1", parent_concept_id: "" },
        { id: "a", label: "a", parent_concept_id: "root-1" }
      ],
      "root-1"
    );

    expect(rows).toMatchObject([
      { value: "", directoryRole: "up" },
      { value: "root-1", directoryRole: "current" },
      { value: "a", directoryRole: "concept", directoryDepth: 1 }
    ]);
  });

  test("normalizes legacy parent_topic_id fields while preserving Concept directory behavior", () => {
    const rows = buildConceptDirectoryRows(
      [
        { id: "root-1", label: "root_1", parent_topic_id: "" },
        { id: "a", label: "a", parent_topic_id: "root-1" }
      ],
      "root-1"
    );

    expect(rows.map((concept) => concept.label)).toEqual(["..", "root_1", "a"]);
    expect(rows[2]).toMatchObject({ value: "a", directoryRole: "concept" });
  });

  test("falls back to root concepts when selected concept is missing", () => {
    expect(buildConceptDirectoryRows(concepts, "missing").map((concept) => concept.label)).toEqual([
      "root_1",
      "root_2"
    ]);
  });
});
