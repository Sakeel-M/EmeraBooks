import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { flaskApi } from "@/lib/flaskApi";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    const checkAuth = async (session: any) => {
      if (!session) {
        queryClient.clear();
        setAuthenticated(false);
        // Preserve intended URL so Auth page can redirect back after login
        const returnTo = location.pathname + location.search;
        navigate(`/auth?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
        setLoading(false);
        return;
      }

      setAuthenticated(true);

      // /pricing and /billing/success skip the subscription check, but they still
      // require an org — payment is only asked AFTER business profile setup.
      const billingExempt = ["/pricing", "/billing/success"].includes(location.pathname);
      const orgExempt = location.pathname === "/onboarding";

      // Platform admins bypass org + subscription gates entirely
      let isAdmin = false;
      try {
        const me = await flaskApi.get<{ is_admin: boolean }>("/me/is-admin");
        isAdmin = !!me?.is_admin;
      } catch {
        // If Flask API is down, fall through to normal checks
      }

      if (isAdmin) {
        // Admin landed on /pricing — bounce to dashboard
        if (location.pathname === "/pricing") {
          navigate("/", { replace: true });
          setLoading(false);
          return;
        }
        setLoading(false);
        return;
      }

      // Check if user has an org
      if (!orgExempt) {
        try {
          const result = await flaskApi.get<{ has_org: boolean }>("/me/org-membership");
          if (!result?.has_org) {
            navigate("/onboarding", { replace: true });
            setLoading(false);
            return;
          }
        } catch {
          // If Flask API is down, let user through (graceful degradation)
        }
      }

      // Check subscription (hard gate — except billing/onboarding pages)
      if (!billingExempt) {
        try {
          const sub = await flaskApi.get<{ status?: string } | null>("/billing/subscription");
          const isActive = sub && (sub.status === "active" || sub.status === "trialing");
          if (!isActive) {
            navigate("/pricing", { replace: true });
            setLoading(false);
            return;
          }
        } catch {
          // If billing endpoint is down, let user through (graceful degradation)
        }
      }

      setLoading(false);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      checkAuth(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        queryClient.clear();
        setAuthenticated(false);
        navigate("/auth", { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, queryClient, location.pathname]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!authenticated) return null;

  return <>{children}</>;
}
