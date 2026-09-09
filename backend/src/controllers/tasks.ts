import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import mongoose from "mongoose";
import { logActivity } from "../lib/activityLog.js";
import { notify } from "../lib/notifications.js";
import { parsePagination, searchRegex } from "../lib/pagination.js";
import { pushToUsers, createEvent } from "../lib/sse.js";
import { Department } from "../models/Department.js";
import { Task } from "../models/Task.js";
import type { ISubtask, ITask, TaskPriority, TaskStatus } from "../models/Task.js";
import { TASK_PRIORITIES, TASK_STATUSES } from "../models/Task.js";
import { User } from "../models/User.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isInvalidObjectId(id: string): boolean {
  return !mongoose.isValidObjectId(id);
}

/** Express 5 types params as `string | string[] | undefined` — normalize to a single value. */
function param(req: Request, name: string): string | undefined {
  const value = req.params[name];
  return typeof value === "string" ? value : undefined;
}

async function getTaskOr404(req: Request, res: Response): Promise<ITask | undefined> {
  const id = param(req, "id");
  if (!id || isInvalidObjectId(id)) {
    res.status(404).json({ error: "Task not found" });
    return undefined;
  }
  const task = await Task.findById(id);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return undefined;
  }
  return task;
}

function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (date.toISOString().slice(0, 10) !== value) return null;
  return date;
}

function parseSubtasksInput(raw: unknown): ISubtask[] {
  if (!Array.isArray(raw)) return [];
  const results: ISubtask[] = [];
  for (const item of raw) {
    if (typeof item === "object" && item !== null) {
      const title = typeof item.title === "string" ? item.title.trim() : "";
      if (title) {
        results.push({
          id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : randomUUID(),
          title: title.slice(0, 300),
          isCompleted: !!item.isCompleted,
          estimatedHours: typeof item.estimatedHours === "number" && !Number.isNaN(item.estimatedHours) ? Math.max(0, Math.min(100, item.estimatedHours)) : undefined,
        });
      }
    }
  }
  return results;
}

async function callGeminiForSubtasks(
  title: string,
  description?: string
): Promise<Array<{ id: string; title: string; isCompleted: boolean; estimatedHours: number }>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && !apiKey.startsWith("AQ.dummy")) {
    const models = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.0-flash"];
    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const prompt = `You are a technical project manager and task decomposition AI in an Enterprise Management System.
Given the task title and optional description below, decompose it into 3 to 6 clear, actionable, high-quality subtasks.
For each subtask, provide a title (short, clear action phrase) and an estimated duration in hours (number between 0.5 and 20).

Task Title: ${title}
Task Description: ${description || "No description provided"}

Respond ONLY with a valid JSON array of objects with the exact shape:
[
  { "title": "Subtask title here", "estimatedHours": 2.5 }
]
Do not include Markdown backticks or any other text.`;

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 1024,
            },
          }),
        });

        if (response.ok) {
          const data = (await response.json()) as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
          };
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
            const parsed = JSON.parse(cleaned);
            if (Array.isArray(parsed) && parsed.length > 0) {
              return parsed.map((item: { title?: string; estimatedHours?: number }) => ({
                id: randomUUID(),
                title: String(item.title || "Action item").trim(),
                isCompleted: false,
                estimatedHours: typeof item.estimatedHours === "number" ? Math.max(0.5, Math.min(40, item.estimatedHours)) : 2,
              }));
            }
          }
        }
      } catch {
        // Fallback below
      }
    }
  }

  return generateHeuristicSubtasks(title, description);
}

