import type { Request, Response } from "express";
import mongoose from "mongoose";
import { logActivity } from "../lib/activityLog.js";
import { getIpAddress, isIpWhitelisted } from "../lib/getIpAddress.js";
import { parsePagination, searchRegex } from "../lib/pagination.js";
import { pushToUsers, createEvent } from "../lib/sse.js";
import { Attendance, ATTENDANCE_STATUSES, type AttendanceStatus } from "../models/Attendance.js";
import { OfficeLocation } from "../models/OfficeLocation.js";
import { User } from "../models/User.js";

interface MarkAttendanceBody {
  date?: unknown;
  records?: unknown;
}

interface UpdateAttendanceBody {
  status?: unknown;
  checkIn?: unknown;
  checkOut?: unknown;
  notes?: unknown;
}

function isInvalidObjectId(id: string): boolean {
  return !mongoose.isValidObjectId(id);
}

/** Express 5 types params as `string | string[] | undefined` — normalize to a single id. */
function paramId(req: Request): string | undefined {
  const id = req.params.id;
  return typeof id === "string" ? id : undefined;
}

/** Parses a "YYYY-MM-DD" string as a UTC-midnight date; null when invalid. */
function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (date.toISOString().slice(0, 10) !== value) return null;
  return date;
}

/** Parses a full ISO datetime string; null when invalid. */
function parseDateTime(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function todayUtc(): Date {
  const today = new Date();
  return new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
}

function isAttendanceStatus(value: unknown): value is AttendanceStatus {
  return typeof value === "string" && (ATTENDANCE_STATUSES as readonly string[]).includes(value);
}

/** Returns the first day of the current month as UTC midnight. */
function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
}

/** Returns the last day of the current month as UTC midnight. */
function endOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0));
}

// ---------------------------------------------------------------------------
// Employee Self Check-In & Check-Out
// ---------------------------------------------------------------------------

/**
 * Any authenticated user: Get today's attendance punch status & active timer.
 */
export async function getTodayStatus(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const today = todayUtc();

  const record = await Attendance.findOne({ user: user._id, date: today })
    .populate("user", "name email")
    .populate("markedBy", "name");

  if (!record) {
    res.json({
      status: "not_checked_in",
      record: null,
      checkIn: null,
      checkOut: null,
      workingSeconds: 0,
    });
    return;
  }

  let workingSeconds = 0;
  if (record.checkIn) {
    const startTime = new Date(record.checkIn).getTime();
    const endTime = record.checkOut ? new Date(record.checkOut).getTime() : Date.now();
    workingSeconds = Math.max(0, Math.floor((endTime - startTime) / 1000));
  }

  const punchStatus = !record.checkIn
    ? "not_checked_in"
    : record.checkOut
      ? "checked_out"
      : "checked_in";

  res.json({
    status: punchStatus,
    record: record.toJSON(),
    checkIn: record.checkIn,
    checkOut: record.checkOut,
    workingSeconds,
  });
}

/**
 * Any authenticated user: Self check-in / check-out with 1-click.
 */
