import React, { useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { AuthLayout } from "./AuthLayout";
import { PasswordPolicyChecklist } from "./PasswordPolicyChecklist";
import { validatePassword } from "./passwordPolicy";

const updatePasswordErrorId = "update-password-error";
const updatePasswordStatusId = "update-password-status";
const updatePasswordRequirementsId = "update-password-requirements";

export function UpdatePasswordPage() {
  const auth = useAuth();
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
      await auth.updatePassword(password);
      setPassword("");
      setConfirmPassword("");
      setMessage("Password updated. You can log in with your new password.");
    } catch (updateError) {
      setError(updateError?.message || "Password update failed.");
      setErrorField("form");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="Set a new password for your StudySmith account."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="updated-password">
            New password
          </label>
          <Input
            aria-describedby={
              errorField === "password"
                ? `${updatePasswordRequirementsId} ${updatePasswordErrorId}`
                : updatePasswordRequirementsId
            }
            aria-invalid={errorField === "password" || errorField === "form"}
            autoComplete="new-password"
            id="updated-password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
          <div id={updatePasswordRequirementsId}>
            <PasswordPolicyChecklist password={password} />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="confirm-updated-password">
            Confirm new password
          </label>
          <Input
            aria-describedby={error ? updatePasswordErrorId : undefined}
            aria-invalid={errorField === "confirmPassword" || errorField === "form"}
            autoComplete="new-password"
            id="confirm-updated-password"
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            type="password"
            value={confirmPassword}
          />
        </div>

        {error ? (
          <p className="text-sm text-destructive" id={updatePasswordErrorId} role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p
            aria-live="polite"
            className="text-sm text-muted-foreground"
            id={updatePasswordStatusId}
          >
            {message}
          </p>
        ) : null}

        <Button className="w-full" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Updating..." : "Update password"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-muted-foreground">
        Ready to continue?{" "}
        <Link className="font-medium text-primary hover:underline" to="/login">
          Back to login
        </Link>
      </p>
    </AuthLayout>
  );
}
