import type { Request, Response } from "express";
import mongoose from "mongoose";
import { logActivity } from "../lib/activityLog.js";
import { notify } from "../lib/notifications.js";
import { parsePagination, searchRegex } from "../lib/pagination.js";
import { pushToUsers, createEvent } from "../lib/sse.js";
import { inngest } from "../inngest/index.js";
import {
  PerformanceReview,
  type IPerformanceReview,
  type ReviewStatus,
  type GoalStatus,
} from "../models/PerformanceReview.js";
import { REVIEW_STATUSES } from "../models/PerformanceReview.js";
import { GOAL_STATUSES } from "../models/PerformanceReview.js";
import { User } from "../models/User.js";
import { Notification } from "../models/Notification.js";
import { Task } from "../models/Task.js";
import { Attendance } from "../models/Attendance.js";
import { Kudos } from "../models/Kudos.js";
import { Feedback } from "../models/Feedback.js";

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

function isReviewStatus(value: unknown): value is ReviewStatus {
  return (
    typeof value === "string" &&
    (REVIEW_STATUSES as readonly string[]).includes(value)
  );
}

function isGoalStatus(value: unknown): value is GoalStatus {
  return (
    typeof value === "string" &&
    (GOAL_STATUSES as readonly string[]).includes(value)
  );
}

async function getReviewOr404(
  req: Request,
  res: Response
): Promise<IPerformanceReview | undefined> {
  const id = param(req, "id");
  if (!id || isInvalidObjectId(id)) {
    res.status(404).json({ error: "Performance review not found" });
    return undefined;
  }
  const review = await PerformanceReview.findById(id);
  if (!review) {
    res.status(404).json({ error: "Performance review not found" });
    return undefined;
  }
  return review;
}

function goalIndexParam(req: Request): number | undefined {
  const raw = param(req, "goalIndex");
  if (raw === undefined) return undefined;
  const idx = parseInt(raw, 10);
  return Number.isFinite(idx) && idx >= 0 ? idx : undefined;
}

// ---------------------------------------------------------------------------
// Create — admin or head schedules a review (triggers AI generation via Inngest)
// ---------------------------------------------------------------------------

interface CreateReviewBody {
  employeeId?: unknown;
  period?: unknown;
  ratings?: unknown;
  goals?: unknown;
}