export async function selfPunch(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const { action, location, notes } = (req.body ?? {}) as {
    action?: "check_in" | "check_out";
    location?: "office" | "remote";
    notes?: string;
  };

  if (action !== "check_in" && action !== "check_out") {
    res.status(400).json({ error: "Action must be 'check_in' or 'check_out'" });
    return;
  }

  const today = todayUtc();
  const now = new Date();
  const clientIp = getIpAddress(req);

  let record = await Attendance.findOne({ user: user._id, date: today });

  if (action === "check_in") {
    if (record?.checkIn) {
      res.status(400).json({ error: "You have already checked in today" });
      return;
    }

    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const isLateArrival = currentHour > 9 || (currentHour === 9 && currentMin > 30);
    const attendanceStatus: AttendanceStatus = isLateArrival ? "late" : "present";

    // -----------------------------------------------------------------------
    // Database-Driven IP Whitelist Verification
    // -----------------------------------------------------------------------
    // Query active branch locations from MongoDB
    const activeLocations = await OfficeLocation.find({ isActive: true });

    // Compare client's extracted IP with active branch IP whitelists
    const matchedOffice = activeLocations.find((loc) =>
      isIpWhitelisted(clientIp, loc.ipAddresses)
    );

    let detectedLocationType: string;
    let matchedBranchName: string | undefined;
    let isAnomalous = false;
    let anomalyReason: string | undefined;

    if (matchedOffice) {
      // Whitelist Match: Recognized branch office IP
      detectedLocationType = "Office";
      matchedBranchName = matchedOffice.branchName;
      isAnomalous = false;
    } else {
      // Whitelist Fallback: Do not reject punch, fallback to Remote/WFH and flag anomaly for manager review
      detectedLocationType = "Remote/WFH";
      isAnomalous = true;
      anomalyReason = `Client IP ${clientIp} does not match any active branch office whitelist.`;
    }

    const locationPrefix = matchedBranchName
      ? `[Office: ${matchedBranchName}]`
      : `[Remote / WFH]`;
    const fullNotes = [locationPrefix, `[IP: ${clientIp}]`, notes?.trim()].filter(Boolean).join(" ");

    if (!record) {
      record = new Attendance({
        user: user._id,
        date: today,
        status: attendanceStatus,
        checkIn: now,
        markedBy: user._id,
        notes: fullNotes,
        locationType: detectedLocationType,
        branchName: matchedBranchName,
        ipAddress: clientIp,
        isAnomalous,
        anomalyReason,
      });
    } else {
      record.status = attendanceStatus;
      record.checkIn = now;
      record.markedBy = user._id;
      record.locationType = detectedLocationType;
      record.branchName = matchedBranchName;
      record.ipAddress = clientIp;
      record.isAnomalous = isAnomalous;
      record.anomalyReason = anomalyReason;
      if (fullNotes) record.notes = fullNotes;
    }

    await record.save();

    logActivity({
      action: "attendance_marked",
      actor: user,
      targetType: "attendance",
      targetId: record._id,
      targetName: `Self check-in for ${today.toISOString().slice(0, 10)} (${detectedLocationType})`,
      details: {
        status: attendanceStatus,
        locationType: detectedLocationType,
        branchName: matchedBranchName,
        ipAddress: clientIp,
        isAnomalous,
        checkIn: now,
      },
      ip: clientIp,
    });

    pushToUsers(
      [user._id.toString()],
      createEvent("attendance-updated", {
        action: "check_in",
        status: attendanceStatus,
        date: today.toISOString().slice(0, 10),
        locationType: detectedLocationType,
        branchName: matchedBranchName,
        isAnomalous,
      })
    );

    const populated = await record.populate([
      { path: "user", select: "name email" },
      { path: "markedBy", select: "name" },
    ]);

    const successMsg = matchedBranchName
      ? `Checked in at ${matchedBranchName} (${attendanceStatus})`
      : isAnomalous
        ? `Checked in as ${attendanceStatus} (Remote / WFH flagged for review)`
        : `Successfully checked in as ${attendanceStatus}`;

    res.json({
      message: successMsg,
      record: populated.toJSON(),
      status: "checked_in",
      locationType: detectedLocationType,
      branchName: matchedBranchName,
      isAnomalous,
      clientIp,
    });
    return;
  }

  // Check out flow
  if (!record || !record.checkIn) {
    res.status(400).json({ error: "You must check in before checking out" });
    return;
  }

  if (record.checkOut) {
    res.status(400).json({ error: "You have already checked out today" });
    return;
  }

  record.checkOut = now;
  record.ipAddress = clientIp;
  if (notes) {
    record.notes = ((record.notes ? `${record.notes} | ` : "") + notes.trim()).trim();
  }

  const diffMs = now.getTime() - new Date(record.checkIn).getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  if (diffHours < 4 && record.status === "present") {
    record.status = "half_day";
  }

  await record.save();

  logActivity({
    action: "attendance_marked",
    actor: user,
    targetType: "attendance",
    targetId: record._id,
    targetName: `Self check-out for ${today.toISOString().slice(0, 10)}`,
    details: {
      checkOut: now,
      hoursWorked: Math.round(diffHours * 10) / 10,
      ipAddress: clientIp,
    },
    ip: clientIp,
  });

  pushToUsers(
    [user._id.toString()],
    createEvent("attendance-updated", {
      action: "check_out",
      status: record.status,
      date: today.toISOString().slice(0, 10),
    })
  );

  const populated = await record.populate([
    { path: "user", select: "name email" },
    { path: "markedBy", select: "name" },
  ]);

  res.json({
    message: "Successfully checked out",
    record: populated.toJSON(),
    status: "checked_out",
  });
}

