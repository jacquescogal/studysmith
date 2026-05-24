import { describe, expect, test } from "vitest";

import { createSupabaseAccessTokenProvider } from "./AuthProvider";

describe("createSupabaseAccessTokenProvider", () => {
  test("reads the current Supabase session when an API request asks for a token", async () => {
    let currentSession = null;
    const provider = createSupabaseAccessTokenProvider({
      auth: {
        async getSession() {
          return { data: { session: currentSession } };
        }
      }
    });

    currentSession = { access_token: "fresh-token" };

    await expect(provider()).resolves.toBe("fresh-token");
  });
});