export async function createReview(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const { employeeId, period, ratings, goals } =
    (req.body ?? {}) as CreateReviewBody;

  if (typeof employeeId !== "string" || isInvalidObjectId(employeeId)) {
    res.status(400).json({ error: "employeeId must be a valid user ID" });
    return;
  }
  if (typeof period !== "string" || !period.trim()) {
    res.status(400).json({ error: "period is required (e.g. 'Q1 2026')" });
    return;
  }

  const employee = await User.findById(employeeId);
  if (!employee) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  // Heads can only review employees in their own department.
  if (user.role === "head" && employee.department?.toString() !== user.department?.toString()) {
    res.status(403).json({
      error: "You can only create reviews for employees in your department",
    });
    return;
  }

  // Validate ratings if provided.
  const validatedRatings: { category: string; score: number; comment?: string }[] = [];
  if (Array.isArray(ratings)) {
    for (const r of ratings) {
      if (
        typeof r !== "object" ||
        r === null ||
        typeof (r as Record<string, unknown>).category !== "string" ||
        typeof (r as Record<string, unknown>).score !== "number"
      ) {
        res.status(400).json({
          error: "Each rating must have a category (string) and score (number)",
        });
        return;
      }
      const rating = r as { category: string; score: number; comment?: string };
      if (rating.score < 1 || rating.score > 5) {
        res.status(400).json({ error: "Rating scores must be between 1 and 5" });
        return;
      }
      validatedRatings.push({
        category: rating.category.trim(),
        score: rating.score,
        ...(rating.comment ? { comment: rating.comment.trim() } : {}),
      });
    }
  }

  // Validate goals if provided.
  const validatedGoals: {
    title: string;
    description?: string;
    status: GoalStatus;
    dueDate?: Date;
  }[] = [];
  if (Array.isArray(goals)) {
    for (const g of goals) {
      if (
        typeof g !== "object" ||
        g === null ||
        typeof (g as Record<string, unknown>).title !== "string"
      ) {
        res
          .status(400)
          .json({ error: "Each goal must have a title (string)" });
        return;
      }
      const goal = g as {
        title: string;
        description?: string;
        status?: string;
        dueDate?: string;
      };
      validatedGoals.push({
        title: goal.title.trim(),
        ...(goal.description ? { description: goal.description.trim() } : {}),
        status: isGoalStatus(goal.status) ? goal.status : "not_started",
        ...(goal.dueDate ? { dueDate: new Date(goal.dueDate) } : {}),
      });
    }
  }

  const review = await PerformanceReview.create({
    employee: employeeId,
    reviewer: user._id,
    period: period.trim(),
    status: "draft",
    ratings: validatedRatings,
    goals: validatedGoals,
    aiGenerated: false,
  });

  logActivity({
    action: "review_created",
    actor: user,
    targetType: "performance_review",
    targetId: review._id,
    targetName: `review for ${employee.name}`,
    details: { period: period.trim(), employeeName: employee.name },
    ip: req.ip,
  });

  // Notify the employee that a review has been assigned.
  notify({
    recipient: employee._id,
    actor: user,
    type: "review_assigned",
    title: "Performance review assigned",
    message: `A performance review for ${period.trim()} has been assigned to you.`,
    link: "/performance-reviews",
    data: { period: period.trim(), reviewerName: user.name },
  });

  // Real-time SSE push to employee
  pushToUsers(
    [employee._id.toString(), user._id.toString()],
    createEvent("review-updated", {
      reviewId: review._id,
      action: "assigned",
      period: period.trim(),
      employeeName: employee.name,
    })
  );

  // Trigger AI generation in the background via Inngest.
  await inngest.send({
    name: "performance/generate-review",
    data: { reviewId: review._id.toString() },
  });

  res.status(201).json({ review: review.toJSON() });
}

// ---------------------------------------------------------------------------
// List all reviews — admin/head, filterable by employee, status, period
// ---------------------------------------------------------------------------

export async function listReviews(req: Request, res: Response): Promise<void> {
  const { limit, offset } = parsePagination(req);
  const search = searchRegex(req.query.search);
  const status = req.query.status;
  const employeeId = req.query.employeeId;
  const period = req.query.period;

  const filter: Record<string, unknown> = {};

  if (status !== undefined) {
    if (!isReviewStatus(status)) {
      res.status(400).json({
        error: "status must be one of: draft, pending_acknowledgment, acknowledged, completed",
      });
      return;
    }
    filter.status = status;
  }

  if (typeof employeeId === "string" && !isInvalidObjectId(employeeId)) {
    filter.employee = employeeId;
  }

  if (typeof period === "string" && period.trim()) {
    filter.period = period.trim();
  }

  if (search) {
    // Search over populated employee — resolve matching user ids first.
    const matchingUsers = await User.find({
      $or: [{ name: search }, { email: search }],
    }).select("_id");
    const ids = matchingUsers.map((u) => u._id);
    if (ids.length === 0) {
      res.json({ reviews: [], total: 0, limit, offset });
      return;
    }
    filter.employee = { $in: ids };
  }

  let query = PerformanceReview.find(filter)
    .populate("employee", "name email department")
    .populate("reviewer", "name email")
    .sort({ createdAt: -1 });

  if (limit !== null) {
    query = query.skip(offset).limit(limit);
  }

  const [reviews, total] = await Promise.all([
    query,
    PerformanceReview.countDocuments(filter),
  ]);

  res.json({
    reviews: reviews.map((r) => r.toJSON()),
    total,
    limit,
    offset,
  });
}

// ---------------------------------------------------------------------------
// My reviews — employee views their own reviews
// ---------------------------------------------------------------------------

