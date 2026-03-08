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
        navigate("/auth", { replace: true });
        setLoading(false);
        return;
      }

      setAuthenticated(true);

      // Check if user has an org (skip if already on /onboarding)
      if (location.pathname !== "/onboarding") {
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
