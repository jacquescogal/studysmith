import { Button } from "@/components/ui/button";

export function StudyAppAuthActions({
  auth,
  authEmail,
  authMessage,
  authSubmitting,
  authUiError,
  canManageSelectedSubject,
  currentUserError,
  handleSignIn,
  handleSignOut,
  isAdmin,
  isAdminPanelOpen,
  isSubjectManagementOpen,
  setAuthEmail,
  setIsAdminPanelOpen,
  setIsSubjectManagementOpen
}) {
  return (
    <div className="flex max-w-sm flex-col items-end gap-2 text-right">
      {auth.isAuthenticated ? (
        <>
          <div className="text-xs text-muted-foreground">{auth.user?.email}</div>
          <div className="flex flex-wrap justify-end gap-2">
            {isAdmin ? (
              <Button
                type="button"
                variant={isAdminPanelOpen ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setIsAdminPanelOpen((open) => !open);
                  setIsSubjectManagementOpen(false);
                }}
              >
                Admin
              </Button>
            ) : null}
            {canManageSelectedSubject ? (
              <Button
                type="button"
                variant={isSubjectManagementOpen ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setIsSubjectManagementOpen((open) => !open);
                  setIsAdminPanelOpen(false);
                }}
              >
                Subject
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              disabled={authSubmitting}
            >
              Sign out
            </Button>
          </div>
        </>
      ) : auth.isConfigured ? (
        <form className="flex flex-wrap justify-end gap-2" onSubmit={handleSignIn}>
          <input
            className="h-9 min-w-48 rounded-md border bg-background px-3 text-sm"
            type="email"
            value={authEmail}
            onChange={(event) => setAuthEmail(event.target.value)}
            placeholder="Email"
            disabled={auth.loading || authSubmitting}
          />
          <Button type="submit" size="sm" disabled={auth.loading || authSubmitting || !authEmail.trim()}>
            {authSubmitting ? "Sending..." : "Sign in"}
          </Button>
        </form>
      ) : (
        <p className="max-w-xs text-xs text-muted-foreground">
          Supabase env vars are required for sign in.
        </p>
      )}
      {authMessage ? <p className="text-xs text-muted-foreground">{authMessage}</p> : null}
      {authUiError || auth.error ? (
        <p className="text-xs font-medium text-destructive">{authUiError || auth.error}</p>
      ) : null}
      {currentUserError ? (
        <p className="text-xs font-medium text-destructive">{currentUserError}</p>
      ) : null}
    </div>
  );
}
