import { useMutation, useQuery } from "@tanstack/react-query";
import { api, getErrorMessage } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type {
  FlightRiskResponse,
  OneOnOneAgendaResponse,
  ExecutiveBriefingResponse,
  AttendanceAnomalyResponse,
  SkillsMatrixResponse,
} from "@/types";

export interface CopilotChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface CopilotChatResponse {
  reply: string;
  context: {
    userName: string;
    role: string;
    department?: string;
  };
  timestamp: number;
}

export function useCopilotChat() {
  const toast = useToast();

  return useMutation<
    CopilotChatResponse,
    Error,
    { message: string; conversationHistory: CopilotChatMessage[] }
  >({
    mutationFn: async ({ message, conversationHistory }) => {
      const { data } = await api.post<CopilotChatResponse>("/copilot/chat", {
        message,
        conversationHistory,
      });
      return data;
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });
}

export function useFlightRisk(enabled = true) {
  return useQuery<FlightRiskResponse>({
    queryKey: ["copilot", "flight-risk"],
    queryFn: async () => {
      const { data } = await api.get<FlightRiskResponse>("/copilot/flight-risk");
      return data;
    },
    enabled,
    staleTime: 60 * 1000,
  });
}

export function useGenerate1on1Agenda() {
  const toast = useToast();

  return useMutation<OneOnOneAgendaResponse, Error, { employeeId: string }>({
    mutationFn: async ({ employeeId }) => {
      const { data } = await api.post<OneOnOneAgendaResponse>("/copilot/1-on-1", {
        employeeId,
      });
      return data;
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });
}

export function useGenerateExecutiveBriefing() {
  const toast = useToast();

  return useMutation<ExecutiveBriefingResponse, Error, void>({
    mutationFn: async () => {
      const { data } = await api.post<ExecutiveBriefingResponse>("/copilot/executive-briefing");
      return data;
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });
}

export function useAttendanceAnomaly(enabled = true) {
  return useQuery<AttendanceAnomalyResponse>({
    queryKey: ["copilot", "attendance-anomaly"],
    queryFn: async () => {
      const { data } = await api.get<AttendanceAnomalyResponse>("/copilot/attendance-anomaly");
      return data;
    },
    enabled,
    staleTime: 60 * 1000,
  });
}

/** AI Skills Radar & Succession Planning Matrix. */
export function useSkillsMatrix(enabled = true) {
  return useQuery<SkillsMatrixResponse>({
    queryKey: ["copilot", "skills-matrix"],
    queryFn: async () => {
      const { data } = await api.get<SkillsMatrixResponse>("/copilot/skills-matrix");
      return data;
    },
    enabled,
    staleTime: 60 * 1000,
  });
}