// ---------------------------------------------------------------------------
// Mark attendance (bulk)
// ---------------------------------------------------------------------------

/**
 * Head or admin: marks attendance for one or more employees on a specific date.
 * Uses bulkWrite with upsert for efficiency.
 */
export async function markAttendance(req: Request, res: Response): Promise<void> {
  const actor = req.user!;
  const { date: dateStr, records } = (req.body ?? {}) as MarkAttendanceBody;

  const date = parseDateOnly(dateStr);
  if (!date) {
    res.status(400).json({ error: "date must be a valid date (YYYY-MM-DD)" });
    return;
  }

  // Attendance cannot be marked for future dates.
  if (date.getTime() > todayUtc().getTime()) {
    res.status(400).json({ error: "Attendance cannot be marked for future dates" });
    return;
  }

  if (!Array.isArray(records) || records.length === 0) {
    res.status(400).json({ error: "records must be a non-empty array" });
    return;
  }

  // Validate and prepare all records.
  const bulkOps: mongoose.mongo.AnyBulkWriteOperation[] = [];
  const resultRecords: Array<{ userId: string; status: AttendanceStatus }> = [];

  for (const record of records) {
    const { userId, status, checkIn, checkOut, notes } = record as {
      userId?: unknown;
      status?: unknown;
      checkIn?: unknown;
      checkOut?: unknown;
      notes?: unknown;
    };

    if (typeof userId !== "string" || isInvalidObjectId(userId)) {
      res.status(400).json({ error: `Invalid userId: ${String(userId)}` });
      return;
    }
    if (!isAttendanceStatus(status)) {
      res.status(400).json({
        error: `status must be one of: ${ATTENDANCE_STATUSES.join(", ")}`,
      });
      return;
    }

    // Validate the user exists and is in the actor's department (for heads).
    const targetUser = await User.findById(userId).select("_id department name");
    if (!targetUser) {
      res.status(404).json({ error: `User not found: ${userId}` });
      return;
    }

    if (actor.role === "head") {
      if (!actor.department || !targetUser.department || !actor.department.equals(targetUser.department)) {
        res.status(403).json({
          error: "You can only mark attendance for members of your own department",
        });
        return;
      }
    }

    const parsedCheckIn = parseDateTime(checkIn);
    const parsedCheckOut = parseDateTime(checkOut);

    bulkOps.push({
      updateOne: {
        filter: { user: targetUser._id, date },
        update: {
          $set: {
            status,
            checkIn: parsedCheckIn ?? null,
            checkOut: parsedCheckOut ?? null,
            markedBy: actor._id,
            notes: typeof notes === "string" ? notes.trim() || undefined : undefined,
          },
        },
        upsert: true,
      },
    });

    resultRecords.push({ userId: targetUser._id.toString(), status });
  }

  await Attendance.bulkWrite(bulkOps);

  logActivity({
    action: "attendance_bulk_marked",
    actor,
    targetType: "attendance",
    targetName: `attendance for ${date.toISOString().slice(0, 10)}`,
    details: {
      date: date.toISOString().slice(0, 10),
      count: resultRecords.length,
      statuses: resultRecords.map((r) => r.status),
    },
    ip: req.ip,
  });

  // Fetch the created/updated records to return.
  const dateStart = date;
  const dateEnd = new Date(date.getTime() + 86_400_000);
  const userIds = resultRecords.map((r) => new mongoose.Types.ObjectId(r.userId));
  const saved = await Attendance.find({
    user: { $in: userIds },
    date: { $gte: dateStart, $lt: dateEnd },
  })
    .populate("user", "name email")
    .populate("markedBy", "name");

  // Real-time SSE push to affected employees
  const affectedUserIds = resultRecords.map((r) => r.userId);
  pushToUsers(
    affectedUserIds,
    createEvent("attendance-updated", {
      date: date.toISOString().slice(0, 10),
      count: resultRecords.length,
      action: "bulk-marked",
    })
  );

  res.status(201).json({
    attendance: saved.map((doc) => doc.toJSON()),
    count: saved.length,
  });
}

