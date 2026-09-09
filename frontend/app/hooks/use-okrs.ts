import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getErrorMessage } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type { KeyResult, Okr, OkrLevel, OkrStatus } from "@/types";

export interface OkrQueryParams {
  period?: string;
  level?: string;
  status?: string;
  department?: string;
}

export function useOkrs(params: OkrQueryParams = {}) {
  return useQuery<{ okrs: Okr[] }>({
    queryKey: ["okrs", params],
    queryFn: async () => {
      const { data } = await api.get<{ okrs: Okr[] }>("/okrs", {
        params,
      });
      return data;
    },
  });
}

export function useCreateOkr() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation<
    { message: string; okr: Okr },
    Error,
    {
      title: string;
      description?: string;
      period?: string;
      level?: OkrLevel;
      department?: string;
      keyResults?: Array<{
        title: string;
        targetValue: number;
        currentValue?: number;
        unit?: string;
      }>;
    }
  >({
    mutationFn: async (payload) => {
      const { data } = await api.post("/okrs", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["okrs"] });
      toast.success("Your goal and key results have been added.");
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });
}

export function useUpdateOkr() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation<
    { message: string; okr: Okr },
    Error,
    {
      id: string;
      title?: string;
      description?: string;
      period?: string;
      level?: OkrLevel;
      status?: OkrStatus;
      keyResults?: KeyResult[];
    }
  >({
    mutationFn: async ({ id, ...payload }) => {
      const { data } = await api.patch(`/okrs/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["okrs"] });
      toast.success("Goal progress and key results synchronized.");
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });
}

export function useDeleteOkr() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation<{ message: string }, Error, string>({
    mutationFn: async (id) => {
      const { data } = await api.delete(`/okrs/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["okrs"] });
      toast.success("Objective was deleted.");
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });
}
