import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { flaskApi } from "@/lib/flaskApi";
import { Loader2 } from "lucide-react";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  // Always fetch fresh — don't rely on stale cache
  const { data, isLoading, isFetched } = useQuery({
    queryKey: ["admin-guard-check"],
    queryFn: async () => {
      const result = await flaskApi.get<{ is_admin: boolean }>("/me/is-admin");
      return result?.is_admin ?? false;
    },
    staleTime: 0, // Always refetch
    gcTime: 0,
  });

  const isAdmin = data === true;

  useEffect(() => {
    if (isFetched && !isAdmin) {
      navigate("/", { replace: true });
    }
  }, [isFetched, isAdmin, navigate]);

  if (isLoading || !isFetched) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return <>{children}</>;
}