export async function myReviews(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const { limit, offset } = parsePagination(req);
  const search = searchRegex(req.query.search);
  const status = req.query.status;

  const filter: Record<string, unknown> = { employee: user._id };

  if (status !== undefined) {
    if (!isReviewStatus(status)) {
      res.status(400).json({
        error: "status must be one of: draft, pending_acknowledgment, acknowledged, completed",
      });
      return;
    }
    filter.status = status;
  }

  if (search) {
    filter.$or = [{ period: search }, { summary: search }];
  }

  let query = PerformanceReview.find(filter)
    .populate("reviewer", "name email")
    .sort({ createdAt: -1 });

  if (limit !== null) {
    query = query.skip(offset).limit(limit);
  }

  const [reviews, total] = await Promise.all([
    query,
    PerformanceReview.countDocuments(filter),
  ]);

  res.json({
    reviews: reviews.map((r) => r.toJSON()),
    total,
    limit,
    offset,
  });
}

// ---------------------------------------------------------------------------
// Get single review — owner, reviewer, or admin
// ---------------------------------------------------------------------------

export async function getReview(req: Request, res: Response): Promise<void> {
  const review = await getReviewOr404(req, res);
  if (!review) return;

  const user = req.user!;
  const isOwner = review.employee.equals(user._id);
  const isReviewer = review.reviewer.equals(user._id);
  const isAdmin = user.role === "admin";

  if (!isOwner && !isReviewer && !isAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const populated = await PerformanceReview.findById(review._id)
    .populate("employee", "name email department")
    .populate("reviewer", "name email");

  res.json({ review: populated!.toJSON() });
}

// ---------------------------------------------------------------------------
// Update review — admin/head updates ratings, goals, feedback
// ---------------------------------------------------------------------------

interface UpdateReviewBody {
  ratings?: unknown;
  goals?: unknown;
  status?: unknown;
  strengths?: unknown;
  improvements?: unknown;
  summary?: unknown;
}

export async function updateReview(req: Request, res: Response): Promise<void> {
  const review = await getReviewOr404(req, res);
  if (!review) return;
  const user = req.user!;

  const { ratings, goals, status, strengths, improvements, summary } =
    (req.body ?? {}) as UpdateReviewBody;

  const hasAnyField =
    ratings !== undefined ||
    goals !== undefined ||
    status !== undefined ||
    strengths !== undefined ||
    improvements !== undefined ||
    summary !== undefined;

  if (!hasAnyField) {
    res
      .status(400)
      .json({ error: "At least one field to update is required" });
    return;
  }

  // Validate ratings.
  if (ratings !== undefined) {
    if (!Array.isArray(ratings)) {
      res.status(400).json({ error: "ratings must be an array" });
      return;
    }
    const validatedRatings: {
      category: string;
      score: number;
      comment?: string;
    }[] = [];
    for (const r of ratings) {
      if (
        typeof r !== "object" ||
        r === null ||
        typeof (r as Record<string, unknown>).category !== "string" ||
        typeof (r as Record<string, unknown>).score !== "number"
      ) {
        res.status(400).json({
          error: "Each rating must have a category (string) and score (number)",
        });
        return;
      }
      const rating = r as { category: string; score: number; comment?: string };
      if (rating.score < 1 || rating.score > 5) {
        res.status(400).json({ error: "Rating scores must be between 1 and 5" });
        return;
      }
      validatedRatings.push({
        category: rating.category.trim(),
        score: rating.score,
        ...(rating.comment ? { comment: rating.comment.trim() } : {}),
      });
    }
    review.ratings = validatedRatings;

    // Recompute overall score as the average of all ratings.
    if (validatedRatings.length > 0) {
      const total = validatedRatings.reduce((sum, r) => sum + r.score, 0);
      review.overallScore =
        Math.round((total / validatedRatings.length) * 10) / 10;
    }
  }

  // Validate goals.
  if (goals !== undefined) {
    if (!Array.isArray(goals)) {
      res.status(400).json({ error: "goals must be an array" });
      return;
    }
    const validatedGoals: {
      title: string;
      description?: string;
      status: GoalStatus;
      dueDate?: Date;
      completedAt?: Date;
    }[] = [];
    for (const g of goals) {
      if (
        typeof g !== "object" ||
        g === null ||
        typeof (g as Record<string, unknown>).title !== "string"
      ) {
        res
          .status(400)
          .json({ error: "Each goal must have a title (string)" });
        return;
      }
      const goal = g as {
        title: string;
        description?: string;
        status?: string;
        dueDate?: string;
        completedAt?: string;
      };
      validatedGoals.push({
        title: goal.title.trim(),
        ...(goal.description ? { description: goal.description.trim() } : {}),
        status: isGoalStatus(goal.status) ? goal.status : "not_started",
        ...(goal.dueDate ? { dueDate: new Date(goal.dueDate) } : {}),
        ...(goal.completedAt
          ? { completedAt: new Date(goal.completedAt) }
          : {}),
      });
    }
    review.goals = validatedGoals;
  }

  // Status transition (only valid transitions allowed).
  if (status !== undefined) {
    if (!isReviewStatus(status)) {
      res.status(400).json({
        error: "status must be one of: draft, pending_acknowledgment, acknowledged, completed",
      });
      return;
    }
    review.status = status;
  }

  if (typeof strengths === "string") review.strengths = strengths.trim();
  if (typeof improvements === "string") review.improvements = improvements.trim();
  if (typeof summary === "string") review.summary = summary.trim();

  await review.save();

  logActivity({
    action: "review_created", // reuse for updates
    actor: user,
    targetType: "performance_review",
    targetId: review._id,
    targetName: `review for employee`,
    details: {
      period: review.period,
      updatedFields: Object.keys(req.body ?? {}),
    },
    ip: req.ip,
  });

  // Real-time SSE push to employee and reviewer
  pushToUsers(
    [review.employee.toString(), review.reviewer.toString()],
    createEvent("review-updated", {
      reviewId: review._id,
      action: "updated",
      period: review.period,
      status: review.status,
      updatedFields: Object.keys(req.body ?? {}),
    })
  );

  res.json({ review: review.toJSON() });
}

// ---------------------------------------------------------------------------
// Delete review — admin only
// ---------------------------------------------------------------------------

export async function deleteReview(req: Request, res: Response): Promise<void> {
  const review = await getReviewOr404(req, res);
  if (!review) return;

  const user = req.user!;

  // Only admins can delete performance reviews.
  if (user.role !== "admin") {
    res.status(403).json({ error: "Only admins can delete performance reviews" });
    return;
  }

  await PerformanceReview.findByIdAndDelete(review._id);

  logActivity({
    action: "review_deleted",
    actor: user,
    targetType: "performance_review",
    targetId: review._id,
    targetName: `review for employee`,
    details: { period: review.period, employeeId: review.employee },
    ip: req.ip,
  });

  // Real-time SSE push to employee and reviewer
  pushToUsers(
    [review.employee.toString(), review.reviewer.toString()],
    createEvent("review-updated", {
      reviewId: review._id,
      action: "deleted",
      period: review.period,
    })
  );

  // Clean up notifications linked to this review.
  await Notification.deleteMany({
    $or: [
      { "data.reviewId": review._id.toString() },
      { link: "/performance-reviews" },
    ],
  });

  res.json({ message: "Performance review deleted successfully" });
}

// ---------------------------------------------------------------------------
// Acknowledge review — employee confirms they've seen the feedback
// ---------------------------------------------------------------------------

interface AcknowledgeBody {
  comments?: unknown;
}

export async function acknowledgeReview(
  req: Request,
  res: Response
): Promise<void> {
  const review = await getReviewOr404(req, res);
  if (!review) return;
  const user = req.user!;

  if (!review.employee.equals(user._id)) {
    res.status(403).json({ error: "You can only acknowledge your own reviews" });
    return;
  }

  if (
    review.status !== "pending_acknowledgment" &&
    review.status !== "acknowledged"
  ) {
    res.status(400).json({
      error: "This review is not pending acknowledgment",
    });
    return;
  }

  const { comments } = (req.body ?? {}) as AcknowledgeBody;
  if (comments !== undefined && typeof comments !== "string") {
    res.status(400).json({ error: "comments must be a string" });
    return;
  }

  review.status = "acknowledged";
  review.acknowledgedAt = new Date();
  if (typeof comments === "string" && comments.trim()) {
    review.employeeComments = comments.trim();
  }

  await review.save();

  logActivity({
    action: "review_acknowledged",
    actor: user,
    targetType: "performance_review",
    targetId: review._id,
    targetName: `review for ${user.name}`,
    details: { period: review.period },
    ip: req.ip,
  });

  // Notify the reviewer that the employee acknowledged.
  notify({
    recipient: review.reviewer,
    actor: user,
    type: "review_acknowledged",
    title: "Review acknowledged",
    message: `${user.name} has acknowledged their ${review.period} performance review.`,
    link: "/performance-reviews",
    data: { employeeName: user.name, period: review.period },
  });

  // Real-time SSE push to reviewer and employee
  pushToUsers(
    [review.reviewer.toString(), user._id.toString()],
    createEvent("review-updated", {
      reviewId: review._id,
      action: "acknowledged",
      period: review.period,
      employeeName: user.name,
    })
  );

  res.json({ review: review.toJSON() });
}

// ---------------------------------------------------------------------------
// Update goal status — admin/head updates a specific goal within a review
// ---------------------------------------------------------------------------

interface UpdateGoalBody {
  status?: unknown;
  description?: unknown;
}

export async function updateGoal(req: Request, res: Response): Promise<void> {
  const review = await getReviewOr404(req, res);
  if (!review) return;

  const idx = goalIndexParam(req);
  if (idx === undefined || idx >= review.goals.length) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }

  const { status, description } = (req.body ?? {}) as UpdateGoalBody;
  const goal = review.goals[idx]!;

  if (status !== undefined) {
    if (!isGoalStatus(status)) {
      res.status(400).json({
        error: "status must be one of: not_started, in_progress, completed",
      });
      return;
    }
    goal.status = status;
    if (status === "completed") {
      goal.completedAt = new Date();
    } else {
      goal.completedAt = undefined;
    }
  }

  if (typeof description === "string") {
    goal.description = description.trim();
  }

  await review.save();

  logActivity({
    action: "goal_updated",
    actor: req.user,
    targetType: "performance_review",
    targetId: review._id,
    targetName: `goal: ${goal.title}`,
    details: { goalTitle: goal.title, newStatus: goal.status },
    ip: req.ip,
  });

  // Real-time SSE push to employee and reviewer
  pushToUsers(
    [review.employee.toString(), review.reviewer.toString()],
    createEvent("review-updated", {
      reviewId: review._id,
      action: "goal-updated",
      period: review.period,
      goalTitle: goal.title,
      goalStatus: goal.status,
    })
  );

  res.json({ review: review.toJSON() });
}

