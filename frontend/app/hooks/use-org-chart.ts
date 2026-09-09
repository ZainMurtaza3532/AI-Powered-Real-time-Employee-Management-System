import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { OrgStructureResponse } from "@/types";

export function useOrgChart() {
  return useQuery<OrgStructureResponse>({
    queryKey: ["org-chart"],
    queryFn: async () => {
      const { data } = await api.get<OrgStructureResponse>("/org-chart");
      return data;
    },
    staleTime: 60 * 1000,
  });
}
