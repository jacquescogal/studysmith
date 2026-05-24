import { afterEach, describe, expect, test, vi } from "vitest";

import { getLocalMailpitUrl, getSupabaseClient, isSupabaseConfigured } from "./supabaseClient";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Supabase client configuration", () => {
  test("reports unconfigured when env values are missing", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");

    expect(isSupabaseConfigured()).toBe(false);
  });

  test("reports configured when URL and publishable key are present", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");

    expect(isSupabaseConfigured()).toBe(true);
  });

  test("returns null when config is missing", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");

    expect(getSupabaseClient()).toBeNull();
  });

  test("returns the local Mailpit URL only for local Supabase Auth", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "http://127.0.0.1:54321");

    expect(getLocalMailpitUrl()).toBe("http://127.0.0.1:54324");

    vi.stubEnv("VITE_SUPABASE_URL", "https://project-ref.supabase.co");

    expect(getLocalMailpitUrl()).toBe("");
  });
});
