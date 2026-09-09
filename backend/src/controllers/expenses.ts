import type { Request, Response } from "express";
import mongoose from "mongoose";
import { logActivity } from "../lib/activityLog.js";
import { parsePagination, searchRegex } from "../lib/pagination.js";
import { createEvent, pushToAll, pushToClient } from "../lib/sse.js";
import { Expense } from "../models/Expense.js";
import type { ExpenseCategory, ExpenseStatus } from "../models/Expense.js";
import { User } from "../models/User.js";

function isInvalidObjectId(id: string): boolean {
  return !mongoose.isValidObjectId(id);
}

function param(req: Request, name: string): string | undefined {
  const value = req.params[name];
  return typeof value === "string" ? value : undefined;
}

/**
 * GET /api/expenses/my
 * Get current employee's expense submissions.
 */
export async function getMyExpenses(req: Request, res: Response): Promise<void> {
  try {
    const user = req.user!;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;

    const filter: Record<string, unknown> = { employee: user._id };
    if (status) filter.status = status;

    const expenses = await Expense.find(filter)
      .sort({ createdAt: -1 })
      .populate("reviewedBy", "name email")
      .lean();

    res.json({ expenses });
  } catch (error) {
    console.error("Get my expenses error:", error);
    res.status(500).json({ error: "Failed to fetch expense claims" });
  }
}

/**
 * POST /api/expenses
 * Submit a new expense reimbursement claim.
 */
export async function createExpense(req: Request, res: Response): Promise<void> {
  try {
    const user = req.user!;
    const { title, category, amount, currency = "USD", date, description, receiptName } = req.body as {
      title?: string;
      category?: ExpenseCategory;
      amount?: number;
      currency?: string;
      date?: string;
      description?: string;
      receiptName?: string;
    };

    if (!title || typeof title !== "string" || !title.trim()) {
      res.status(400).json({ error: "Expense title is required" });
      return;
    }

    if (!category || !["travel", "meals", "office_supplies", "software", "training", "hardware", "other"].includes(category)) {
      res.status(400).json({ error: "Valid category is required" });
      return;
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      res.status(400).json({ error: "Amount must be a positive number" });
      return;
    }

    const expense = await Expense.create({
      employee: user._id,
      title: title.trim(),
      category,
      amount: numAmount,
      currency: currency.toUpperCase(),
      date: date ? new Date(date) : new Date(),
      description: description?.trim() || "",
      receiptName: receiptName?.trim() || "",
      status: "pending",
    });

    logActivity({
      action: "user_updated",
      actor: user,
      targetType: "Expense",
      targetId: expense._id,
      targetName: expense.title,
      details: { amount: numAmount, category },
      ip: req.ip,
    });

    pushToAll(createEvent("expense-updated", { expenseId: expense._id, status: "pending" }));

    res.status(201).json({ message: "Expense claim submitted successfully", expense });
  } catch (error) {
    console.error("Create expense error:", error);
    res.status(500).json({ error: "Failed to submit expense claim" });
  }
}

/**
 * GET /api/expenses
 * Admin and Head of Department endpoint.
 */