// ---------------------------------------------------------------------------
// My attendance
// ---------------------------------------------------------------------------

/** Any authenticated user: their own attendance records, newest first. */
export async function myAttendance(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const { limit, offset } = parsePagination(req);

  // Default to current month if no range provided.
  const from = parseDateOnly(req.query.from) ?? startOfCurrentMonth();
  const to = parseDateOnly(req.query.to) ?? endOfCurrentMonth();
  // Include the full end day.
  const toExclusive = new Date(to.getTime() + 86_400_000);

  const filter: Record<string, unknown> = {
    user: user._id,
    date: { $gte: from, $lt: toExclusive },
  };

  let query = Attendance.find(filter)
    .populate("user", "name email")
    .populate("markedBy", "name")
    .sort({ date: -1 });
  if (limit !== null) {
    query = query.skip(offset).limit(limit);
  }

  const [records, total] = await Promise.all([
    query,
    Attendance.countDocuments(filter),
  ]);

  res.json({
    attendance: records.map((doc) => doc.toJSON()),
    total,
    limit,
    offset,
  });
}

// ---------------------------------------------------------------------------
// All attendance (Role-Based Data Scoping)
// ---------------------------------------------------------------------------

/**
 * Role-Based Data Scoping: GET /api/attendance
 * - Admin (role: 'admin'): sees ALL records across the entire company (empty query {}).
 * - Department Head (role: 'head'): sees ONLY records of employees in their specific department.
 * - Employee (role: 'employee'): sees ONLY their own personal records.
 *
 * Populates user details (name, email, avatar) and their department details.
 */
