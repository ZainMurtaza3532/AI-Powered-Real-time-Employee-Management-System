import type { Request, Response } from "express";
import mongoose from "mongoose";
import { logActivity } from "../lib/activityLog.js";
import { parsePagination, searchRegex } from "../lib/pagination.js";
import { createEvent, pushToAll, pushToClient } from "../lib/sse.js";
import { Payroll } from "../models/Payroll.js";
import type { PaymentMethod, PaymentStatus } from "../models/Payroll.js";
import { User } from "../models/User.js";

function isInvalidObjectId(id: string): boolean {
  return !mongoose.isValidObjectId(id);
}

function param(req: Request, name: string): string | undefined {
  const value = req.params[name];
  return typeof value === "string" ? value : undefined;
}

/**
 * GET /api/payroll/my
 * Returns payslips for the authenticated employee.
 */
export async function getMyPayslips(req: Request, res: Response): Promise<void> {
  try {
    const user = req.user!;
    const year = req.query.year ? Number(req.query.year) : undefined;

    const query: Record<string, unknown> = { employee: user._id };
    if (year && !isNaN(year)) query.year = year;

    const payslips = await Payroll.find(query)
      .sort({ year: -1, month: -1 })
      .populate<{ employee: { name: string; email: string; department?: { name: string } } }>({
        path: "employee",
        select: "name email department",
        populate: { path: "department", select: "name" },
      })
      .lean();

    res.json({ payslips });
  } catch (error) {
    console.error("Get my payslips error:", error);
    res.status(500).json({ error: "Failed to fetch payslips" });
  }
}

/**
 * GET /api/payroll
 * Admin and Head of Department endpoint with search, status filters, and pagination.
 */
