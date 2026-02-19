import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { database } from "@/lib/database";

const clearLocalStorageData = () => {
  localStorage.removeItem("currentFileId");
  localStorage.removeItem("finance_current_file");
  localStorage.removeItem("finance_uploaded_files");
};

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const cleanupRanRef = useRef(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        queryClient.clear();
        clearLocalStorageData();
        setAuthenticated(false);
        navigate("/auth", { replace: true });
      } else {
        setAuthenticated(true);
        // Run cleanup once per session
        if (!cleanupRanRef.current) {
          cleanupRanRef.current = true;
          database.cleanupOrphanedData().catch(console.error);
        }
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        queryClient.clear();
        clearLocalStorageData();
        navigate("/auth", { replace: true });
      } else {
        setAuthenticated(true);
        if (!cleanupRanRef.current) {
          cleanupRanRef.current = true;
          database.cleanupOrphanedData().catch(console.error);
        }
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate, queryClient]);

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
