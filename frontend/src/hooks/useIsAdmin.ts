import { useQuery } from "@tanstack/react-query";
import { flaskApi } from "@/lib/flaskApi";

export function useIsAdmin() {
  const { data: isAdmin = false, isLoading } = useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      const result = await flaskApi.get<{ is_admin: boolean }>("/me/is-admin");
      return result?.is_admin ?? false;
    },
    staleTime: 5 * 60 * 1000,
  });

  return { isAdmin, isLoading };
}
