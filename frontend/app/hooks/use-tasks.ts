import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useToast } from "@/hooks/use-toast";
import { useSSE } from "@/hooks/use-sse";
import { api, getErrorMessage } from "@/lib/api";
import type {
  Task,
  TaskInput,
  TaskListResponse,
  TaskReviewInput,
  TaskStatusFilter,
  TaskSubmitInput,
  TaskUpdateInput,
} from "@/types";

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const taskKeys = {
  all: ["tasks"] as const,
  mine: (status: TaskStatusFilter, search: string, limit: number | null, offset: number) =>
    ["tasks", "mine", { status, search, limit, offset }] as const,
  created: (
    status: TaskStatusFilter,
    assignee: string,
    search: string,
    limit: number | null,
    offset: number
  ) => ["tasks", "created", { status, assignee, search, limit, offset }] as const,
  list: (
    status: TaskStatusFilter,
    department: string,
    assignee: string,
    search: string,
    limit: number | null,
    offset: number
  ) => ["tasks", "list", { status, department, assignee, search, limit, offset }] as const,
  detail: (id: string) => ["tasks", id] as const,
};

// ---------------------------------------------------------------------------
// Query params
// ---------------------------------------------------------------------------

export interface TaskQueryParams {
  status?: TaskStatusFilter;
  search?: string;
  limit?: number;
  offset?: number;
  assignee?: string;
  department?: string;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Employee: their own assigned tasks. */
export function useMyTasks(params: TaskQueryParams = {}) {
  const { status = "all", search = "", limit, offset = 0 } = params;
  const queryClient = useQueryClient();

  // Real-time: invalidate task queries when any task-updated event arrives.
  useSSE({
    event: "task-updated",
    onEvent: () => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });

  return useQuery({
    queryKey: taskKeys.mine(status, search, limit ?? null, offset),
    queryFn: async () => {
      const { data } = await api.get<TaskListResponse>("/tasks/mine", {
        params: {
          ...(status !== "all" ? { status } : {}),
          ...(search ? { search } : {}),
          ...(limit !== undefined ? { limit, offset } : {}),
        },
      });
      return data;
    },
    placeholderData: (previous) => previous,
  });
}

/** Head/admin: tasks they created. */
export function useCreatedTasks(params: TaskQueryParams = {}) {
  const { status = "all", search = "", limit, offset = 0, assignee = "" } = params;

  return useQuery({
    queryKey: taskKeys.created(status, assignee, search, limit ?? null, offset),
    queryFn: async () => {
      const { data } = await api.get<TaskListResponse>("/tasks/created", {
        params: {
          ...(status !== "all" ? { status } : {}),
          ...(assignee ? { assignee } : {}),
          ...(search ? { search } : {}),
          ...(limit !== undefined ? { limit, offset } : {}),
        },
      });
      return data;
    },
    placeholderData: (previous) => previous,
  });
}

/** Admin: all tasks. */
export function useTasks(params: TaskQueryParams = {}) {
  const { status = "all", search = "", limit, offset = 0, department = "", assignee = "" } = params;

  return useQuery({
    queryKey: taskKeys.list(status, department, assignee, search, limit ?? null, offset),
    queryFn: async () => {
      const { data } = await api.get<TaskListResponse>("/tasks", {
        params: {
          ...(status !== "all" ? { status } : {}),
          ...(department ? { department } : {}),
          ...(assignee ? { assignee } : {}),
          ...(search ? { search } : {}),
          ...(limit !== undefined ? { limit, offset } : {}),
        },
      });
      return data;
    },
    placeholderData: (previous) => previous,
  });
}

/** Single task detail. */
export function useTask(id: string | null) {
  return useQuery({
    queryKey: taskKeys.detail(id ?? ""),
    queryFn: async () => {
      const { data } = await api.get<{ task: Task }>(`/tasks/${id}`);
      return data.task;
    },
    enabled: Boolean(id),
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Head/admin: create and assign a task. */
export function useCreateTask() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (input: TaskInput) => {
      const { data } = await api.post<{ task: Task }>("/tasks", input);
      return data.task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      toast.success("Task assigned successfully");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

/** Admin/creator: update task details. */
export function useUpdateTask() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: TaskUpdateInput }) => {
      const { data } = await api.patch<{ task: Task }>(`/tasks/${id}`, input);
      return data.task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      toast.success("Task updated successfully");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

/** Employee: update task status (start, etc.). */
export function useUpdateTaskStatus() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data } = await api.patch<{ task: Task }>(`/tasks/${id}/status`, { status });
      return data.task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      toast.success("Task status updated");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

/** Employee: submit completed work. */
export function useSubmitTask() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: TaskSubmitInput }) => {
      const { data } = await api.post<{ task: Task }>(`/tasks/${id}/submit`, input);
      return data.task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      toast.success("Task submitted for review");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

/** Head/admin: review a submitted task. */
export function useReviewTask() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: TaskReviewInput }) => {
      const { data } = await api.post<{ task: Task }>(`/tasks/${id}/review`, input);
      return data.task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      toast.success("Task review submitted");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

/** Admin/creator: delete a task. */
export function useDeleteTask() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      toast.success("Task deleted");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

/** AI Subtask Decomposition: breaks down a task title/description into structured subtasks. */
export function useDecomposeTaskWithAI() {
  const toast = useToast();

  return useMutation({
    mutationFn: async ({ id, title, description }: { id?: string; title?: string; description?: string }) => {
      const endpoint = id ? `/tasks/${id}/ai-decompose` : "/tasks/ai-decompose";
      const { data } = await api.post<{ subtasks: Array<{ id: string; title: string; isCompleted: boolean; estimatedHours?: number }> }>(endpoint, {
        title,
        description,
      });
      return data.subtasks;
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

/** Toggle a subtask's completion status with instant optimistic update & SSE sync. */
export function useToggleSubtask() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async ({ taskId, subtaskId }: { taskId: string; subtaskId: string }) => {
      const { data } = await api.patch<{ task: Task }>(`/tasks/${taskId}/subtasks/${subtaskId}/toggle`);
      return data.task;
    },
    onSuccess: (updatedTask) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      queryClient.setQueryData(taskKeys.detail(updatedTask._id), updatedTask);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

/** Update the entire subtasks list for a task. */
export function useUpdateSubtasks() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async ({ taskId, subtasks }: { taskId: string; subtasks: Array<{ id: string; title: string; isCompleted: boolean; estimatedHours?: number }> }) => {
      const { data } = await api.patch<{ task: Task }>(`/tasks/${taskId}/subtasks`, { subtasks });
      return data.task;
    },
    onSuccess: (updatedTask) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      queryClient.setQueryData(taskKeys.detail(updatedTask._id), updatedTask);
      toast.success("Subtasks updated");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}
