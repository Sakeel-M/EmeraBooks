import { useQuery } from "@tanstack/react-query";
import { flaskApi } from "@/lib/flaskApi";

interface OrgResponse {
  org: any;
  org_id: string;
  role: string;
  clients: any[];
  has_org: boolean;
}

export function useOrg() {
  const { data, isLoading } = useQuery({
    queryKey: ["org-data"],
    queryFn: () => flaskApi.get<OrgResponse | null>("/me/org"),
    staleTime: 5 * 60 * 1000,
  });

  return {
    org: data?.org ?? null,
    orgId: data?.org_id ?? null,
    role: data?.role ?? null,
    members: [],  // Members not returned by default — fetch separately if needed
    clients: data?.clients ?? [],
    hasOrg: data?.has_org ?? false,
    isLoading,
  };
}
