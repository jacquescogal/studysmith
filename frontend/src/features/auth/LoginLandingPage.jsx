import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { loginWithPassword } from "@/api";
import { setGuestMode } from "@/auth/guestMode";
import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { AuthLayout } from "./AuthLayout";

const loginErrorMessage = "Log in failed. Check your credentials and try again.";
const loginErrorId = "login-error";

export function LoginLandingPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!auth.loading && auth.isAuthenticated) {
      navigate("/app", { replace: true });
    }
  }, [auth.isAuthenticated, auth.loading, navigate]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const result = await loginWithPassword({ identifier, password });
      await auth.installPasswordSession(result);
      setGuestMode(false);
      navigate("/app", { replace: true });
    } catch {
      setError(loginErrorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleContinueAsGuest() {
    setGuestMode(true);
    navigate("/app");
  }

  return (
    <AuthLayout
      title="Log in to StudySmith"
      subtitle="Use your username or email to continue into your study workspace."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="identifier">
            Username or email
          </label>
          <Input
            aria-describedby={error ? loginErrorId : undefined}
            aria-invalid={Boolean(error)}
            autoComplete="username"
            id="identifier"
            name="identifier"
            onChange={(event) => setIdentifier(event.target.value)}
            required
            value={identifier}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="password">
            Password
          </label>
          <Input
            aria-describedby={error ? loginErrorId : undefined}
            aria-invalid={Boolean(error)}
            autoComplete="current-password"
            id="password"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </div>

        {error ? (
          <p className="text-sm text-destructive" id={loginErrorId} role="alert">
            {error}
          </p>
        ) : null}

        <Button className="w-full" disabled={isSubmitting || auth.loading} type="submit">
          {isSubmitting ? "Logging in..." : "Log in"}
        </Button>
      </form>

      <div className="mt-6 flex flex-col gap-3 text-sm">
        <Button className="w-full" onClick={handleContinueAsGuest} type="button" variant="outline">
          Continue as guest
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-2 text-muted-foreground">
          <Link className="font-medium text-primary hover:underline" to="/register">
            Register
          </Link>
          <Link className="font-medium text-primary hover:underline" to="/forgot-password">
            Forgot password?
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
