import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getErrorMessage } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type {
  PaymentMethod,
  PaymentStatus,
  Payroll,
  PayrollListResponse,
  PayrollStats,
} from "@/types";

export interface PayrollQueryParams {
  month?: number;
  year?: number;
  status?: string;
  department?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export function useMyPayslips(year?: number) {
  return useQuery<{ payslips: Payroll[] }>({
    queryKey: ["payroll", "my", { year }],
    queryFn: async () => {
      const { data } = await api.get<{ payslips: Payroll[] }>("/payroll/my", {
        params: { year },
      });
      return data;
    },
  });
}

export function useAllPayrolls(params: PayrollQueryParams = {}) {
  return useQuery<PayrollListResponse>({
    queryKey: ["payroll", "all", params],
    queryFn: async () => {
      const { data } = await api.get<PayrollListResponse>("/payroll", {
        params,
      });
      return data;
    },
  });
}

export function usePayrollStats() {
  return useQuery<PayrollStats>({
    queryKey: ["payroll", "stats"],
    queryFn: async () => {
      const { data } = await api.get<PayrollStats>("/payroll/stats");
      return data;
    },
  });
}

export function useGeneratePayroll() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation<
    { message: string; generatedCount: number },
    Error,
    { month: number; year: number; defaultBasicSalary?: number }
  >({
    mutationFn: async (payload) => {
      const { data } = await api.post("/payroll/generate", payload);
      return data;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      toast.success(res.message);
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });
}

export function useUpdatePayrollStatus() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation<
    { message: string; payroll: Payroll },
    Error,
    { id: string; status: PaymentStatus; paymentMethod?: PaymentMethod }
  >({
    mutationFn: async ({ id, status, paymentMethod }) => {
      const { data } = await api.patch(`/payroll/${id}/status`, {
        status,
        paymentMethod,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      toast.success("Salary slip status updated successfully.");
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });
}

export function useDeletePayroll() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation<{ message: string }, Error, string>({
    mutationFn: async (id) => {
      const { data } = await api.delete(`/payroll/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      toast.success("Payroll record deleted.");
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });
}
