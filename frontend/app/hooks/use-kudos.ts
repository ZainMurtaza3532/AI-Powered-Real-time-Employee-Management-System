import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getErrorMessage } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type {
  Kudos,
  KudosBadge,
  KudosLeaderboardResponse,
  KudosListResponse,
} from "@/types";

export function useKudosFeed(limit = 20, offset = 0) {
  return useQuery<KudosListResponse>({
    queryKey: ["kudos", "feed", { limit, offset }],
    queryFn: async () => {
      const { data } = await api.get<KudosListResponse>("/kudos", {
        params: { limit, offset },
      });
      return data;
    },
  });
}

export function useKudosLeaderboard() {
  return useQuery<KudosLeaderboardResponse>({
    queryKey: ["kudos", "leaderboard"],
    queryFn: async () => {
      const { data } = await api.get<KudosLeaderboardResponse>("/kudos/leaderboard");
      return data;
    },
  });
}

export function useCreateKudos() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation<
    { message: string; kudos: Kudos },
    Error,
    { recipientId: string; badge: KudosBadge; message: string }
  >({
    mutationFn: async (payload) => {
      const { data } = await api.post("/kudos", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kudos"] });
      toast.success("Your praise has been posted to the team wall!");
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });
}

export function useToggleReaction() {
  const queryClient = useQueryClient();

  return useMutation<
    { kudos: Kudos },
    Error,
    { id: string; emoji: string }
  >({
    mutationFn: async ({ id, emoji }) => {
      const { data } = await api.post(`/kudos/${id}/react`, { emoji });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kudos"] });
    },
  });
}

export function useDeleteKudos() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation<{ message: string }, Error, string>({
    mutationFn: async (id) => {
      const { data } = await api.delete(`/kudos/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kudos"] });
      toast.success("Kudos post has been deleted.");
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });
}
