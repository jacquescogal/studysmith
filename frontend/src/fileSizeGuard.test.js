import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "vitest";

const SOURCE_ROOT = join(process.cwd(), "src");
const MAX_SOURCE_LINES = 1000;
const SOURCE_EXTENSIONS = [".js", ".jsx"];
const IGNORED_SEGMENTS = new Set(["node_modules", "dist", "build", "coverage"]);

function listSourceFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      return IGNORED_SEGMENTS.has(entry) ? [] : listSourceFiles(fullPath);
    }

    if (!stats.isFile() || !SOURCE_EXTENSIONS.some((extension) => fullPath.endsWith(extension))) {
      return [];
    }

    return [fullPath];
  });
}

function lineCount(filePath) {
  const contents = readFileSync(filePath, "utf8");
  return contents.split(/\r?\n/).length;
}

describe("frontend source file size guardrail", () => {
  test("keeps maintained JavaScript and JSX files at or below 1000 lines", () => {
    const oversizedFiles = listSourceFiles(SOURCE_ROOT)
      .map((filePath) => ({
        filePath: relative(process.cwd(), filePath),
        lines: lineCount(filePath)
      }))
      .filter(({ lines }) => lines > MAX_SOURCE_LINES);

    expect(oversizedFiles).toEqual([]);
  });
});
