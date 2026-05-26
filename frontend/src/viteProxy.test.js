import { describe, expect, test } from "vitest";

import viteConfig from "../vite.config";

const proxyPattern = Object.keys(viteConfig.server.proxy)[0];

describe("Vite API proxy", () => {
  test("forwards concept API routes to the backend instead of returning the app shell", () => {
    expect(new RegExp(proxyPattern).test("/concepts/concept-1/mind-map")).toBe(true);
  });
});
