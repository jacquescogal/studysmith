import { useEffect, useState } from "react";

import { updateUsername } from "@/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

export const getRequireUsernameDialogError = (saveError, signOutError) =>
  saveError || signOutError || "";

export const getRequireUsernameSignOutLabel = (signOutSubmitting) =>
  signOutSubmitting ? "Signing out..." : "Sign out";

export function RequireUsernameDialog({
  open,
  profile,
  onUpdated,
  onSignOut,
  signOutError = "",
  signOutSubmitting = false
}) {
  const [username, setUsername] = useState(profile?.username || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setUsername(profile?.username || "");
      setError("");
      setSaving(false);
    }
  }, [open, profile?.username]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextUsername = username.trim();

    if (!nextUsername || saving) {
      return;
    }

    setSaving(true);
    setError("");
    try {
      const updatedProfile = await updateUsername(nextUsername);
      onUpdated(updatedProfile);
    } catch (submitError) {
      setError(submitError.message || "Failed to save username");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false}>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Choose a username</DialogTitle>
            <DialogDescription>
              Your account needs a username before you can continue.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="required-username">
              Username
            </label>
            <input
              autoComplete="username"
              autoFocus
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              disabled={saving}
              id="required-username"
              onChange={(event) => setUsername(event.target.value)}
              type="text"
              value={username}
            />
          </div>
          {getRequireUsernameDialogError(error, signOutError) ? (
            <p className="text-sm font-medium text-destructive">
              {getRequireUsernameDialogError(error, signOutError)}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onSignOut}
              disabled={saving || signOutSubmitting}
            >
              {getRequireUsernameSignOutLabel(signOutSubmitting)}
            </Button>
            <Button type="submit" disabled={saving || !username.trim()}>
              {saving ? "Saving..." : "Save username"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