function generateHeuristicSubtasks(
  title: string,
  _description?: string
): Array<{ id: string; title: string; isCompleted: boolean; estimatedHours: number }> {
  const t = title.toLowerCase();
  if (t.includes("bug") || t.includes("fix") || t.includes("issue") || t.includes("error")) {
    return [
      { id: randomUUID(), title: "Reproduce issue in development environment & isolate root cause", isCompleted: false, estimatedHours: 1.5 },
      { id: randomUUID(), title: "Implement bug fix & verify with unit/regression test cases", isCompleted: false, estimatedHours: 2.5 },
      { id: randomUUID(), title: "Code review & peer validation in staging", isCompleted: false, estimatedHours: 1.0 },
      { id: randomUUID(), title: "Deploy fix & monitor logs for error regressions", isCompleted: false, estimatedHours: 0.5 },
    ];
  }
  if (t.includes("design") || t.includes("ui") || t.includes("ux") || t.includes("frontend")) {
    return [
      { id: randomUUID(), title: "Review requirements & draft component wireframes/mockups", isCompleted: false, estimatedHours: 3.0 },
      { id: randomUUID(), title: "Build accessible interactive UI components with theme tokens", isCompleted: false, estimatedHours: 4.0 },
      { id: randomUUID(), title: "Integrate with backend API endpoints & handle error/loading states", isCompleted: false, estimatedHours: 3.5 },
      { id: randomUUID(), title: "Cross-browser & responsive mobile UX testing", isCompleted: false, estimatedHours: 1.5 },
    ];
  }
  if (t.includes("api") || t.includes("backend") || t.includes("database") || t.includes("model")) {
    return [
      { id: randomUUID(), title: "Define schema models, validation rules & TypeScript interfaces", isCompleted: false, estimatedHours: 2.0 },
      { id: randomUUID(), title: "Implement controller business logic & route endpoints", isCompleted: false, estimatedHours: 4.0 },
      { id: randomUUID(), title: "Add rate limiting, RBAC authorization & audit activity logging", isCompleted: false, estimatedHours: 1.5 },
      { id: randomUUID(), title: "Run end-to-end API testing & verify database indexing", isCompleted: false, estimatedHours: 1.5 },
    ];
  }
  if (t.includes("report") || t.includes("audit") || t.includes("review") || t.includes("doc")) {
    return [
      { id: randomUUID(), title: "Gather source data & compile key analytical metrics", isCompleted: false, estimatedHours: 2.0 },
      { id: randomUUID(), title: "Draft structured executive findings & narrative recommendations", isCompleted: false, estimatedHours: 3.0 },
      { id: randomUUID(), title: "Peer review with department stakeholders & incorporate feedback", isCompleted: false, estimatedHours: 1.5 },
      { id: randomUUID(), title: "Finalize document & publish to company knowledge base", isCompleted: false, estimatedHours: 1.0 },
    ];
  }

  return [
    { id: randomUUID(), title: `Scope requirements & plan architecture for: ${title}`, isCompleted: false, estimatedHours: 2.0 },
    { id: randomUUID(), title: "Execute primary implementation & core deliverable milestones", isCompleted: false, estimatedHours: 4.5 },
    { id: randomUUID(), title: "Conduct quality assurance, peer review & edge-case validation", isCompleted: false, estimatedHours: 2.0 },
    { id: randomUUID(), title: "Final delivery, stakeholder sign-off & submission notes", isCompleted: false, estimatedHours: 1.0 },
  ];
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

interface CreateTaskBody {
  title?: unknown;
  description?: unknown;
  assignedTo?: unknown;
  priority?: unknown;
  dueDate?: unknown;
  subtasks?: unknown;
}

interface UpdateStatusBody {
  status?: unknown;
}

interface SubmitTaskBody {
  submissionNotes?: unknown;
}

interface ReviewTaskBody {
  decision?: unknown;
  reviewNotes?: unknown;
}

interface UpdateTaskBody {
  title?: unknown;
  description?: unknown;
  assignedTo?: unknown;
  priority?: unknown;
  dueDate?: unknown;
  subtasks?: unknown;
}

// ---------------------------------------------------------------------------
// Controllers
// ---------------------------------------------------------------------------

/**
 * Head or admin: creates and assigns a task.
 * Heads can only assign to members of their own department.
 */
export async function createTask(req: Request, res: Response): Promise<void> {
  const actor = req.user!;
  const { title, description, assignedTo, priority, dueDate, subtasks } =
    (req.body ?? {}) as CreateTaskBody;

  // Validate title
  if (typeof title !== "string" || !title.trim()) {
    res.status(400).json({ error: "title is required" });
    return;
  }
  if (title.trim().length > 200) {
    res.status(400).json({ error: "title must be 200 characters or fewer" });
    return;
  }

  // Validate assignedTo
  if (typeof assignedTo !== "string" || isInvalidObjectId(assignedTo)) {
    res.status(400).json({ error: "assignedTo must be a valid user ID" });
    return;
  }
  const assignee = await User.findById(assignedTo);
  if (!assignee) {
    res.status(404).json({ error: "Assignee not found" });
    return;
  }

  // Heads can only assign to members of their own department
  if (actor.role === "head") {
    if (!actor.department) {
      res.status(403).json({ error: "You must be assigned to a department to create tasks" });
      return;
    }
    if (!assignee.department || !assignee.department.equals(actor.department)) {
      res.status(403).json({ error: "You can only assign tasks to members of your department" });
      return;
    }
  }

  // Validate priority
  if (priority !== undefined && (typeof priority !== "string" || !TASK_PRIORITIES.includes(priority as TaskPriority))) {
    res.status(400).json({ error: "priority must be one of: low, medium, high, urgent" });
    return;
  }

  // Validate dueDate
  let parsedDueDate: Date | null = null;
  if (dueDate !== undefined && dueDate !== null) {
    parsedDueDate = parseDateOnly(dueDate);
    if (!parsedDueDate) {
      res.status(400).json({ error: "dueDate must be a valid date (YYYY-MM-DD)" });
      return;
    }
  }

  // Description validation
  if (description !== undefined && (typeof description !== "string" || description.trim().length > 2000)) {
    res.status(400).json({ error: "description must be 2000 characters or fewer" });
    return;
  }

  const initialSubtasks = parseSubtasksInput(subtasks);

  const task = await Task.create({
    title: title.trim(),
    description: description ? (description as string).trim() : undefined,
    assignedTo: assignee._id,
    assignedBy: actor._id,
    department: assignee.department || null,
    priority: (priority as TaskPriority) || "medium",
    dueDate: parsedDueDate,
    subtasks: initialSubtasks,
    status: "todo",
  });

  logActivity({
    action: "task_created",
    actor,
    targetType: "task",
    targetId: task._id,
    targetName: task.title,
    details: { assignedTo: assignee.name, priority: task.priority },
    ip: req.ip,
  });

  // Notify the assignee
  notify({
    recipient: assignee._id,
    actor,
    type: "task_assigned",
    title: "New task assigned",
    message: `You have been assigned a new task: ${task.title}`,
    link: "/tasks",
    data: {
      taskTitle: task.title,
      priority: task.priority,
      dueDate: parsedDueDate ? parsedDueDate.toISOString().slice(0, 10) : null,
    },
  });

  // Real-time SSE push to assignee and creator
  pushToUsers(
    [assignee._id.toString(), actor._id.toString()],
    createEvent("task-updated", {
      taskId: task._id,
      action: "created",
      title: task.title,
      status: task.status,
      assignedTo: assignee.name,
    })
  );

  // Populate and return
  const populated = await Task.findById(task._id)
    .populate("assignedTo", "name email")
    .populate("assignedBy", "name email")
    .populate("department", "name");

  res.status(201).json({ task: populated!.toJSON() });
}

/**
 * Any authenticated user: their own assigned tasks, newest first.
 * Optional ?status= filter, ?search= on title/description, pagination.
 */
export async function myTasks(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const { limit, offset } = parsePagination(req);
  const search = searchRegex(req.query.search);
  const status = req.query.status;

  const filter: Record<string, unknown> = { assignedTo: user._id };

  if (status !== undefined) {
    if (typeof status !== "string" || !TASK_STATUSES.includes(status as TaskStatus)) {
      res.status(400).json({ error: "status must be one of: todo, in_progress, in_review, completed, rejected" });
      return;
    }
    filter.status = status;
  }

  if (search) {
    filter.$or = [{ title: search }, { description: search }];
  }

  let query = Task.find(filter)
    .populate("assignedTo", "name email")
    .populate("assignedBy", "name email")
    .populate("department", "name")
    .sort({ createdAt: -1 });

  if (limit !== null) {
    query = query.skip(offset).limit(limit);
  }

  const [tasks, total] = await Promise.all([query, Task.countDocuments(filter)]);
  res.json({ tasks: tasks.map((t) => t.toJSON()), total, limit, offset });
}

/**
 * Head or admin: tasks they created, newest first.
 * Optional ?status=, ?assignee=, ?search= filters, pagination.
 */
export async function createdTasks(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const { limit, offset } = parsePagination(req);
  const search = searchRegex(req.query.search);
  const status = req.query.status;
  const assignee = req.query.assignee;

  const filter: Record<string, unknown> = { assignedBy: user._id };

  if (status !== undefined) {
    if (typeof status !== "string" || !TASK_STATUSES.includes(status as TaskStatus)) {
      res.status(400).json({ error: "status must be one of: todo, in_progress, in_review, completed, rejected" });
      return;
    }
    filter.status = status;
  }

  if (assignee !== undefined && typeof assignee === "string" && !isInvalidObjectId(assignee)) {
    filter.assignedTo = assignee;
  }

  if (search) {
    filter.$or = [{ title: search }, { description: search }];
  }

  let query = Task.find(filter)
    .populate("assignedTo", "name email")
    .populate("assignedBy", "name email")
    .populate("department", "name")
    .sort({ createdAt: -1 });

  if (limit !== null) {
    query = query.skip(offset).limit(limit);
  }

  const [tasks, total] = await Promise.all([query, Task.countDocuments(filter)]);
  res.json({ tasks: tasks.map((t) => t.toJSON()), total, limit, offset });
}

/** Admin-only: all tasks with optional filters. */
export async function listTasks(req: Request, res: Response): Promise<void> {
  const { limit, offset } = parsePagination(req);
  const search = searchRegex(req.query.search);
  const status = req.query.status;
  const department = req.query.department;
  const assignee = req.query.assignee;

  const filter: Record<string, unknown> = {};

  if (status !== undefined) {
    if (typeof status !== "string" || !TASK_STATUSES.includes(status as TaskStatus)) {
      res.status(400).json({ error: "status must be one of: todo, in_progress, in_review, completed, rejected" });
      return;
    }
    filter.status = status;
  }

  if (department !== undefined && typeof department === "string" && !isInvalidObjectId(department)) {
    filter.department = department;
  }

  if (assignee !== undefined && typeof assignee === "string" && !isInvalidObjectId(assignee)) {
    filter.assignedTo = assignee;
  }

  if (search) {
    // Search over populated assignees
    const matchingUsers = await User.find({
      $or: [{ name: search }, { email: search }],
    }).select("_id");
    const userIds = matchingUsers.map((u) => u._id);

    filter.$or = [
      { title: search },
      { description: search },
      { assignedTo: { $in: userIds } },
    ];
  }

  let query = Task.find(filter)
    .populate("assignedTo", "name email")
    .populate("assignedBy", "name email")
    .populate("department", "name")
    .sort({ createdAt: -1 });

  if (limit !== null) {
    query = query.skip(offset).limit(limit);
  }

  const [tasks, total] = await Promise.all([query, Task.countDocuments(filter)]);
  res.json({ tasks: tasks.map((t) => t.toJSON()), total, limit, offset });
}

/** Task detail — accessible by the assignee, creator, or admin. */
export async function getTask(req: Request, res: Response): Promise<void> {
  const task = await getTaskOr404(req, res);
  if (!task) return;

  const user = req.user!;
  const isAdmin = user.role === "admin";
  const isAssignee = task.assignedTo.equals(user._id);
  const isCreator = task.assignedBy.equals(user._id);

  if (!isAdmin && !isAssignee && !isCreator) {
    res.status(403).json({ error: "You don't have access to this task" });
    return;
  }

  const populated = await Task.findById(task._id)
    .populate("assignedTo", "name email")
    .populate("assignedBy", "name email")
    .populate("department", "name")
    .populate("reviewedBy", "name");

  res.json({ task: populated!.toJSON() });
}

/**
 * Employee (assignee only): updates task status.
 * Valid transitions: todo→in_progress, in_progress→in_review, in_review→in_progress,
 * rejected→in_progress (resubmit), todo→completed (skip review, admin only).
 */
export async function updateStatus(req: Request, res: Response): Promise<void> {
  const task = await getTaskOr404(req, res);
  if (!task) return;

  const user = req.user!;
  if (!task.assignedTo.equals(user._id)) {
    res.status(403).json({ error: "You can only update your own tasks" });
    return;
  }

  const { status } = (req.body ?? {}) as UpdateStatusBody;
  if (typeof status !== "string" || !TASK_STATUSES.includes(status as TaskStatus)) {
    res.status(400).json({ error: "status must be one of: todo, in_progress, in_review, completed, rejected" });
    return;
  }

  const validTransitions: Record<string, string[]> = {
    todo: ["in_progress", "completed"],
    in_progress: ["in_review"],
    in_review: ["in_progress"],
    rejected: ["in_progress"],
  };

  const allowed = validTransitions[task.status] ?? [];
  if (!allowed.includes(status)) {
    res.status(400).json({
      error: `Cannot transition from "${task.status}" to "${status}". Allowed: ${allowed.join(", ") || "none"}`,
    });
    return;
  }

  task.status = status as TaskStatus;

  // If marking as completed (skip review), set completedAt
  if (status === "completed") {
    task.completedAt = new Date();
  }

  await task.save();

  logActivity({
    action: "task_status_updated",
    actor: user,
    targetType: "task",
    targetId: task._id,
    targetName: task.title,
    details: { from: task.status, to: status },
    ip: req.ip,
  });

  // Real-time SSE push to assignee and creator
  pushToUsers(
    [task.assignedTo.toString(), task.assignedBy.toString()],
    createEvent("task-updated", {
      taskId: task._id,
      action: "status-changed",
      title: task.title,
      status,
      previousStatus: task.status,
    })
  );

  const populated = await Task.findById(task._id)
    .populate("assignedTo", "name email")
    .populate("assignedBy", "name email")
    .populate("department", "name");

  res.json({ task: populated!.toJSON() });
}

/**
 * Employee (assignee only): submits completed work with notes.
 * Sets status to in_review and notifies the task creator.
 */
export async function submitTask(req: Request, res: Response): Promise<void> {
  const task = await getTaskOr404(req, res);
  if (!task) return;

  const user = req.user!;
  if (!task.assignedTo.equals(user._id)) {
    res.status(403).json({ error: "You can only submit your own tasks" });
    return;
  }

  if (task.status !== "todo" && task.status !== "in_progress" && task.status !== "rejected") {
    res.status(400).json({ error: "Only todo, in_progress, or rejected tasks can be submitted" });
    return;
  }

  const { submissionNotes } = (req.body ?? {}) as SubmitTaskBody;
  if (submissionNotes !== undefined && (typeof submissionNotes !== "string" || submissionNotes.trim().length > 2000)) {
    res.status(400).json({ error: "submissionNotes must be 2000 characters or fewer" });
    return;
  }

  task.status = "in_review";
  task.submissionNotes = submissionNotes ? (submissionNotes as string).trim() : undefined;
  task.submittedAt = new Date();
  await task.save();

  logActivity({
    action: "task_submitted",
    actor: user,
    targetType: "task",
    targetId: task._id,
    targetName: task.title,
    details: { submissionNotes: task.submissionNotes },
    ip: req.ip,
  });

  // Notify the task creator
  const creator = await User.findById(task.assignedBy);
  if (creator) {
    notify({
      recipient: creator._id,
      actor: user,
      type: "task_completed",
      title: "Task submitted for review",
      message: `${user.name} has submitted "${task.title}" for your review.`,
      link: "/admin/tasks",
      data: {
        taskTitle: task.title,
        submissionNotes: task.submissionNotes,
        assigneeName: user.name,
      },
    });

    // Real-time SSE push to creator
    pushToUsers(
      [creator._id.toString(), user._id.toString()],
      createEvent("task-updated", {
        taskId: task._id,
        action: "submitted",
        title: task.title,
        status: "in_review",
        submittedBy: user.name,
      })
    );
  }

  const populated = await Task.findById(task._id)
    .populate("assignedTo", "name email")
    .populate("assignedBy", "name email")
    .populate("department", "name");

  res.json({ task: populated!.toJSON() });
}

/**
 * Head/admin (creator or admin): reviews a submitted task.
 * Approves or rejects with optional notes.
 */
export async function reviewTask(req: Request, res: Response): Promise<void> {
  const task = await getTaskOr404(req, res);
  if (!task) return;

  const user = req.user!;
  const isAdmin = user.role === "admin";
  const isCreator = task.assignedBy.equals(user._id);

  if (!isAdmin && !isCreator) {
    res.status(403).json({ error: "Only the task creator or an admin can review tasks" });
    return;
  }

  if (task.status !== "in_review") {
    res.status(400).json({ error: "Only tasks in review can be reviewed" });
    return;
  }

  const { decision, reviewNotes } = (req.body ?? {}) as ReviewTaskBody;
  if (decision !== "approved" && decision !== "rejected") {
    res.status(400).json({ error: "decision must be approved or rejected" });
    return;
  }
  if (reviewNotes !== undefined && (typeof reviewNotes !== "string" || reviewNotes.trim().length > 2000)) {
    res.status(400).json({ error: "reviewNotes must be 2000 characters or fewer" });
    return;
  }

  if (decision === "approved") {
    task.status = "completed";
    task.completedAt = new Date();
  } else {
    task.status = "rejected";
  }

  task.reviewNotes = reviewNotes ? (reviewNotes as string).trim() : undefined;
  task.reviewedAt = new Date();
  task.reviewedBy = user._id;
  await task.save();

  logActivity({
    action: "task_reviewed",
    actor: user,
    targetType: "task",
    targetId: task._id,
    targetName: task.title,
    details: { decision, reviewNotes: task.reviewNotes },
    ip: req.ip,
  });

  // Notify the assignee
  const assignee = await User.findById(task.assignedTo);
  if (assignee) {
    const isApproved = decision === "approved";
    notify({
      recipient: assignee._id,
      actor: user,
      type: isApproved ? "task_approved" : "task_rejected",
      title: isApproved ? "Task approved" : "Task rejected",
      message: `Your task "${task.title}" has been ${decision}.`,
      link: "/tasks",
      data: {
        taskTitle: task.title,
        reviewNotes: task.reviewNotes,
      },
    });

    // Real-time SSE push to assignee and reviewer
    pushToUsers(
      [assignee._id.toString(), user._id.toString()],
      createEvent("task-updated", {
        taskId: task._id,
        action: "reviewed",
        title: task.title,
        status: task.status,
        decision,
        reviewedBy: user.name,
      })
    );
  }

  const populated = await Task.findById(task._id)
    .populate("assignedTo", "name email")
    .populate("assignedBy", "name email")
    .populate("department", "name")
    .populate("reviewedBy", "name");

  res.json({ task: populated!.toJSON() });
}

/** Admin or creator: updates a task's details. */
export async function updateTask(req: Request, res: Response): Promise<void> {
  const task = await getTaskOr404(req, res);
  if (!task) return;

  const user = req.user!;
  const isAdmin = user.role === "admin";
  const isCreator = task.assignedBy.equals(user._id);

  if (!isAdmin && !isCreator) {
    res.status(403).json({ error: "Only the task creator or an admin can update tasks" });
    return;
  }

  const { title, description, assignedTo, priority, dueDate, subtasks } =
    (req.body ?? {}) as UpdateTaskBody;

  if (title !== undefined) {
    if (typeof title !== "string" || !title.trim()) {
      res.status(400).json({ error: "title cannot be empty" });
      return;
    }
    if (title.trim().length > 200) {
      res.status(400).json({ error: "title must be 200 characters or fewer" });
      return;
    }
    task.title = title.trim();
  }

  if (description !== undefined) {
    if (typeof description !== "string" || description.trim().length > 2000) {
      res.status(400).json({ error: "description must be 2000 characters or fewer" });
      return;
    }
    task.description = description.trim() || undefined;
  }

  if (assignedTo !== undefined) {
    if (typeof assignedTo !== "string" || isInvalidObjectId(assignedTo)) {
      res.status(400).json({ error: "assignedTo must be a valid user ID" });
      return;
    }
    const assignee = await User.findById(assignedTo);
    if (!assignee) {
      res.status(404).json({ error: "Assignee not found" });
      return;
    }

    // Heads can only assign to members of their own department
    if (user.role === "head") {
      if (!user.department) {
        res.status(403).json({ error: "You must be assigned to a department to reassign tasks" });
        return;
      }
      if (!assignee.department || !assignee.department.equals(user.department)) {
        res.status(403).json({ error: "You can only assign tasks to members of your department" });
        return;
      }
    }

    task.assignedTo = assignee._id;
    task.department = assignee.department || null;
  }

  if (priority !== undefined) {
    if (typeof priority !== "string" || !TASK_PRIORITIES.includes(priority as TaskPriority)) {
      res.status(400).json({ error: "priority must be one of: low, medium, high, urgent" });
      return;
    }
    task.priority = priority as TaskPriority;
  }

  if (dueDate !== undefined) {
    if (dueDate === null || dueDate === "") {
      task.dueDate = null;
    } else {
      const parsed = parseDateOnly(dueDate);
      if (!parsed) {
        res.status(400).json({ error: "dueDate must be a valid date (YYYY-MM-DD)" });
        return;
      }
      task.dueDate = parsed;
    }
  }

  if (subtasks !== undefined) {
    task.subtasks = parseSubtasksInput(subtasks);
  }

  await task.save();

  logActivity({
    action: "task_status_updated",
    actor: user,
    targetType: "task",
    targetId: task._id,
    targetName: task.title,
    details: { action: "updated" },
    ip: req.ip,
  });

  // Real-time SSE push to assignee and creator
  pushToUsers(
    [task.assignedTo.toString(), task.assignedBy.toString()],
    createEvent("task-updated", {
      taskId: task._id,
      action: "updated",
      title: task.title,
      status: task.status,
    })
  );

  const populated = await Task.findById(task._id)
    .populate("assignedTo", "name email")
    .populate("assignedBy", "name email")
    .populate("department", "name");

  res.json({ task: populated!.toJSON() });
}

/** Admin or creator: deletes a task. */
export async function deleteTask(req: Request, res: Response): Promise<void> {
  const task = await getTaskOr404(req, res);
  if (!task) return;

  const user = req.user!;
  const isAdmin = user.role === "admin";
  const isCreator = task.assignedBy.equals(user._id);

  if (!isAdmin && !isCreator) {
    res.status(403).json({ error: "Only the task creator or an admin can delete tasks" });
    return;
  }

  await Task.findByIdAndDelete(task._id);

  logActivity({
    action: "task_status_updated",
    actor: user,
    targetType: "task",
    targetId: task._id,
    targetName: task.title,
    details: { action: "deleted" },
    ip: req.ip,
  });

  // Real-time SSE push to assignee and creator
  pushToUsers(
    [task.assignedTo.toString(), task.assignedBy.toString()],
    createEvent("task-updated", {
      taskId: task._id,
      action: "deleted",
      title: task.title,
    })
  );

  res.json({ success: true });
}

/**
 * AI Task Decomposition:
 * Generates 3-6 actionable subtasks with estimated hours based on task title and description.
 * Can be called with raw { title, description } or for an existing task.
 */
export async function decomposeTaskWithAI(req: Request, res: Response): Promise<void> {
  const taskId = param(req, "id");
  let title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  let description = typeof req.body?.description === "string" ? req.body.description.trim() : "";

  if (taskId && isInvalidObjectId(taskId) === false) {
    const task = await Task.findById(taskId);
    if (task) {
      if (!title) title = task.title;
      if (!description && task.description) description = task.description;
    }
  }

  if (!title) {
    res.status(400).json({ error: "Task title is required for AI decomposition" });
    return;
  }

  try {
    const subtasks = await callGeminiForSubtasks(title, description);
    res.json({ subtasks });
  } catch {
    const subtasks = generateHeuristicSubtasks(title, description);
    res.json({ subtasks });
  }
}

/**
 * Toggle completion status of a specific subtask within a task.
 * Available to the task assignee, creator, or admin.
 */
export async function toggleSubtask(req: Request, res: Response): Promise<void> {
  const task = await getTaskOr404(req, res);
  if (!task) return;

  const subtaskId = param(req, "subtaskId");
  if (!subtaskId) {
    res.status(400).json({ error: "subtaskId is required" });
    return;
  }

  const user = req.user!;
  const isAssignee = task.assignedTo.equals(user._id);
  const isCreator = task.assignedBy.equals(user._id);
  const isAdmin = user.role === "admin";

  if (!isAssignee && !isCreator && !isAdmin) {
    res.status(403).json({ error: "You do not have permission to update subtasks on this task" });
    return;
  }

  const subtask = task.subtasks.find((s) => s.id === subtaskId);
  if (!subtask) {
    res.status(404).json({ error: "Subtask not found" });
    return;
  }

  subtask.isCompleted = !subtask.isCompleted;
  await task.save();

  // Push SSE real-time update
  pushToUsers(
    [task.assignedTo.toString(), task.assignedBy.toString()],
    createEvent("task-updated", {
      taskId: task._id,
      action: "subtask_toggled",
      subtaskId,
      isCompleted: subtask.isCompleted,
    })
  );

  const populated = await Task.findById(task._id)
    .populate("assignedTo", "name email")
    .populate("assignedBy", "name email")
    .populate("department", "name");

  res.json({ task: populated!.toJSON() });
}

/**
 * Update the complete subtasks array for a task.
 */
export async function updateSubtasks(req: Request, res: Response): Promise<void> {
  const task = await getTaskOr404(req, res);
  if (!task) return;

  const user = req.user!;
  const isAssignee = task.assignedTo.equals(user._id);
  const isCreator = task.assignedBy.equals(user._id);
  const isAdmin = user.role === "admin";

  if (!isAssignee && !isCreator && !isAdmin) {
    res.status(403).json({ error: "You do not have permission to update subtasks on this task" });
    return;
  }

  task.subtasks = parseSubtasksInput(req.body?.subtasks);
  await task.save();

  pushToUsers(
    [task.assignedTo.toString(), task.assignedBy.toString()],
    createEvent("task-updated", {
      taskId: task._id,
      action: "subtasks_updated",
      subtasksCount: task.subtasks.length,
    })
  );

  const populated = await Task.findById(task._id)
    .populate("assignedTo", "name email")
    .populate("assignedBy", "name email")
    .populate("department", "name");

  res.json({ task: populated!.toJSON() });
}