export async function getAllExpenses(req: Request, res: Response): Promise<void> {
  try {
    const user = req.user!;
    const { limit, offset } = parsePagination(req);
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const departmentId = typeof req.query.department === "string" ? req.query.department : undefined;

    const filter: Record<string, unknown> = {};
    if (category) filter.category = category;
    if (status) filter.status = status;

    if (user.role === "head" && user.department) {
      const deptUsers = await User.find({ department: user.department }).select("_id");
      filter.employee = { $in: deptUsers.map((u) => u._id) };
    } else if (search || departmentId) {
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
      filter.employee = { $in: matchingUsers.map((u) => u._id) };
    }

    let query = Expense.find(filter)
      .sort({ createdAt: -1 })
      .populate<{ employee: { _id: string; name: string; email: string; department?: { _id: string; name: string } } }>({
        path: "employee",
        select: "name email department",
        populate: { path: "department", select: "name" },
      })
      .populate("reviewedBy", "name email");

    if (offset > 0) query = query.skip(offset);
    if (limit !== null) query = query.limit(limit);

    const [expenses, total] = await Promise.all([
      query.lean(),
      Expense.countDocuments(filter),
    ]);

    res.json({
      data: expenses,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Get all expenses error:", error);
    res.status(500).json({ error: "Failed to fetch expenses" });
  }
}

/**
 * PATCH /api/expenses/:id/status
 * Approve, reject, or reimburse an expense.
 */
export async function updateExpenseStatus(req: Request, res: Response): Promise<void> {
  try {
    const user = req.user!;
    const id = param(req, "id");
    const { status, rejectionReason } = req.body as {
      status?: ExpenseStatus;
      rejectionReason?: string;
    };

    if (!id || isInvalidObjectId(id)) {
      res.status(404).json({ error: "Expense claim not found" });
      return;
    }

    if (!status || !["approved", "rejected", "reimbursed"].includes(status)) {
      res.status(400).json({ error: "Invalid expense status" });
      return;
    }

    const expense = await Expense.findById(id);
    if (!expense) {
      res.status(404).json({ error: "Expense claim not found" });
      return;
    }

    expense.status = status;
    expense.reviewedBy = user._id as mongoose.Types.ObjectId;
    expense.reviewedAt = new Date();

    if (status === "rejected") {
      expense.rejectionReason = rejectionReason?.trim() || "Rejected by manager";
    }
    if (status === "reimbursed") {
      expense.reimbursedAt = new Date();
    }

    await expense.save();

    pushToClient(
      expense.employee.toString(),
      createEvent("expense-updated", { expenseId: expense._id, status })
    );

    logActivity({
      action: "user_updated",
      actor: user,
      targetType: "Expense",
      targetId: expense._id,
      targetName: expense.title,
      details: { status, rejectionReason },
      ip: req.ip,
    });

    res.json({ message: `Expense claim ${status} successfully`, expense });
  } catch (error) {
    console.error("Update expense status error:", error);
    res.status(500).json({ error: "Failed to update expense claim" });
  }
}

/**
 * DELETE /api/expenses/:id
 * Delete expense claim.
 */
export async function deleteExpense(req: Request, res: Response): Promise<void> {
  try {
    const user = req.user!;
    const id = param(req, "id");
    if (!id || isInvalidObjectId(id)) {
      res.status(404).json({ error: "Expense claim not found" });
      return;
    }

    const expense = await Expense.findById(id);
    if (!expense) {
      res.status(404).json({ error: "Expense claim not found" });
      return;
    }

    if (user.role !== "admin" && expense.employee.toString() !== user._id.toString()) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    await Expense.findByIdAndDelete(id);

    logActivity({
      action: "user_deleted",
      actor: user,
      targetType: "Expense",
      targetId: expense._id,
      targetName: expense.title,
      ip: req.ip,
    });

    res.json({ message: "Expense claim deleted successfully" });
  } catch (error) {
    console.error("Delete expense error:", error);
    res.status(500).json({ error: "Failed to delete expense claim" });
  }
}

/**
 * POST /api/expenses/ai-analyze-receipt
 * AI Smart Receipt Parser and Policy Compliance Auditor.
 */
export async function analyzeReceiptWithAI(req: Request, res: Response): Promise<void> {
  const { receiptText, vendor, amount, date, categoryHint } = req.body as {
    receiptText?: string;
    vendor?: string;
    amount?: number;
    date?: string;
    categoryHint?: string;
  };

  const rawInput = [
    receiptText ? `Receipt Text:\n${receiptText}` : "",
    vendor ? `Merchant / Vendor: ${vendor}` : "",
    amount !== undefined ? `Reported Amount: $${amount}` : "",
    date ? `Receipt Date: ${date}` : "",
    categoryHint ? `User Category Hint: ${categoryHint}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  if (!rawInput.trim()) {
    res.status(400).json({ error: "Please provide receipt text, merchant details, or amount to analyze." });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  let analysisOutput: {
    merchant: string;
    amount: number;
    currency: string;
    category: ExpenseCategory;
    date: string;
    description: string;
    itemizedItems: Array<{ name: string; price: number }>;
    complianceRisk: "low" | "medium" | "high";
    complianceNotes: string;
    suggestedTitle: string;
  } | null = null;

  if (apiKey && !apiKey.startsWith("AQ.dummy")) {
    const models = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.0-flash"];
    const prompt = `You are an automated corporate expense auditing and OCR receipt extraction agent.
Parse the following expense receipt data, categorize it into an approved category, itemize line items, and audit for policy compliance:

Receipt Input:
${rawInput}

Corporate Expense Policy Rules:
- Allowed Categories: "travel", "meals", "office_supplies", "software", "training", "hardware", "other"
- Max single meal allowance without prior VP approval: $75/person
- Travel allowance standard: Economy transit, standard lodging
- Weekend meals or personal items must trigger "medium" or "high" compliance risk warnings with clear rationale.
- High risk triggers: Ambiguous luxury items, amounts > $1000 without contract, alcohol.

Return ONLY a valid JSON object strictly matching this schema:
{
  "merchant": "Extracted Merchant Name",
  "amount": numeric total amount,
  "currency": "USD",
  "category": "travel" | "meals" | "office_supplies" | "software" | "training" | "hardware" | "other",
  "date": "YYYY-MM-DD",
  "description": "Concise business justification statement",
  "itemizedItems": [
    { "name": "Item Description", "price": 0.00 }
  ],
  "complianceRisk": "low" | "medium" | "high",
  "complianceNotes": "Clear audit statement assessing policy compliance, limits, and potential flags.",
  "suggestedTitle": "Professional claim title (e.g., 'Client Dinner - Acme Corp')"
}`;

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
          }),
        });

        if (resp.ok) {
          const json = (await resp.json()) as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
          };
          const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const parsed = JSON.parse(rawText);
            if (parsed.merchant && parsed.amount !== undefined && parsed.category) {
              analysisOutput = parsed;
              break;
            }
          }
        }
      } catch (err) {
        // Try next model
      }
    }
  }

  // Fallback heuristic extraction
  if (!analysisOutput) {
    const textLower = (receiptText || "").toLowerCase();
    let detectedCategory: ExpenseCategory = "other";
    if (textLower.includes("uber") || textLower.includes("lyft") || textLower.includes("flight") || textLower.includes("hotel") || textLower.includes("taxi")) {
      detectedCategory = "travel";
    } else if (textLower.includes("restaurant") || textLower.includes("cafe") || textLower.includes("food") || textLower.includes("coffee") || textLower.includes("lunch") || textLower.includes("dinner")) {
      detectedCategory = "meals";
    } else if (textLower.includes("aws") || textLower.includes("github") || textLower.includes("subscription") || textLower.includes("license") || textLower.includes("cloud")) {
      detectedCategory = "software";
    } else if (textLower.includes("paper") || textLower.includes("staples") || textLower.includes("pen") || textLower.includes("notebook")) {
      detectedCategory = "office_supplies";
    } else if (textLower.includes("course") || textLower.includes("udemy") || textLower.includes("conference") || textLower.includes("workshop")) {
      detectedCategory = "training";
    } else if (textLower.includes("monitor") || textLower.includes("laptop") || textLower.includes("keyboard") || textLower.includes("mouse") || textLower.includes("cable")) {
      detectedCategory = "hardware";
    } else if (categoryHint && ["travel", "meals", "office_supplies", "software", "training", "hardware", "other"].includes(categoryHint)) {
      detectedCategory = categoryHint as ExpenseCategory;
    }

    const numericMatch = (receiptText || "").match(/\$?\s*([0-9]+(?:\.[0-9]{2})?)/);
    const matchStr = numericMatch && numericMatch[1] ? numericMatch[1] : undefined;
    const parsedAmount = amount !== undefined ? amount : matchStr ? parseFloat(matchStr) : 25.0;
    const merchantName = vendor || (textLower.includes("uber") ? "Uber Technologies" : textLower.includes("aws") ? "Amazon Web Services" : textLower.includes("starbucks") ? "Starbucks Coffee" : "Commercial Vendor");
    const todayStr: string = (typeof date === "string" && date) ? date : (new Date().toISOString().split("T")[0] || "2026-03-08");

    const isExcessive = parsedAmount > 250;
    const isWeekend = new Date(todayStr).getDay() === 0 || new Date(todayStr).getDay() === 6;

    analysisOutput = {
      merchant: merchantName,
      amount: parsedAmount,
      currency: "USD",
      category: detectedCategory,
      date: todayStr,
      description: `Business ${detectedCategory.replace("_", " ")} expense at ${merchantName}.`,
      itemizedItems: [{ name: `${merchantName} charge`, price: parsedAmount }],
      complianceRisk: isExcessive ? "medium" : isWeekend ? "medium" : "low",
      complianceNotes: isExcessive
        ? "Amount exceeds $250 standard threshold; manager review recommended."
        : isWeekend
          ? "Transaction occurred on a weekend; verify business event justification."
          : "Standard expense claim adhering to company limits and policy guidelines.",
      suggestedTitle: `${merchantName} - ${detectedCategory.charAt(0).toUpperCase() + detectedCategory.slice(1)}`,
    };
  }


  res.json({ analysis: analysisOutput });
}
