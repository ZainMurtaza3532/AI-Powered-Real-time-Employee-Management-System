import { Router } from "express";
import {
  createTask,
  decomposeTaskWithAI,
  deleteTask,
  getTask,
  listTasks,
  myTasks,
  createdTasks,
  reviewTask,
  submitTask,
  toggleSubtask,
  updateStatus,
  updateSubtasks,
  updateTask,
} from "../controllers/tasks.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireRole } from "../middlewares/requireRole.js";

const router = Router();

router.use(requireAuth);

// AI Task Decomposition (can be called standalone or with task id)
router.post("/ai-decompose", decomposeTaskWithAI);
router.post("/:id/ai-decompose", decomposeTaskWithAI);

// Any authenticated user: their own assigned tasks.
router.get("/mine", myTasks);

// Head/admin: tasks they created.
router.get("/created", requireRole("head", "admin"), createdTasks);

// Admin-only: all tasks.
router.get("/", requireRole("admin"), listTasks);

// Any authenticated user (with access): task detail.
router.get("/:id", getTask);

// Subtasks operations
router.patch("/:id/subtasks/:subtaskId/toggle", toggleSubtask);
router.patch("/:id/subtasks", updateSubtasks);

// Admin/creator: update task details.
router.patch("/:id", requireRole("head", "admin"), updateTask);

// Employee (assignee): update task status.
router.patch("/:id/status", updateStatus);

// Employee (assignee): submit completed work.
router.post("/:id/submit", submitTask);

// Head/admin (creator or admin): review a submission.
router.post("/:id/review", requireRole("head", "admin"), reviewTask);

// Head/admin or creator: create a task.
router.post("/", requireRole("head", "admin"), createTask);

// Admin or creator: delete a task.
router.delete("/:id", deleteTask);

export default router;