export async function getAllPayrolls(req: Request, res: Response): Promise<void> {
  try {
    const { limit, offset } = parsePagination(req);
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const month = req.query.month ? Number(req.query.month) : undefined;
    const year = req.query.year ? Number(req.query.year) : undefined;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const departmentId = typeof req.query.department === "string" ? req.query.department : undefined;

    const filter: Record<string, unknown> = {};
    if (month && !isNaN(month)) filter.month = month;
    if (year && !isNaN(year)) filter.year = year;
    if (status) filter.paymentStatus = status;

    let employeeIds: mongoose.Types.ObjectId[] | undefined;

    if (search || departmentId) {
      const userFilter: Record<string, unknown> = {};
      if (departmentId && mongoose.isValidObjectId(departmentId)) {
        userFilter.department = departmentId;
      }
      if (search) {
        const regex = searchRegex(search);
        if (regex) {
          userFilter.$or = [{ name: regex }, { email: regex }];
        }
      }

      const matchingUsers = await User.find(userFilter).select("_id");
      employeeIds = matchingUsers.map((u) => u._id as mongoose.Types.ObjectId);
      filter.employee = { $in: employeeIds };
    }

    let query = Payroll.find(filter)
      .sort({ year: -1, month: -1, createdAt: -1 })
      .populate<{ employee: { _id: string; name: string; email: string; department?: { _id: string; name: string } } }>({
        path: "employee",
        select: "name email department",
        populate: { path: "department", select: "name" },
      });

    if (offset > 0) query = query.skip(offset);
    if (limit !== null) query = query.limit(limit);

    const [payrolls, total] = await Promise.all([
      query.lean(),
      Payroll.countDocuments(filter),
    ]);

    res.json({
      data: payrolls,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Get all payrolls error:", error);
    res.status(500).json({ error: "Failed to fetch payroll records" });
  }
}

/**
 * GET /api/payroll/stats
 * Admin dashboard overview for payroll expenses.
 */
export async function getPayrollStats(req: Request, res: Response): Promise<void> {
  try {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    const currentMonthPayrolls = await Payroll.find({
      year: currentYear,
      month: currentMonth,
    }).lean();

    const totalDisbursed = currentMonthPayrolls
      .filter((p) => p.paymentStatus === "paid")
      .reduce((sum, p) => sum + p.netSalary, 0);

    const totalPending = currentMonthPayrolls
      .filter((p) => p.paymentStatus !== "paid")
      .reduce((sum, p) => sum + p.netSalary, 0);

    const totalPayrollCount = currentMonthPayrolls.length;
    const paidCount = currentMonthPayrolls.filter((p) => p.paymentStatus === "paid").length;

    res.json({
      month: currentMonth,
      year: currentYear,
      totalDisbursed,
      totalPending,
      totalPayrollCount,
      paidCount,
      pendingCount: totalPayrollCount - paidCount,
    });
  } catch (error) {
    console.error("Payroll stats error:", error);
    res.status(500).json({ error: "Failed to fetch payroll statistics" });
  }
}

/**
 * POST /api/payroll/generate
 * 1-click batch payroll run for a given month and year.
 */
export async function generateMonthlyPayroll(req: Request, res: Response): Promise<void> {
  try {
    const user = req.user!;
    const { month, year, defaultBasicSalary = 5000 } = req.body as {
      month?: number;
      year?: number;
      defaultBasicSalary?: number;
    };

    const targetMonth = Number(month) || new Date().getMonth() + 1;
    const targetYear = Number(year) || new Date().getFullYear();

    if (targetMonth < 1 || targetMonth > 12) {
      res.status(400).json({ error: "Valid month between 1 and 12 is required" });
      return;
    }

    // Get all active employees
    const employees = await User.find({ role: { $in: ["employee", "head"] } }).lean();

    const createdRecords = [];

    for (const emp of employees) {
      // Check if payroll already exists for this employee for this month/year
      const existing = await Payroll.findOne({
        employee: emp._id,
        month: targetMonth,
        year: targetYear,
      });

      if (!existing) {
        // Base allowances & standard deductions
        const basicSalary = defaultBasicSalary;
        const allowances = {
          housing: Math.round(basicSalary * 0.15),
          transport: Math.round(basicSalary * 0.05),
          medical: Math.round(basicSalary * 0.05),
          other: 0,
        };
        const deductions = {
          tax: Math.round(basicSalary * 0.12),
          pension: Math.round(basicSalary * 0.05),
          unpaidLeave: 0,
          other: 0,
        };

        const totalAllowances = allowances.housing + allowances.transport + allowances.medical + allowances.other;
        const totalDeductions = deductions.tax + deductions.pension + deductions.unpaidLeave + deductions.other;
        const grossSalary = basicSalary + totalAllowances;
        const netSalary = grossSalary - totalDeductions;

        const payroll = await Payroll.create({
          employee: emp._id,
          month: targetMonth,
          year: targetYear,
          basicSalary,
          allowances,
          deductions,
          grossSalary,
          netSalary,
          paymentStatus: "pending",
          paymentMethod: "bank_transfer",
          notes: `Automated payroll generation for ${targetMonth}/${targetYear}`,
        });

        createdRecords.push(payroll);
      }
    }

    logActivity({
      action: "department_created",
      actor: user,
      targetType: "Payroll",
      targetName: `Payroll Run ${targetMonth}/${targetYear}`,
      details: { generatedCount: createdRecords.length, month: targetMonth, year: targetYear },
      ip: req.ip,
    });

    pushToAll(createEvent("payroll-updated", { month: targetMonth, year: targetYear }));

    res.status(201).json({
      message: `Successfully generated ${createdRecords.length} payroll records for ${targetMonth}/${targetYear}`,
      generatedCount: createdRecords.length,
    });
  } catch (error) {
    console.error("Generate payroll error:", error);
    res.status(500).json({ error: "Failed to generate monthly payroll" });
  }
}

/**
 * PATCH /api/payroll/:id/status
 * Updates payment status of a payslip (e.g. mark as paid).
 */
export async function updatePayrollStatus(req: Request, res: Response): Promise<void> {
  try {
    const user = req.user!;
    const id = param(req, "id");
    const { status, paymentMethod = "bank_transfer" } = req.body as {
      status?: PaymentStatus;
      paymentMethod?: PaymentMethod;
    };

    if (!id || isInvalidObjectId(id)) {
      res.status(404).json({ error: "Payroll record not found" });
      return;
    }

    if (!status || !["pending", "processing", "paid", "failed"].includes(status)) {
      res.status(400).json({ error: "Invalid payment status" });
      return;
    }

    const payroll = await Payroll.findById(id);
    if (!payroll) {
      res.status(404).json({ error: "Payroll record not found" });
      return;
    }

    payroll.paymentStatus = status;
    payroll.paymentMethod = paymentMethod;
    if (status === "paid" && !payroll.paymentDate) {
      payroll.paymentDate = new Date();
    }
    await payroll.save();

    pushToClient(
      payroll.employee.toString(),
      createEvent("payroll-updated", { payrollId: payroll._id, status })
    );

    logActivity({
      action: "user_updated",
      actor: user,
      targetType: "Payroll",
      targetId: payroll._id,
      targetName: `Payslip #${payroll._id}`,
      details: { status, paymentMethod },
      ip: req.ip,
    });

    res.json({ message: "Payroll status updated successfully", payroll });
  } catch (error) {
    console.error("Update payroll status error:", error);
    res.status(500).json({ error: "Failed to update payroll status" });
  }
}

/**
 * POST /api/payroll/single
 * Create or custom update an individual employee's salary slip.
 */
export async function createOrUpdateSinglePayroll(req: Request, res: Response): Promise<void> {
  try {
    const user = req.user!;
    const {
      employeeId,
      month,
      year,
      basicSalary,
      allowances = { housing: 0, transport: 0, medical: 0, other: 0 },
      deductions = { tax: 0, pension: 0, unpaidLeave: 0, other: 0 },
      paymentStatus = "pending",
      paymentMethod = "bank_transfer",
      notes,
    } = req.body;

    if (!employeeId || isInvalidObjectId(employeeId)) {
      res.status(400).json({ error: "Valid employee ID is required" });
      return;
    }

    const m = Number(month);
    const y = Number(year);
    const base = Number(basicSalary);

    if (isNaN(m) || m < 1 || m > 12 || isNaN(y) || isNaN(base) || base < 0) {
      res.status(400).json({ error: "Invalid month, year, or basic salary" });
      return;
    }

    const totalAllowances =
      Number(allowances.housing || 0) +
      Number(allowances.transport || 0) +
      Number(allowances.medical || 0) +
      Number(allowances.other || 0);

    const totalDeductions =
      Number(deductions.tax || 0) +
      Number(deductions.pension || 0) +
      Number(deductions.unpaidLeave || 0) +
      Number(deductions.other || 0);

    const grossSalary = base + totalAllowances;
    const netSalary = Math.max(0, grossSalary - totalDeductions);

    const payroll = await Payroll.findOneAndUpdate(
      { employee: employeeId, month: m, year: y },
      {
        basicSalary: base,
        allowances,
        deductions,
        grossSalary,
        netSalary,
        paymentStatus,
        paymentMethod,
        notes,
        ...(paymentStatus === "paid" ? { paymentDate: new Date() } : {}),
      },
      { upsert: true, new: true, runValidators: true }
    );

    pushToClient(
      employeeId,
      createEvent("payroll-updated", { payrollId: payroll._id })
    );

    logActivity({
      action: "user_updated",
      actor: user,
      targetType: "Payroll",
      targetId: payroll._id,
      targetName: `Payslip ${m}/${y}`,
      ip: req.ip,
    });

    res.json({ message: "Payroll record saved successfully", payroll });
  } catch (error) {
    console.error("Save single payroll error:", error);
    res.status(500).json({ error: "Failed to save payroll record" });
  }
}

/**
 * DELETE /api/payroll/:id
 * Delete a payroll record.
 */
export async function deletePayroll(req: Request, res: Response): Promise<void> {
  try {
    const user = req.user!;
    const id = param(req, "id");
    if (!id || isInvalidObjectId(id)) {
      res.status(404).json({ error: "Payroll record not found" });
      return;
    }

    const payroll = await Payroll.findByIdAndDelete(id);
    if (!payroll) {
      res.status(404).json({ error: "Payroll record not found" });
      return;
    }

    logActivity({
      action: "user_deleted",
      actor: user,
      targetType: "Payroll",
      targetId: payroll._id,
      targetName: `Payslip #${id}`,
      ip: req.ip,
    });

    res.json({ message: "Payroll record deleted successfully" });
  } catch (error) {
    console.error("Delete payroll error:", error);
    res.status(500).json({ error: "Failed to delete payroll record" });
  }
}
