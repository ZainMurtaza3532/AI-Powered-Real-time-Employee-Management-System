import mongoose from "mongoose";
import { User, type IUser } from "../models/User.js";

export interface RoleScopedUserFilter {
  /** Mongoose user field filter, e.g. an ObjectId or { $in: [...] } */
  userFilter?: mongoose.Types.ObjectId | { $in: mongoose.Types.ObjectId[] };
  /** Set to true if the query should immediately return 0 records (e.g. head with no department or 0 department members) */
  isEmpty: boolean;
}

/**
 * Builds the role-based user filter for data visibility scoping:
 * - Admin (role: 'admin'):
 *     - No restriction (fetch all records across the entire company).
 *     - If an optional department filter is specified, scopes to that department.
 * - Department Head (role: 'head'):
 *     - Scoped strictly to employees belonging to their department.
 *     - If no department assigned or 0 members, marked as empty.
 * - Employee (role: 'employee' or any fallback):
 *     - Scoped strictly to their own personal user ID (`user: req.user._id`).
 *
 * @param user The authenticated user from req.user
 * @param optionalDepartmentId Optional department ID override (only applied for admin queries)
 */
export async function buildRoleScopeUserFilter(
  user: IUser,
  optionalDepartmentId?: string
): Promise<RoleScopedUserFilter> {
  // Admin: Sees ALL records across the entire company
  if (user.role === "admin") {
    if (optionalDepartmentId && mongoose.isValidObjectId(optionalDepartmentId)) {
      const deptMembers = await User.find({
        department: new mongoose.Types.ObjectId(optionalDepartmentId),
      }).select("_id");
      const memberIds = deptMembers.map((m) => m._id);
      if (memberIds.length === 0) {
        return { isEmpty: true };
      }
      return { userFilter: { $in: memberIds }, isEmpty: false };
    }
    return { isEmpty: false };
  }

  // Department Head: Sees ONLY records of employees who belong to their department
  if (user.role === "head") {
    if (!user.department) {
      return { isEmpty: true };
    }

    const deptMembers = await User.find({ department: user.department }).select("_id");
    const memberIds = deptMembers.map((m) => m._id);
    if (memberIds.length === 0) {
      return { isEmpty: true };
    }

    return { userFilter: { $in: memberIds }, isEmpty: false };
  }

  // Employee (role: 'employee' or any fallback): Sees ONLY their own personal records
  return { userFilter: user._id, isEmpty: false };
}
