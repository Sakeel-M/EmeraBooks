import { useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";

const KEY_USER_ID = "impersonate-user-id";
const KEY_EMAIL = "impersonate-email";

export function useImpersonation() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // On app domain: pick up impersonation from URL params (set by admin domain redirect)
  useEffect(() => {
    const uid = searchParams.get("_imp_uid");
    const email = searchParams.get("_imp_email");
    if (uid) {
      sessionStorage.setItem(KEY_USER_ID, uid);
      if (email) sessionStorage.setItem(KEY_EMAIL, email);
      // Remove params from URL without reload
      searchParams.delete("_imp_uid");
      searchParams.delete("_imp_email");
      setSearchParams(searchParams, { replace: true });
      queryClient.clear();
    }
  }, [searchParams, setSearchParams, queryClient]);

  const isImpersonating = !!sessionStorage.getItem(KEY_USER_ID);
  const targetUserId = sessionStorage.getItem(KEY_USER_ID);
  const targetEmail = sessionStorage.getItem(KEY_EMAIL);

  const startImpersonation = useCallback(
    (userId: string, email: string) => {
      sessionStorage.setItem(KEY_USER_ID, userId);
      sessionStorage.setItem(KEY_EMAIL, email);
      queryClient.clear();
      // Always open on app domain so the user sees the full app
      const appUrl = `https://app.emarabooks.com/?_imp_uid=${encodeURIComponent(userId)}&_imp_email=${encodeURIComponent(email)}`;
      window.open(appUrl, "_blank");
    },
    [queryClient],
  );

  const stopImpersonation = useCallback(() => {
    sessionStorage.removeItem(KEY_USER_ID);
    sessionStorage.removeItem(KEY_EMAIL);
    queryClient.clear();
    // If on app domain, just go home. If opened from admin, close the tab.
    navigate("/");
    window.location.reload();
  }, [queryClient, navigate]);

  return { isImpersonating, targetUserId, targetEmail, startImpersonation, stopImpersonation };
}
