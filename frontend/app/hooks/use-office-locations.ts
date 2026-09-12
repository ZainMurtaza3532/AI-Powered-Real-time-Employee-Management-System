import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { api, getErrorMessage } from "@/lib/api";
import type {
  MyIpResponse,
  OfficeLocation,
  OfficeLocationInput,
  OfficeLocationListResponse,
  OfficeLocationResponse,
} from "@/types";

export const officeLocationKeys = {
  all: ["office-locations"] as const,
  list: (search: string, isActive?: boolean, limit?: number | null, offset?: number) =>
    ["office-locations", "list", { search, isActive, limit, offset }] as const,
  detail: (id: string) => ["office-locations", id] as const,
  myIp: ["office-locations", "my-ip"] as const,
};

export interface OfficeLocationQueryParams {
  search?: string;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Admin: List of office branch locations with IP whitelists.
 */
export function useOfficeLocations(params: OfficeLocationQueryParams = {}) {
  const { search = "", isActive, limit, offset = 0 } = params;

  return useQuery({
    queryKey: officeLocationKeys.list(search, isActive, limit ?? null, offset),
    queryFn: async () => {
      const { data } = await api.get<OfficeLocationListResponse>("/office-locations", {
        params: {
          ...(search ? { search } : {}),
          ...(isActive !== undefined ? { isActive } : {}),
          ...(limit !== undefined ? { limit, offset } : {}),
        },
      });
      return data;
    },
    placeholderData: (previous) => previous,
  });
}

/**
 * Admin: Single branch location details.
 */
export function useOfficeLocation(id?: string) {
  return useQuery({
    queryKey: officeLocationKeys.detail(id ?? ""),
    queryFn: async () => {
      const { data } = await api.get<OfficeLocationResponse>(`/office-locations/${id}`);
      return data.officeLocation;
    },
    enabled: Boolean(id),
  });
}

/**
 * Utility: Inspect caller's detected public IP and whether it's currently whitelisted.
 */
export function useMyIp() {
  return useQuery({
    queryKey: officeLocationKeys.myIp,
    queryFn: async () => {
      const { data } = await api.get<MyIpResponse>("/office-locations/my-ip");
      return data;
    },
    staleTime: 60 * 1000,
  });
}

/**
 * Admin: Create a new office branch with whitelisted IPs.
 */
export function useCreateOfficeLocation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (input: OfficeLocationInput) => {
      const { data } = await api.post<OfficeLocationResponse>("/office-locations", input);
      return data.officeLocation;
    },
    onSuccess: (location) => {
      queryClient.invalidateQueries({ queryKey: officeLocationKeys.all });
      toast.success(`Office branch "${location.branchName}" created`);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

/**
 * Admin: Update branch name, IP whitelist, or active status.
 */
export function useUpdateOfficeLocation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async ({ id, ...input }: OfficeLocationInput & { id: string }) => {
      const { data } = await api.put<OfficeLocationResponse>(`/office-locations/${id}`, input);
      return data.officeLocation;
    },
    onSuccess: (location) => {
      queryClient.invalidateQueries({ queryKey: officeLocationKeys.all });
      queryClient.invalidateQueries({ queryKey: officeLocationKeys.detail(location._id) });
      toast.success(`Office branch "${location.branchName}" updated`);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

/**
 * Admin: Delete an office branch location.
 */
export function useDeleteOfficeLocation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete<{ message: string }>(`/office-locations/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: officeLocationKeys.all });
      toast.success("Office branch deleted");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}
