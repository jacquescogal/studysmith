import React, { useState } from "react";
import { Link } from "react-router-dom";

import { registerWithPassword } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { AuthLayout } from "./AuthLayout";
import { PasswordPolicyChecklist } from "./PasswordPolicyChecklist";
import { validatePassword } from "./passwordPolicy";

const fallbackMessage = "Check your email to confirm your account.";
const registerErrorId = "register-error";
const registerStatusId = "register-status";
const registerPasswordRequirementsId = "register-password-requirements";

export function RegisterPage() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setErrorField("");
    setMessage("");
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      setError(passwordValidation.message);
      setErrorField("password");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setErrorField("confirmPassword");
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await registerWithPassword({ email, username, password });
      setMessage(result?.message || fallbackMessage);
    } catch (registerError) {
      setError(registerError?.message || "Registration failed.");
      setErrorField("form");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Register to save progress and contribute to StudySmith learning spaces."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="email">
            Email
          </label>
          <Input
            aria-describedby={errorField === "form" ? registerErrorId : undefined}
            aria-invalid={errorField === "form"}
            autoComplete="email"
            id="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="username">
            Username
          </label>
          <Input
            aria-describedby={errorField === "form" ? registerErrorId : undefined}
            aria-invalid={errorField === "form"}
            autoComplete="username"
            id="username"
            onChange={(event) => setUsername(event.target.value)}
            required
            value={username}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="new-password">
            Password
          </label>
          <Input
            aria-describedby={
              errorField === "password"
                ? `${registerPasswordRequirementsId} ${registerErrorId}`
                : registerPasswordRequirementsId
            }
            aria-invalid={errorField === "password" || errorField === "form"}
            autoComplete="new-password"
            id="new-password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
          <div id={registerPasswordRequirementsId}>
            <PasswordPolicyChecklist password={password} />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="confirm-password">
            Confirm password
          </label>
          <Input
            aria-describedby={error ? registerErrorId : undefined}
            aria-invalid={errorField === "confirmPassword" || errorField === "form"}
            autoComplete="new-password"
            id="confirm-password"
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            type="password"
            value={confirmPassword}
          />
        </div>

        {error ? (
          <p className="text-sm text-destructive" id={registerErrorId} role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p aria-live="polite" className="text-sm text-muted-foreground" id={registerStatusId}>
            {message}
          </p>
        ) : null}

        <Button className="w-full" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Creating account..." : "Register"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link className="font-medium text-primary hover:underline" to="/login">
          Back to login
        </Link>
      </p>
    </AuthLayout>
  );
}
