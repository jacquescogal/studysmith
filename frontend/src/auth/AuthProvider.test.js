import { describe, expect, test } from "vitest";

import { createSupabaseAccessTokenProvider, installSupabasePasswordSession } from "./AuthProvider";

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

describe("installSupabasePasswordSession", () => {
  test("sets a Supabase session from password auth tokens", async () => {
    const session = { access_token: "access-token", refresh_token: "refresh-token" };
    const supabase = {
      auth: {
        async setSession(payload) {
          expect(payload).toEqual({
            access_token: "access-token",
            refresh_token: "refresh-token"
          });
          return { data: { session } };
        }
      }
    };

    await expect(installSupabasePasswordSession(supabase, session)).resolves.toBe(session);
  });

  test("accepts the backend login response shape", async () => {
    const session = { access_token: "access-token", refresh_token: "refresh-token" };
    const supabase = {
      auth: {
        async setSession(payload) {
          expect(payload).toEqual({
            access_token: "access-token",
            refresh_token: "refresh-token"
          });
          return { data: { session } };
        }
      }
    };

    await expect(
      installSupabasePasswordSession(supabase, {
        session,
        user: { id: "user-1", username: "ReaderOne" }
      })
    ).resolves.toBe(session);
  });

  test("requires access and refresh tokens", async () => {
    const supabase = {
      auth: {
        async setSession() {
          throw new Error("setSession should not be called");
        }
      }
    };

    await expect(
      installSupabasePasswordSession(supabase, { access_token: "access-token" })
    ).rejects.toThrow("Password session requires access and refresh tokens");
  });

  test("throws Supabase setSession errors", async () => {
    const supabase = {
      auth: {
        async setSession() {
          return { error: new Error("Invalid session") };
        }
      }
    };

    await expect(
      installSupabasePasswordSession(supabase, {
        access_token: "access-token",
        refresh_token: "refresh-token"
      })
    ).rejects.toThrow("Invalid session");
  });
});