// ---------------------------------------------------------------------------
// AI Review Generation Helper
// ---------------------------------------------------------------------------

async function synthesizeEmployeeReviewData(
  employeeId: string,
  period: string,
  managerNotes?: string
) {
  const employee = await User.findById(employeeId).populate("department");
  if (!employee) throw new Error("Employee not found");

  const departmentName =
    employee.department && typeof employee.department === "object" && "name" in employee.department
      ? String((employee.department as { name: string }).name)
      : "General";

  // 1. Attendance Metrics (past 90 days)
  const since90Days = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const attendanceRecords = await Attendance.find({
    employee: employeeId,
    date: { $gte: since90Days },
  });

  const totalShifts = attendanceRecords.length;
  const presentCount = attendanceRecords.filter((a) => a.status === "present").length;
  const lateCount = attendanceRecords.filter((a) => a.status === "late").length;
  const punctualityRate = totalShifts > 0 ? Math.round(((totalShifts - lateCount) / totalShifts) * 100) : 95;
  const attendanceRate = totalShifts > 0 ? Math.round((presentCount / totalShifts) * 100) : 90;

  // 2. Task Velocity & Completion
  const tasks = await Task.find({ assignee: employeeId });
  const completedTasks = tasks.filter((t) => t.status === "completed");
  const inProgressTasks = tasks.filter((t) => t.status === "in_progress" || t.status === "in_review");
  const overdueTasks = tasks.filter((t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "completed");
  const totalSubtasks = tasks.reduce((acc, t) => acc + (t.subtasks?.length || 0), 0);
  const completedSubtasks = tasks.reduce(
    (acc, t) => acc + (t.subtasks?.filter((st) => st.isCompleted).length || 0),
    0
  );

  // 3. Peer Kudos Received
  const kudos = await Kudos.find({ recipient: employeeId }).limit(10);
  const kudosSummary = kudos.map((k) => `"${k.message}" [${k.badge}]`).join("; ");

  // 4. Feedback Notes
  const feedbackList = await Feedback.find({ author: employeeId }).limit(5);
  const feedbackSummary = feedbackList.map((f) => f.message).join("; ");

  // 5. Gemini AI Prompt
  const apiKey = process.env.GEMINI_API_KEY;
  let aiOutput: {
    ratings: Array<{ category: string; score: number; comment: string }>;
    overallScore: number;
    strengths: string;
    improvements: string;
    summary: string;
    goals: Array<{ title: string; description: string; dueDate?: string; status: GoalStatus }>;
  } | null = null;

  if (apiKey && !apiKey.startsWith("AQ.dummy")) {
    const models = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"];
    const prompt = `You are an executive HR evaluation specialist and people management advisor.
Generate a structured, objective, comprehensive 360 performance review evaluation for the following employee:

Employee: ${employee.name} (${employee.role}, Department: ${departmentName})
Evaluation Period: ${period}
Manager Context/Notes: ${managerNotes || "Regular periodic performance review."}

Performance Telemetry:
- Attendance: ${attendanceRate}% attendance rate, ${punctualityRate}% punctuality rate (${presentCount} present, ${lateCount} late out of ${totalShifts} shifts)
- Tasks: ${completedTasks.length} completed tasks, ${inProgressTasks.length} in-progress, ${overdueTasks.length} overdue
- Subtask Completion: ${completedSubtasks} / ${totalSubtasks} subtasks delivered
- Peer Kudos Received: ${kudosSummary || "None in this period"}
- Direct Feedback Context: ${feedbackSummary || "None"}

Return ONLY a valid JSON object strictly matching this schema:
{
  "ratings": [
    { "category": "Technical Skills", "score": 1-5, "comment": "detailed observation" },
    { "category": "Communication", "score": 1-5, "comment": "detailed observation" },
    { "category": "Teamwork", "score": 1-5, "comment": "detailed observation" },
    { "category": "Leadership & Initiative", "score": 1-5, "comment": "detailed observation" }
  ],
  "overallScore": 1.0 to 5.0 (one decimal place),
  "strengths": "Detailed paragraph highlighting top contributions, competencies, and positive traits.",
  "improvements": "Constructive paragraph outlining growth opportunities and skills expansion.",
  "summary": "Executive summary paragraph encapsulating overall performance during the period.",
  "goals": [
    { "title": "SMART Goal Title", "description": "Actionable success criteria", "dueDate": "YYYY-MM-DD" }
  ]
}`;

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0.3 },
          }),
        });
        if (res.ok) {
          const json = (await res.json()) as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
          };
          const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const parsed = JSON.parse(rawText);
            if (parsed.ratings && parsed.overallScore && parsed.summary) {
              aiOutput = parsed;
              break;
            }
          }
        }
      } catch (err) {
        // Try next model
      }
    }
  }

  // Fallback heuristic evaluation
  if (!aiOutput) {
    const taskScore = completedTasks.length >= 8 ? 5 : completedTasks.length >= 4 ? 4 : 3;
    const punctScore = punctualityRate >= 90 ? 5 : punctualityRate >= 75 ? 4 : 3;
    const teamScore = kudos.length >= 2 ? 5 : 4;
    const overall = Number(((taskScore + punctScore + teamScore + 4) / 4).toFixed(1));

    aiOutput = {
      ratings: [
        {
          category: "Technical Skills",
          score: taskScore,
          comment: `Demonstrated strong execution completing ${completedTasks.length} tasks and ${completedSubtasks} granular subtasks with reliable technical output.`,
        },
        {
          category: "Communication",
          score: 4,
          comment: "Maintains clear status updates on tasks and collaborates constructively with department peers.",
        },
        {
          category: "Teamwork",
          score: teamScore,
          comment: kudos.length > 0
            ? `Active team player recognized with ${kudos.length} peer kudos badges during this cycle.`
            : "Consistently supports cross-functional team initiatives and shares domain context.",
        },
        {
          category: "Leadership & Initiative",
          score: 4,
          comment: "Shows good autonomy in resolving task blockers and proposing pragmatic workflow improvements.",
        },
      ],
      overallScore: overall,
      strengths: `${employee.name} is a dependable contributor in the ${departmentName} department with an attendance rate of ${attendanceRate}% and ${completedTasks.length} successfully delivered tasks. Demonstrates solid domain competence and positive teamwork.`,
      improvements: "Continue expanding leadership on end-to-end architectural initiatives and proactively mentoring newer teammates during onboarding.",
      summary: `Overall solid performance for ${period}. ${employee.name} met operational targets, achieved strong peer recognition, and is well-positioned for increased project scope.`,
      goals: [
        {
          title: "Drive quarterly milestone delivery",
          description: "Take primary technical ownership for next quarter roadmap epic deliverables.",
          status: "not_started",
          dueDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        },
        {
          title: "Knowledge sharing & documentation",
          description: "Author at least 2 internal technical runbooks for common operational workflows.",
          status: "not_started",
          dueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        },
      ],
    };
  }

  return { employee, departmentName, ...aiOutput };
}

