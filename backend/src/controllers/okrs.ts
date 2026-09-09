import type { Request, Response } from "express";
import mongoose from "mongoose";
import { logActivity } from "../lib/activityLog.js";
import { createEvent, pushToAll } from "../lib/sse.js";
import { Okr } from "../models/Okr.js";
import type { IKeyResult, OkrLevel, OkrStatus } from "../models/Okr.js";

function isInvalidObjectId(id: string): boolean {
  return !mongoose.isValidObjectId(id);
}

function param(req: Request, name: string): string | undefined {
  const value = req.params[name];
  return typeof value === "string" ? value : undefined;
}

function calculateOkrProgress(keyResults: IKeyResult[]): number {
  if (!keyResults || keyResults.length === 0) return 0;
  const total = keyResults.reduce((sum, kr) => {
    const target = kr.targetValue || 1;
    const current = kr.currentValue || 0;
    const krProgress = Math.min(100, Math.max(0, Math.round((current / target) * 100)));
    return sum + krProgress;
  }, 0);
  return Math.round(total / keyResults.length);
}

/**
 * GET /api/okrs
 * List OKRs with optional filters (period, level, department, status).
 */
export async function getOkrs(req: Request, res: Response): Promise<void> {
  try {
    const period = typeof req.query.period === "string" ? req.query.period : undefined;
    const level = typeof req.query.level === "string" ? req.query.level : undefined;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const departmentId = typeof req.query.department === "string" ? req.query.department : undefined;

    const filter: Record<string, unknown> = {};
    if (period) filter.period = period;
    if (level) filter.level = level;
    if (status) filter.status = status;
    if (departmentId && mongoose.isValidObjectId(departmentId)) {
      filter.department = departmentId;
    }

    const okrs = await Okr.find(filter)
      .sort({ createdAt: -1 })
      .populate("owner", "name email role")
      .populate("department", "name")
      .lean();

    res.json({ okrs });
  } catch (error) {
    console.error("Get OKRs error:", error);
    res.status(500).json({ error: "Failed to fetch OKRs" });
  }
}

/**
 * POST /api/okrs
 * Create a new OKR with key results.
 */
export async function createOkr(req: Request, res: Response): Promise<void> {
  try {
    const user = req.user!;
    const {
      title,
      description = "",
      period = "Q1 2026",
      level = "individual",
      department,
      keyResults = [],
    } = req.body as {
      title?: string;
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
    };

    if (!title || typeof title !== "string" || !title.trim()) {
      res.status(400).json({ error: "Objective title is required" });
      return;
    }

    const parsedKeyResults: IKeyResult[] = keyResults.map((kr) => {
      const target = Number(kr.targetValue) || 100;
      const current = Number(kr.currentValue) || 0;
      const progress = Math.min(100, Math.max(0, Math.round((current / target) * 100)));
      let status: IKeyResult["status"] = "on_track";
      if (progress >= 100) status = "completed";
      else if (progress < 30) status = "at_risk";

      return {
        title: kr.title?.trim() || "Key Result",
        targetValue: target,
        currentValue: current,
        unit: kr.unit?.trim() || "%",
        progress,
        status,
      };
    });

    const overallProgress = calculateOkrProgress(parsedKeyResults);

    const okr = await Okr.create({
      title: title.trim(),
      description: description.trim(),
      period,
      level,
      department: department && mongoose.isValidObjectId(department) ? department : user.department || null,
      owner: user._id,
      keyResults: parsedKeyResults,
      overallProgress,
      status: overallProgress >= 100 ? "completed" : "active",
    });

    logActivity({
      action: "user_updated",
      actor: user,
      targetType: "OKR",
      targetId: okr._id,
      targetName: okr.title,
      ip: req.ip,
    });

    pushToAll(createEvent("okr-updated", { okrId: okr._id }));

    res.status(201).json({ message: "OKR created successfully", okr });
  } catch (error) {
    console.error("Create OKR error:", error);
    res.status(500).json({ error: "Failed to create OKR" });
  }
}

/**
 * PATCH /api/okrs/:id
 * Update OKR or update Key Result values.
 */
export async function updateOkr(req: Request, res: Response): Promise<void> {
  try {
    const user = req.user!;
    const id = param(req, "id");
    if (!id || isInvalidObjectId(id)) {
      res.status(404).json({ error: "OKR not found" });
      return;
    }

    const okr = await Okr.findById(id);
    if (!okr) {
      res.status(404).json({ error: "OKR not found" });
      return;
    }

    const { title, description, period, level, status, keyResults } = req.body;

    if (title) okr.title = title.trim();
    if (description !== undefined) okr.description = description.trim();
    if (period) okr.period = period;
    if (level) okr.level = level;
    if (status) okr.status = status;

    if (Array.isArray(keyResults)) {
      okr.keyResults = keyResults.map((kr: any) => {
        const target = Number(kr.targetValue) || 100;
        const current = Number(kr.currentValue) || 0;
        const progress = Math.min(100, Math.max(0, Math.round((current / target) * 100)));
        let krStatus: IKeyResult["status"] = "on_track";
        if (progress >= 100) krStatus = "completed";
        else if (progress < 40) krStatus = "at_risk";

        return {
          _id: kr._id,
          title: kr.title?.trim() || "Key Result",
          targetValue: target,
          currentValue: current,
          unit: kr.unit || "%",
          progress,
          status: krStatus,
        };
      });
    }

    okr.overallProgress = calculateOkrProgress(okr.keyResults);
    if (okr.overallProgress >= 100 && okr.status === "active") {
      okr.status = "completed";
    }

    await okr.save();

    pushToAll(createEvent("okr-updated", { okrId: okr._id }));

    res.json({ message: "OKR updated successfully", okr });
  } catch (error) {
    console.error("Update OKR error:", error);
    res.status(500).json({ error: "Failed to update OKR" });
  }
}

/**
 * DELETE /api/okrs/:id
 * Delete an OKR.
 */
export async function deleteOkr(req: Request, res: Response): Promise<void> {
  try {
    const user = req.user!;
    const id = param(req, "id");
    if (!id || isInvalidObjectId(id)) {
      res.status(404).json({ error: "OKR not found" });
      return;
    }

    const okr = await Okr.findById(id);
    if (!okr) {
      res.status(404).json({ error: "OKR not found" });
      return;
    }

    if (user.role !== "admin" && okr.owner.toString() !== user._id.toString()) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    await Okr.findByIdAndDelete(id);

    pushToAll(createEvent("okr-updated", { okrId: id }));

    res.json({ message: "OKR deleted successfully" });
  } catch (error) {
    console.error("Delete OKR error:", error);
    res.status(500).json({ error: "Failed to delete OKR" });
  }
}
