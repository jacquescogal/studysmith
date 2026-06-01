import { Button } from "@/components/ui/button";

export function StudyAppAuthActions({
  auth,
  authMessage,
  authSubmitting,
  authUiError,
  canManageSelectedSubject,
  canUseProtectedActions,
  currentUserError,
  currentUserProfile,
  creatorRoleRequesting,
  handleRequestCreatorRole,
  handleSignOut,
  isAdmin,
  isAdminPanelOpen,
  isSubjectManagementOpen,
  setIsAdminPanelOpen,
  setIsSubjectManagementOpen
}) {
  const canRequestCreatorRole =
    canUseProtectedActions &&
    currentUserProfile?.app_role === "reader" &&
    !currentUserProfile?.creator_role_requested_at;
  const identity = currentUserProfile?.username || auth.user?.email;

  return (
    <div className="flex max-w-sm flex-col items-end gap-2 text-right">
      {auth.isAuthenticated ? (
        <>
          <div className="text-xs text-muted-foreground">{identity}</div>
          <div className="flex flex-wrap justify-end gap-2">
            {canRequestCreatorRole ? (
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleRequestCreatorRole}
                disabled={creatorRoleRequesting}
              >
                {creatorRoleRequesting ? "Requesting..." : "Request creator role"}
              </Button>
            ) : null}
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
          {currentUserProfile?.app_role === "reader" && currentUserProfile?.creator_role_requested_at ? (
            <p className="text-xs text-muted-foreground">Creator role request pending.</p>
          ) : null}
        </>
      ) : (
        <div className="flex justify-end">
          <Button asChild size="sm">
            <a href="/">Sign in</a>
          </Button>
        </div>
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
