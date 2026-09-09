import type { Request, Response } from "express";
import { Department } from "../models/Department.js";
import { Task } from "../models/Task.js";
import { User } from "../models/User.js";

/**
 * GET /api/org-chart
 * Returns a hierarchical graph of leadership, departments, heads, and members.
 */
export async function getOrgStructure(_req: Request, res: Response): Promise<void> {
  try {
    const [users, departments, tasks] = await Promise.all([
      User.find().select("name email role department createdAt").lean(),
      Department.find().lean(),
      Task.find({ status: { $nin: ["completed", "rejected"] } }).select("assignedTo priority").lean(),
    ]);

    // Build active task counts per user
    const taskCountMap = new Map<string, number>();
    for (const t of tasks) {
      if (t.assignedTo) {
        const uid = t.assignedTo.toString();
        taskCountMap.set(uid, (taskCountMap.get(uid) || 0) + 1);
      }
    }

    const admins = users.filter((u) => u.role === "admin");
    const heads = users.filter((u) => u.role === "head");
    const employees = users.filter((u) => u.role === "employee");

    const departmentTrees = departments.map((dept) => {
      const deptHeads = heads
        .filter((h) => h.department && h.department.toString() === dept._id.toString())
        .map((h) => ({
          _id: h._id,
          name: h.name,
          email: h.email,
          role: h.role,
          activeTasks: taskCountMap.get(h._id.toString()) || 0,
        }));

      const deptEmployees = employees
        .filter((e) => e.department && e.department.toString() === dept._id.toString())
        .map((e) => ({
          _id: e._id,
          name: e.name,
          email: e.email,
          role: e.role,
          activeTasks: taskCountMap.get(e._id.toString()) || 0,
        }));

      return {
        _id: dept._id,
        name: dept.name,
        description: (dept as any).description || "",
        totalMembers: deptHeads.length + deptEmployees.length,
        heads: deptHeads,
        members: deptEmployees,
      };
    });

    const unassignedEmployees = employees
      .filter((e) => !e.department)
      .map((e) => ({
        _id: e._id,
        name: e.name,
        email: e.email,
        role: e.role,
        activeTasks: taskCountMap.get(e._id.toString()) || 0,
      }));

    res.json({
      organization: {
        name: "Enterprise Organization",
        totalEmployees: users.length,
        totalDepartments: departments.length,
      },
      leadership: admins.map((a) => ({
        _id: a._id,
        name: a.name,
        email: a.email,
        role: a.role,
        activeTasks: taskCountMap.get(a._id.toString()) || 0,
      })),
      departments: departmentTrees,
      unassigned: unassignedEmployees,
    });
  } catch (error) {
    console.error("Org chart error:", error);
    res.status(500).json({ error: "Failed to generate organizational structure" });
  }
}
