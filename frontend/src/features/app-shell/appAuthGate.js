export const canUseProtectedAppActions = (auth, currentUserProfile) =>
  Boolean(
    auth.isAuthenticated &&
      currentUserProfile?.username &&
      auth.user?.id &&
      currentUserProfile.supabase_user_id === auth.user.id
  );
