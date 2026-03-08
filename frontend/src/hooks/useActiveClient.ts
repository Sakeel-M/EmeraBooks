import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { flaskApi } from "@/lib/flaskApi";

interface ActiveClientResponse {
  client_id: string;
  client: any;
  org_id: string;
  org_name: string | null;
  currency: string;
}

export function useActiveClient() {
  const queryClient = useQueryClient();

  const { data: activeClient, isLoading } = useQuery({
    queryKey: ["active-client"],
    queryFn: () => flaskApi.get<ActiveClientResponse | null>("/me/active-client"),
    staleTime: 0,
  });

  const switchClient = useMutation({
    mutationFn: (clientId: string) =>
      flaskApi.put("/me/active-client", { client_id: clientId }),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });

  return {
    clientId: activeClient?.client_id ?? null,
    client: activeClient?.client ?? null,
    orgId: activeClient?.org_id ?? null,
    orgName: activeClient?.org_name ?? null,
    currency: activeClient?.currency ?? "AED",
    isLoading,
    switchClient: switchClient.mutate,
    isSwitching: switchClient.isPending,
  };
}
