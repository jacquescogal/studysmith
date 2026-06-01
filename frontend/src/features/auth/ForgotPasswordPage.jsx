import React, { useState } from "react";
import { Link } from "react-router-dom";

import { forgotPassword } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { AuthLayout } from "./AuthLayout";

const fallbackMessage = "If an account exists for that email, a reset link has been sent.";
const forgotPasswordStatusId = "forgot-password-status";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setIsSubmitting(true);
    try {
      const result = await forgotPassword(email);
      setMessage(result?.message || fallbackMessage);
    } catch (error) {
      setMessage(fallbackMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your account email and StudySmith will send the next step."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="reset-email">
            Email
          </label>
          <Input
            autoComplete="email"
            id="reset-email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </div>

        {message ? (
          <p
            aria-live="polite"
            className="text-sm text-muted-foreground"
            id={forgotPasswordStatusId}
          >
            {message}
          </p>
        ) : null}

        <Button className="w-full" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Sending..." : "Send reset link"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link className="font-medium text-primary hover:underline" to="/login">
          Back to login
        </Link>
      </p>
    </AuthLayout>
  );
}
