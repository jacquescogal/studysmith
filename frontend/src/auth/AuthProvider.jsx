import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

import { clearAccessTokenProvider, setAccessTokenProvider } from "@/api";
import { getSupabaseClient, isSupabaseConfigured } from "./supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const isConfigured = isSupabaseConfigured();
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState("");
  const sessionRef = useRef(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    setAccessTokenProvider(() => sessionRef.current?.access_token || "");
    return () => clearAccessTokenProvider();
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return undefined;
    }

    let isMounted = true;
    supabase.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (!isMounted) {
          return;
        }
        if (sessionError) {
          setError(sessionError.message);
        }
        setSession(data?.session || null);
        setLoading(false);
      })
      .catch((sessionError) => {
        if (!isMounted) {
          return;
        }
        setError(sessionError?.message || "Failed to load authentication session");
        setLoading(false);
      });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setError("");
      setLoading(false);
    });

    return () => {
      isMounted = false;
      data?.subscription?.unsubscribe();
    };
  }, [supabase]);

  const value = useMemo(
    () => ({
      error,
      isAuthenticated: Boolean(session?.user),
      isConfigured,
      loading,
      session,
      user: session?.user || null,
      async signInWithEmail(email) {
        if (!supabase) {
          throw new Error("Supabase authentication is not configured");
        }
        const normalizedEmail = String(email || "").trim().toLowerCase();
        if (!normalizedEmail) {
          throw new Error("Email is required");
        }
        const { error: signInError } = await supabase.auth.signInWithOtp({
          email: normalizedEmail,
          options: {
            emailRedirectTo: window.location.origin
          }
        });
        if (signInError) {
          throw signInError;
        }
      },
      async signOut() {
        if (!supabase) {
          return;
        }
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) {
          throw signOutError;
        }
        setSession(null);
      }
    }),
    [error, isConfigured, loading, session, supabase]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return value;
}
