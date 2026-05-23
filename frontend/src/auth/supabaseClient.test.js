import { afterEach, describe, expect, test, vi } from "vitest";

import { getSupabaseClient, isSupabaseConfigured } from "./supabaseClient";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Supabase client configuration", () => {
  test("reports unconfigured when env values are missing", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");

    expect(isSupabaseConfigured()).toBe(false);
  });

  test("reports configured when URL and anon key are present", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key");

    expect(isSupabaseConfigured()).toBe(true);
  });

  test("returns null when config is missing", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");

    expect(getSupabaseClient()).toBeNull();
  });
});
