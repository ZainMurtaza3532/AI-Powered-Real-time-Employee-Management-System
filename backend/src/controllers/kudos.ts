import type { Request, Response } from "express";
import mongoose from "mongoose";
import { logActivity } from "../lib/activityLog.js";
import { notify } from "../lib/notifications.js";
import { parsePagination } from "../lib/pagination.js";
import { createEvent, pushToAll, pushToClient } from "../lib/sse.js";
import { Kudos } from "../models/Kudos.js";
import type { KudosBadge } from "../models/Kudos.js";
import { User } from "../models/User.js";

function isInvalidObjectId(id: string): boolean {
  return !mongoose.isValidObjectId(id);
}

function param(req: Request, name: string): string | undefined {
  const value = req.params[name];
  return typeof value === "string" ? value : undefined;
}

/**
 * GET /api/kudos
 * Feed of recent peer recognitions.
 */
export async function getKudosFeed(req: Request, res: Response): Promise<void> {
  try {
    const { limit, offset } = parsePagination(req);

    let query = Kudos.find()
      .sort({ createdAt: -1 })
      .populate("sender", "name email role")
      .populate("recipient", "name email role")
      .populate("reactions.user", "name");

    if (offset > 0) query = query.skip(offset);
    if (limit !== null) query = query.limit(limit);

    const [kudos, total] = await Promise.all([
      query.lean(),
      Kudos.countDocuments(),
    ]);

    res.json({
      data: kudos,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Get kudos feed error:", error);
    res.status(500).json({ error: "Failed to fetch kudos feed" });
  }
}

/**
 * POST /api/kudos
 * Give kudos to a teammate.
 */
export async function createKudos(req: Request, res: Response): Promise<void> {
  try {
    const user = req.user!;
    const { recipientId, badge, message } = req.body as {
      recipientId?: string;
      badge?: KudosBadge;
      message?: string;
    };

    if (!recipientId || isInvalidObjectId(recipientId)) {
      res.status(400).json({ error: "Valid recipient is required" });
      return;
    }

    if (recipientId === user._id.toString()) {
      res.status(400).json({ error: "You cannot give kudos to yourself" });
      return;
    }

    const recipient = await User.findById(recipientId);
    if (!recipient) {
      res.status(404).json({ error: "Recipient not found" });
      return;
    }

    if (!badge || !["problem_solver", "team_player", "speed_demon", "innovator", "culture_champion", "mentor", "customer_hero"].includes(badge)) {
      res.status(400).json({ error: "Valid badge selection is required" });
      return;
    }

    if (!message || typeof message !== "string" || !message.trim()) {
      res.status(400).json({ error: "Message is required" });
      return;
    }

    const kudos = await Kudos.create({
      sender: user._id,
      recipient: recipient._id,
      badge,
      message: message.trim(),
      reactions: [],
    });

    const populated = await Kudos.findById(kudos._id)
      .populate("sender", "name email role")
      .populate("recipient", "name email role")
      .lean();

    // Create notification for recipient
    await notify({
      recipient: recipient._id as mongoose.Types.ObjectId,
      actor: user,
      type: "kudos_received",
      title: "🎉 You received Kudos!",
      message: `${user.name} recognized you with the "${badge.replace(/_/g, " ")}" badge!`,
      link: "/kudos",
    });

    pushToAll(createEvent("kudos-new", populated));

    logActivity({
      action: "user_updated",
      actor: user,
      targetType: "Kudos",
      targetId: kudos._id,
      targetName: `Kudos to ${recipient.name}`,
      details: { badge },
      ip: req.ip,
    });

    res.status(201).json({ message: "Kudos sent successfully!", kudos: populated });
  } catch (error) {
    console.error("Create kudos error:", error);
    res.status(500).json({ error: "Failed to send kudos" });
  }
}

/**
 * POST /api/kudos/:id/react
 * Toggle an emoji reaction on a kudos card.
 */
export async function toggleReaction(req: Request, res: Response): Promise<void> {
  try {
    const user = req.user!;
    const id = param(req, "id");
    const { emoji } = req.body as { emoji?: string };

    if (!id || isInvalidObjectId(id)) {
      res.status(404).json({ error: "Kudos post not found" });
      return;
    }

    if (!emoji || typeof emoji !== "string") {
      res.status(400).json({ error: "Emoji is required" });
      return;
    }

    const kudos = await Kudos.findById(id);
    if (!kudos) {
      res.status(404).json({ error: "Kudos post not found" });
      return;
    }

    const existingIndex = kudos.reactions.findIndex(
      (r) => r.user.toString() === user._id.toString() && r.emoji === emoji
    );

    if (existingIndex > -1) {
      // Remove reaction
      kudos.reactions.splice(existingIndex, 1);
    } else {
      // Add reaction
      kudos.reactions.push({
        user: user._id as mongoose.Types.ObjectId,
        emoji,
      });
    }

    await kudos.save();

    const populated = await Kudos.findById(kudos._id)
      .populate("sender", "name email role")
      .populate("recipient", "name email role")
      .populate("reactions.user", "name")
      .lean();

    pushToAll(createEvent("kudos-new", populated));

    res.json({ kudos: populated });
  } catch (error) {
    console.error("Toggle reaction error:", error);
    res.status(500).json({ error: "Failed to toggle reaction" });
  }
}

/**
 * GET /api/kudos/leaderboard
 * Aggregates top recognized teammates and badge counts.
 */
export async function getKudosLeaderboard(_req: Request, res: Response): Promise<void> {
  try {
    const topRecipients = await Kudos.aggregate([
      {
        $group: {
          _id: "$recipient",
          kudosReceived: { $sum: 1 },
          badges: { $push: "$badge" },
        },
      },
      { $sort: { kudosReceived: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          userId: "$_id",
          name: "$user.name",
          email: "$user.email",
          role: "$user.role",
          kudosReceived: 1,
          badges: 1,
        },
      },
    ]);

    const badgeCounts = await Kudos.aggregate([
      {
        $group: {
          _id: "$badge",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    res.json({
      leaderboard: topRecipients,
      badgeStats: badgeCounts,
    });
  } catch (error) {
    console.error("Kudos leaderboard error:", error);
    res.status(500).json({ error: "Failed to fetch kudos leaderboard" });
  }
}

/**
 * DELETE /api/kudos/:id
 * Delete a kudos post.
 */
export async function deleteKudos(req: Request, res: Response): Promise<void> {
  try {
    const user = req.user!;
    const id = param(req, "id");
    if (!id || isInvalidObjectId(id)) {
      res.status(404).json({ error: "Kudos post not found" });
      return;
    }

    const kudos = await Kudos.findById(id);
    if (!kudos) {
      res.status(404).json({ error: "Kudos post not found" });
      return;
    }

    if (user.role !== "admin" && kudos.sender.toString() !== user._id.toString()) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    await Kudos.findByIdAndDelete(id);

    pushToAll(createEvent("kudos-new", { deletedId: id }));

    res.json({ message: "Kudos post deleted successfully" });
  } catch (error) {
    console.error("Delete kudos error:", error);
    res.status(500).json({ error: "Failed to delete kudos" });
  }
}