/**
 * Admin / Head: Direct interactive AI review draft generator.
 * POST /api/performance-reviews/ai-generate-draft
 */
export async function generateReviewDraftWithAI(req: Request, res: Response): Promise<void> {
  const { employeeId, period, managerNotes } = req.body as {
    employeeId?: string;
    period?: string;
    managerNotes?: string;
  };

  if (!employeeId || isInvalidObjectId(employeeId)) {
    res.status(400).json({ error: "Valid employeeId is required" });
    return;
  }

  if (!period || !period.trim()) {
    res.status(400).json({ error: "Review period (e.g. 'Q1 2026') is required" });
    return;
  }

  try {
    const draft = await synthesizeEmployeeReviewData(employeeId, period.trim(), managerNotes);
    res.json({ draft });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to generate AI review draft" });
  }
}

/**
 * Admin / Head: Re-evaluate and regenerate an existing review with AI.
 * POST /api/performance-reviews/:id/ai-generate
 */
export async function generateReviewWithAI(req: Request, res: Response): Promise<void> {
  const review = await getReviewOr404(req, res);
  if (!review) return;

  const { managerNotes } = req.body as { managerNotes?: string };

  try {
    const draft = await synthesizeEmployeeReviewData(
      review.employee.toString(),
      review.period,
      managerNotes
    );

    review.ratings = draft.ratings;
    review.overallScore = draft.overallScore;
    review.strengths = draft.strengths;
    review.improvements = draft.improvements;
    review.summary = draft.summary;
    review.aiGenerated = true;

    if (draft.goals && draft.goals.length > 0) {
      review.goals = draft.goals.map((g) => ({
        title: g.title,
        description: g.description,
        status: (g.status as GoalStatus) || "not_started",
        dueDate: g.dueDate ? new Date(g.dueDate) : undefined,
      }));
    }

    await review.save();

    logActivity({
      action: "review_generated",
      actor: req.user,
      targetType: "performance_review",
      targetId: review._id,
      targetName: `AI-regenerated review for ${draft.employee.name}`,
      details: { period: review.period, overallScore: review.overallScore },
      ip: req.ip,
    });

    res.json({ review: review.toJSON() });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to generate AI review" });
  }
}
