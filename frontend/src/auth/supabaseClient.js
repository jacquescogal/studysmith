import { createClient } from "@supabase/supabase-js";

let cachedClient = null;
let cachedConfigKey = "";

function getSupabaseConfig() {
  const url = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
  const publishableKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "").trim();
  return { url, publishableKey };
}

export function isSupabaseConfigured() {
  const { url, publishableKey } = getSupabaseConfig();
  return Boolean(url && publishableKey);
}

export function getLocalMailpitUrl() {
  const { url } = getSupabaseConfig();
  if (url === "http://127.0.0.1:54321" || url === "http://localhost:54321") {
    return "http://127.0.0.1:54324";
  }
  return "";
}

export function getSupabaseClient() {
  const { url, publishableKey } = getSupabaseConfig();
  if (!url || !publishableKey) {
    return null;
  }

  const configKey = `${url}:${publishableKey}`;
  if (!cachedClient || cachedConfigKey !== configKey) {
    cachedClient = createClient(url, publishableKey);
    cachedConfigKey = configKey;
  }
  return cachedClient;
}