export async function getAllAttendances(req: Request, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const { limit, offset } = parsePagination(req);
    const search = searchRegex(req.query.search);
    const status = req.query.status;
    const locationType = req.query.locationType;
    const isAnomalous = req.query.isAnomalous;
    const deptParam = req.query.department;

    // Dynamic Mongoose query object
    const query: Record<string, unknown> = {};

    // 1. Role-Based Data Scoping Filter
    if (user.role === "admin") {
      // Admin: query stays empty {} (fetch all records across the company)
      // Optional: Admin can optionally filter by a specific department
      if (typeof deptParam === "string" && !isInvalidObjectId(deptParam)) {
        const deptUsers = await User.find({ department: new mongoose.Types.ObjectId(deptParam) }).select("_id");
        const deptUserIds = deptUsers.map((u) => u._id);
        query.user = { $in: deptUserIds };
      }
    } else if (user.role === "head") {
      // Department Head: ONLY see records of employees who belong to their department
      if (!user.department) {
        res.json({ attendance: [], total: 0, limit, offset });
        return;
      }
      const departmentUsers = await User.find({ department: user.department }).select("_id");
      const deptUserIds = departmentUsers.map((u) => u._id);
      query.user = { $in: deptUserIds };
    } else if (user.role === "employee") {
      // Employee: ONLY see their own personal records
      query.user = user._id;
    } else {
      // Fallback for any unassigned role: restrict to self
      query.user = user._id;
    }

    // 2. Date filtering (single date or date range)
    const singleDate = parseDateOnly(req.query.date);
    if (singleDate) {
      const nextDay = new Date(singleDate.getTime() + 86_400_000);
      query.date = { $gte: singleDate, $lt: nextDay };
    } else if (req.query.from || req.query.to) {
      const from = parseDateOnly(req.query.from) ?? startOfCurrentMonth();
      const to = parseDateOnly(req.query.to) ?? endOfCurrentMonth();
      const toExclusive = new Date(to.getTime() + 86_400_000);
      query.date = { $gte: from, $lt: toExclusive };
    }

    // 3. Status filter
    if (status !== undefined && isAttendanceStatus(status)) {
      query.status = status;
    }

    // 4. Location type filter
    if (typeof locationType === "string" && locationType.trim()) {
      query.locationType = locationType.trim();
    }

    // 5. Anomaly filter
    if (isAnomalous !== undefined) {
      query.isAnomalous = isAnomalous === "true";
    }

    // 6. Search filter (by employee name or email)
    if (search) {
      const matchingUsers = await User.find({
        $or: [{ name: search }, { email: search }],
      }).select("_id");
      const matchedUserIds = matchingUsers.map((u) => u._id);

      if (query.user && typeof query.user === "object" && "$in" in (query.user as Record<string, unknown>)) {
        const allowedIds = (query.user as { $in: mongoose.Types.ObjectId[] }).$in.map((id) => id.toString());
        const filteredIds = matchedUserIds.filter((id) => allowedIds.includes(id.toString()));
        if (filteredIds.length === 0) {
          res.json({ attendance: [], total: 0, limit, offset });
          return;
        }
        query.user = { $in: filteredIds };
      } else if (query.user) {
        const currentUserId = (query.user as mongoose.Types.ObjectId).toString();
        const matchesCurrent = matchedUserIds.some((id) => id.toString() === currentUserId);
        if (!matchesCurrent) {
          res.json({ attendance: [], total: 0, limit, offset });
          return;
        }
      } else {
        query.user = { $in: matchedUserIds };
      }
    }

    // 7. Population & Query execution
    let attendanceQuery = Attendance.find(query)
      .populate({
        path: "user",
        select: "name email avatar department",
        populate: {
          path: "department",
          select: "name description",
        },
      })
      .populate("markedBy", "name email")
      .sort({ date: -1, createdAt: -1 });

    if (limit !== null) {
      attendanceQuery = attendanceQuery.skip(offset).limit(limit);
    }

    const [attendance, total] = await Promise.all([
      attendanceQuery,
      Attendance.countDocuments(query),
    ]);

    res.json({
      attendance: attendance.map((doc) => doc.toJSON()),
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error in getAllAttendances:", error);
    res.status(500).json({ error: "Failed to fetch attendance records" });
  }
}

// ---------------------------------------------------------------------------
// Department attendance
// ---------------------------------------------------------------------------

/**
 * Head or admin: attendance records for a department on a given date or date range.
 * Heads are scoped to their own department.
 */
export async function departmentAttendance(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const { limit, offset } = parsePagination(req);

  // Determine the department filter.
  let departmentId: mongoose.Types.ObjectId;
  if (user.role === "admin") {
    const deptParam = req.query.department;
    if (typeof deptParam === "string" && !isInvalidObjectId(deptParam)) {
      departmentId = new mongoose.Types.ObjectId(deptParam);
    } else if (user.department) {
      departmentId = user.department;
    } else {
      // Admin with no department: return empty.
      res.json({ attendance: [], members: [], total: 0, limit, offset });
      return;
    }
  } else {
    // Head: must have a department.
    if (!user.department) {
      res.json({ attendance: [], members: [], total: 0, limit, offset });
      return;
    }
    departmentId = user.department;
  }

  // Get all members of the department.
  const members = await User.find({ department: departmentId })
    .select("name email")
    .sort({ name: 1 });

  if (members.length === 0) {
    res.json({ attendance: [], members: [], total: 0, limit, offset });
    return;
  }

  const memberIds = members.map((m) => m._id);

  // Determine date range.
  let dateFrom: Date;
  let dateTo: Date;
  const singleDate = parseDateOnly(req.query.date);

  if (singleDate) {
    dateFrom = singleDate;
    dateTo = new Date(singleDate.getTime() + 86_400_000);
  } else {
    dateFrom = parseDateOnly(req.query.from) ?? startOfCurrentMonth();
    dateTo = parseDateOnly(req.query.to) ?? endOfCurrentMonth();
    dateTo = new Date(dateTo.getTime() + 86_400_000); // Make exclusive.
  }

  const filter: Record<string, unknown> = {
    user: { $in: memberIds },
    date: { $gte: dateFrom, $lt: dateTo },
  };

  let query = Attendance.find(filter)
    .populate("user", "name email")
    .populate("markedBy", "name")
    .sort({ date: -1, "user.name": 1 });
  if (limit !== null) {
    query = query.skip(offset).limit(limit);
  }

  const [records, total] = await Promise.all([
    query,
    Attendance.countDocuments(filter),
  ]);

  res.json({
    attendance: records.map((doc) => doc.toJSON()),
    members: members.map((m) => ({ _id: m._id, name: m.name, email: m.email })),
    total,
    limit,
    offset,
  });
}

// ---------------------------------------------------------------------------
// Single record detail
// ---------------------------------------------------------------------------

/** Any authenticated user: view a single attendance record. */
export async function getAttendance(req: Request, res: Response): Promise<void> {
  const id = paramId(req);
  if (!id || isInvalidObjectId(id)) {
    res.status(404).json({ error: "Attendance record not found" });
    return;
  }

  const record = await Attendance.findById(id)
    .populate("user", "name email")
    .populate("markedBy", "name");

  if (!record) {
    res.status(404).json({ error: "Attendance record not found" });
    return;
  }

  res.json({ attendance: record.toJSON() });
}

// ---------------------------------------------------------------------------
// Update attendance
// ---------------------------------------------------------------------------

/** Head or admin: update an existing attendance record. */
export async function updateAttendance(req: Request, res: Response): Promise<void> {
  const actor = req.user!;
  const id = paramId(req);
  if (!id || isInvalidObjectId(id)) {
    res.status(404).json({ error: "Attendance record not found" });
    return;
  }

  const record = await Attendance.findById(id).populate("user", "name email department");
  if (!record) {
    res.status(404).json({ error: "Attendance record not found" });
    return;
  }

  // Authorization: heads can only update records in their own department.
  if (actor.role === "head") {
    const targetUser = record.user as unknown as { department?: mongoose.Types.ObjectId | null };
    if (!actor.department || !targetUser.department || !actor.department.equals(targetUser.department)) {
      res.status(403).json({ error: "You can only update attendance for your own department" });
      return;
    }
  }

  const { status, checkIn, checkOut, notes } = (req.body ?? {}) as UpdateAttendanceBody;
  const hasAnyField = status !== undefined || checkIn !== undefined || checkOut !== undefined || notes !== undefined;
  if (!hasAnyField) {
    res.status(400).json({ error: "At least one field to update is required" });
    return;
  }

  if (status !== undefined && !isAttendanceStatus(status)) {
    res.status(400).json({
      error: `status must be one of: ${ATTENDANCE_STATUSES.join(", ")}`,
    });
    return;
  }

  const changed: string[] = [];
  if (status !== undefined) {
    record.status = status;
    changed.push("status");
  }
  if (checkIn !== undefined) {
    const parsed = parseDateTime(checkIn);
    record.checkIn = parsed;
    changed.push("checkIn");
  }
  if (checkOut !== undefined) {
    const parsed = parseDateTime(checkOut);
    record.checkOut = parsed;
    changed.push("checkOut");
  }
  if (notes !== undefined) {
    record.notes = typeof notes === "string" ? notes.trim() || undefined : undefined;
    changed.push("notes");
  }

  await record.save();

  logActivity({
    action: "attendance_marked",
    actor,
    targetType: "attendance",
    targetId: record._id,
    targetName: `attendance for ${record.date.toISOString().slice(0, 10)}`,
    details: { changed },
    ip: req.ip,
  });

  // Real-time SSE push to the affected employee
  const targetUserId = record.user.toString();
  pushToUsers(
    [targetUserId],
    createEvent("attendance-updated", {
      recordId: record._id,
      date: record.date.toISOString().slice(0, 10),
      action: "updated",
      status: record.status,
    })
  );

  const populated = await record.populate([
    { path: "user", select: "name email" },
    { path: "markedBy", select: "name" },
  ]);

  res.json({ attendance: populated.toJSON() });
}

// ---------------------------------------------------------------------------
// Attendance stats (admin)
// ---------------------------------------------------------------------------

/** Admin-only: attendance statistics for a date range, with per-employee breakdown and daily trend. */
export async function attendanceStats(req: Request, res: Response): Promise<void> {
  // Date range defaults to current month.
  const from = parseDateOnly(req.query.from) ?? startOfCurrentMonth();
  const to = parseDateOnly(req.query.to) ?? endOfCurrentMonth();
  const toExclusive = new Date(to.getTime() + 86_400_000);

  // Optional department filter.
  const deptParam = req.query.department;
  let departmentFilter: Record<string, unknown> = {};
  if (typeof deptParam === "string" && !isInvalidObjectId(deptParam)) {
    departmentFilter = { department: new mongoose.Types.ObjectId(deptParam) };
  }

  // Get employees in scope.
  const employees = await User.find({ ...departmentFilter, role: { $ne: "admin" } })
    .select("name email")
    .sort({ name: 1 });

  if (employees.length === 0) {
    res.json({
      totalDays: 0,
      summary: { present: 0, absent: 0, late: 0, half_day: 0, on_leave: 0 },
      rate: 0,
      byEmployee: [],
      dailyTrend: [],
    });
    return;
  }

  const employeeIds = employees.map((e) => e._id);

  // Fetch all attendance records in the range.
  const records = await Attendance.find({
    user: { $in: employeeIds },
    date: { $gte: from, $lt: toExclusive },
  }).select("user date status");

  // Calculate working days (exclude weekends: Sat=6, Sun=0).
  const msPerDay = 86_400_000;
  const totalDays = Math.floor((toExclusive.getTime() - from.getTime()) / msPerDay);
  let workingDays = 0;
  for (let i = 0; i < totalDays; i++) {
    const day = new Date(from.getTime() + i * msPerDay);
    const dow = day.getUTCDay();
    if (dow !== 0 && dow !== 6) workingDays++;
  }

  // Aggregate summary.
  const summary = { present: 0, absent: 0, late: 0, half_day: 0, on_leave: 0 };
  for (const record of records) {
    summary[record.status]++;
  }

  // Calculate rate: (present + late + half_day) / working days.
  const attendedCount = summary.present + summary.late + summary.half_day;
  const rate = workingDays > 0 ? Math.round((attendedCount / workingDays) * 10000) / 100 : 0;

  // Per-employee breakdown.
  const employeeMap = new Map(
    employees.map((e) => [
      e._id.toString(),
      { user: { _id: e._id, name: e.name, email: e.email }, present: 0, absent: 0, late: 0, half_day: 0, on_leave: 0, rate: 0 },
    ])
  );

  for (const record of records) {
    const key = record.user.toString();
    const entry = employeeMap.get(key);
    if (entry) {
      entry[record.status]++;
    }
  }

  const byEmployee = Array.from(employeeMap.values()).map((entry) => ({
    ...entry,
    rate: workingDays > 0
      ? Math.round(((entry.present + entry.late + entry.half_day) / workingDays) * 10000) / 100
      : 0,
  }));

  // Daily trend: group records by date.
  const dailyMap = new Map<string, { present: number; absent: number; late: number; total: number }>();
  for (let i = 0; i < totalDays; i++) {
    const day = new Date(from.getTime() + i * msPerDay);
    const dateStr = day.toISOString().slice(0, 10);
    dailyMap.set(dateStr, { present: 0, absent: 0, late: 0, total: 0 });
  }

  for (const record of records) {
    const dateStr = record.date.toISOString().slice(0, 10);
    const entry = dailyMap.get(dateStr);
    if (entry) {
      if (record.status === "present" || record.status === "half_day") entry.present++;
      else if (record.status === "absent") entry.absent++;
      else if (record.status === "late") entry.late++;
      entry.total++;
    }
  }

  const dailyTrend = Array.from(dailyMap.entries()).map(([date, data]) => ({
    date,
    ...data,
  }));

  res.json({
    totalDays: workingDays,
    summary,
    rate,
    byEmployee,
    dailyTrend,
  });
}
