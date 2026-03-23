import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

const KEY_USER_ID = "impersonate-user-id";
const KEY_EMAIL = "impersonate-email";

export function useImpersonation() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const isImpersonating = !!sessionStorage.getItem(KEY_USER_ID);
  const targetUserId = sessionStorage.getItem(KEY_USER_ID);
  const targetEmail = sessionStorage.getItem(KEY_EMAIL);

  const startImpersonation = useCallback(
    (userId: string, email: string) => {
      sessionStorage.setItem(KEY_USER_ID, userId);
      sessionStorage.setItem(KEY_EMAIL, email);
      queryClient.clear();
      navigate("/");
    },
    [queryClient, navigate],
  );

  const stopImpersonation = useCallback(() => {
    sessionStorage.removeItem(KEY_USER_ID);
    sessionStorage.removeItem(KEY_EMAIL);
    queryClient.clear();
    navigate("/admin/users");
  }, [queryClient, navigate]);

  return { isImpersonating, targetUserId, targetEmail, startImpersonation, stopImpersonation };
}
