import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getErrorMessage } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type {
  Expense,
  ExpenseCategory,
  ExpenseListResponse,
  ExpenseStatus,
} from "@/types";

export interface ExpenseQueryParams {
  category?: string;
  status?: string;
  department?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export function useMyExpenses(status?: string) {
  return useQuery<{ expenses: Expense[] }>({
    queryKey: ["expenses", "my", { status }],
    queryFn: async () => {
      const { data } = await api.get<{ expenses: Expense[] }>("/expenses/my", {
        params: { status },
      });
      return data;
    },
  });
}

export function useAllExpenses(params: ExpenseQueryParams = {}) {
  return useQuery<ExpenseListResponse>({
    queryKey: ["expenses", "all", params],
    queryFn: async () => {
      const { data } = await api.get<ExpenseListResponse>("/expenses", {
        params,
      });
      return data;
    },
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation<
    { message: string; expense: Expense },
    Error,
    {
      title: string;
      category: ExpenseCategory;
      amount: number;
      currency?: string;
      date?: string;
      description?: string;
      receiptName?: string;
    }
  >({
    mutationFn: async (payload) => {
      const { data } = await api.post("/expenses", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Your expense reimbursement claim has been submitted for review.");
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });
}

export function useUpdateExpenseStatus() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation<
    { message: string; expense: Expense },
    Error,
    { id: string; status: ExpenseStatus; rejectionReason?: string }
  >({
    mutationFn: async ({ id, status, rejectionReason }) => {
      const { data } = await api.patch(`/expenses/${id}/status`, {
        status,
        rejectionReason,
      });
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success(`Expense claim marked as ${variables.status}.`);
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation<{ message: string }, Error, string>({
    mutationFn: async (id) => {
      const { data } = await api.delete(`/expenses/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("The expense claim was removed.");
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });
}

/** AI Smart Receipt Parser & Policy Auditor. */
export function useAIAnalyzeReceipt() {
  const toast = useToast();

  return useMutation<
    import("@/types").AIAnalyzeReceiptResponse["analysis"],
    Error,
    import("@/types").AIAnalyzeReceiptInput
  >({
    mutationFn: async (input) => {
      const { data } = await api.post<import("@/types").AIAnalyzeReceiptResponse>(
        "/expenses/ai-analyze-receipt",
        input
      );
      return data.analysis;
    },
    onSuccess: () => {
      toast.success("Receipt analyzed and fields auto-populated!");
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });
}
