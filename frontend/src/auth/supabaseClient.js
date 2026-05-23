import { createClient } from "@supabase/supabase-js";

let cachedClient = null;
let cachedConfigKey = "";

function getSupabaseConfig() {
  const url = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
  const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
  return { url, anonKey };
}

export function isSupabaseConfigured() {
  const { url, anonKey } = getSupabaseConfig();
  return Boolean(url && anonKey);
}

export function getSupabaseClient() {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) {
    return null;
  }

  const configKey = `${url}:${anonKey}`;
  if (!cachedClient || cachedConfigKey !== configKey) {
    cachedClient = createClient(url, anonKey);
    cachedConfigKey = configKey;
  }
  return cachedClient;
}
