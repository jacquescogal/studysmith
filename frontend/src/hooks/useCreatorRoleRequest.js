import { useCallback, useState } from "react";

import { requestCreatorRole } from "@/api";

export function useCreatorRoleRequest({
  setAuthMessage,
  setAuthUiError,
  setCurrentUserProfile
} = {}) {
  const [creatorRoleRequesting, setCreatorRoleRequesting] = useState(false);

  const handleRequestCreatorRole = useCallback(async () => {
    if (creatorRoleRequesting) {
      return;
    }
    setCreatorRoleRequesting(true);
    setAuthUiError("");
    setAuthMessage("");
    try {
      const profile = await requestCreatorRole();
      setCurrentUserProfile(profile);
      setAuthMessage("Creator role requested.");
    } catch (error) {
      setAuthUiError(error.message || "Failed to request creator role");
    } finally {
      setCreatorRoleRequesting(false);
    }
  }, [creatorRoleRequesting, setAuthMessage, setAuthUiError, setCurrentUserProfile]);

  return { creatorRoleRequesting, handleRequestCreatorRole };
}
