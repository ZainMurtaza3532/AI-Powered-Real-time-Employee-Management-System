import type { Request, Response } from "express";
import mongoose from "mongoose";
import { logActivity } from "../lib/activityLog.js";
import { notifyBatch } from "../lib/notifications.js";
import { isDuplicateKeyError } from "../lib/errors.js";
import { parsePagination, searchRegex } from "../lib/pagination.js";
import { pushToUsers, createEvent } from "../lib/sse.js";
import { Announcement } from "../models/Announcement.js";
import type { IAnnouncement } from "../models/Announcement.js";
import { Department } from "../models/Department.js";

const AUTHOR_SELECT = "name";
const DEPARTMENT_SELECT = "name";

interface AnnouncementBody {
  title?: unknown;
  body?: unknown;
  department?: unknown;
}

function isInvalidObjectId(id: string): boolean {
  return !mongoose.isValidObjectId(id);
}

/** Express 5 types params as `string | string[] | undefined` — normalize to a single id. */
function paramId(req: Request): string | undefined {
  const id = req.params.id;
  return typeof id === "string" ? id : undefined;
}

async function getAnnouncementOr404(req: Request, res: Response): Promise<IAnnouncement | undefined> {
  const id = paramId(req);
  if (!id || isInvalidObjectId(id)) {
    res.status(404).json({ error: "Announcement not found" });
    return undefined;
  }
  const announcement = await Announcement.findById(id);
  if (!announcement) {
    res.status(404).json({ error: "Announcement not found" });
    return undefined;
  }
  return announcement;
}

/**
 * Any authenticated user: lists announcements they can see.
 * - Employee/head: their own department's announcements.
 * - Admin: every announcement.
 * Optional search (title/body) + pagination.
 */
export async function listAnnouncements(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const { limit, offset } = parsePagination(req);
  const search = searchRegex(req.query.search);

  const filter: Record<string, unknown> = {};
  if (user.role !== "admin") {
    if (!user.department) {
      res.json({ announcements: [], total: 0, limit, offset });
      return;
    }
    filter.department = user.department;
  }
  if (search) {
    filter.$or = [{ title: search }, { body: search }];
  }

  let query = Announcement.find(filter)
    .populate("author", AUTHOR_SELECT)
    .populate("department", DEPARTMENT_SELECT)
    .sort({ createdAt: -1 });
  if (limit !== null) {
    query = query.skip(offset).limit(limit);
  }

  const [announcements, total] = await Promise.all([query, Announcement.countDocuments(filter)]);
  res.json({ announcements: announcements.map((item) => item.toJSON()), total, limit, offset });
}

/** Head or admin: creates an announcement. Heads post to their own department; admins pick one. */
export async function createAnnouncement(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const { title, body, department } = (req.body ?? {}) as AnnouncementBody;

  if (typeof title !== "string" || !title.trim()) {
    res.status(400).json({ error: "title is required" });
    return;
  }
  if (typeof body !== "string" || !body.trim()) {
    res.status(400).json({ error: "body is required" });
    return;
  }

  let departmentId: mongoose.Types.ObjectId;
  if (user.role === "admin") {
    if (typeof department !== "string" || isInvalidObjectId(department)) {
      res.status(400).json({ error: "department must be a valid id" });
      return;
    }
    departmentId = new mongoose.Types.ObjectId(department);
  } else {
    // Heads post to their own department only — a head without one can't post.
    if (!user.department) {
      res.status(400).json({ error: "You must be assigned to a department to create announcements" });
      return;
    }
    departmentId = user.department;
  }

  const departmentDoc = await Department.findById(departmentId);
  if (!departmentDoc) {
    res.status(404).json({ error: "Department not found" });
    return;
  }

  const announcement = await Announcement.create({
    title: title.trim(),
    body: body.trim(),
    department: departmentId,
    author: user._id,
  });

  logActivity({
    action: "announcement_created",
    actor: user,
    targetType: "announcement",
    targetId: announcement._id,
    targetName: announcement.title,
    details: { department: departmentDoc.name },
    ip: req.ip,
  });

  // Notify all members of the department about the new announcement.
  // Import User here to avoid circular dependency issues at module level.
  const { User } = await import("../models/User.js");
  const departmentMembers = await User.find({ department: departmentId }).select("_id");
  const recipientIds = departmentMembers
    .map((member) => member._id)
    .filter((id) => !id.equals(user._id)); // Don't notify the author themselves.
  if (recipientIds.length > 0) {
    notifyBatch(recipientIds, {
      actor: user,
      type: "announcement_created",
      title: "New announcement",
      message: `A new announcement \"${announcement.title}\" has been posted in your department.`,
      link: "/announcements",
      data: {
        announcementTitle: announcement.title,
        announcementBody: announcement.body,
        departmentName: departmentDoc.name,
      },
    });

    // Real-time SSE push to department members
    pushToUsers(
      recipientIds.map((id) => id.toString()),
      createEvent("announcement-new", {
        announcementId: announcement._id,
        title: announcement.title,
        department: departmentDoc.name,
        author: user.name,
      })
    );
  }

  const populated = await announcement.populate([
    { path: "author", select: AUTHOR_SELECT },
    { path: "department", select: DEPARTMENT_SELECT },
  ]);
  res.status(201).json({ announcement: populated.toJSON() });
}

/** Head or admin: updates an announcement. Heads may only edit their own department's. */
export async function updateAnnouncement(req: Request, res: Response): Promise<void> {
  const announcement = await getAnnouncementOr404(req, res);
  if (!announcement) return;
  const user = req.user!;

  const { title, body, department } = (req.body ?? {}) as AnnouncementBody;

  const hasAnyField = title !== undefined || body !== undefined || department !== undefined;
  if (!hasAnyField) {
    res.status(400).json({ error: "At least one field to update is required" });
    return;
  }

  if (user.role !== "admin") {
    // Heads can only edit announcements in their own department.
    if (!user.department || !announcement.department.equals(user.department)) {
      res.status(403).json({ error: "You can only edit announcements in your own department" });
      return;
    }
    if (department !== undefined) {
      res.status(400).json({ error: "Heads cannot move an announcement to another department" });
      return;
    }
  }

  if (title !== undefined && (typeof title !== "string" || !title.trim())) {
    res.status(400).json({ error: "title is required" });
    return;
  }
  if (body !== undefined && (typeof body !== "string" || !body.trim())) {
    res.status(400).json({ error: "body is required" });
    return;
  }

  const changed: string[] = [];
  if (title !== undefined) {
    announcement.title = title.trim();
    changed.push("title");
  }
  if (body !== undefined) {
    announcement.body = body.trim();
    changed.push("body");
  }
  if (department !== undefined && user.role === "admin") {
    if (typeof department !== "string" || isInvalidObjectId(department)) {
      res.status(400).json({ error: "department must be a valid id" });
      return;
    }
    const departmentDoc = await Department.findById(department);
    if (!departmentDoc) {
      res.status(404).json({ error: "Department not found" });
      return;
    }
    announcement.department = new mongoose.Types.ObjectId(department);
    changed.push("department");
  }

  try {
    await announcement.save();
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      res.status(409).json({ error: "Duplicate value already exists" });
      return;
    }
    throw error;
  }

  logActivity({
    action: "announcement_updated",
    actor: user,
    targetType: "announcement",
    targetId: announcement._id,
    targetName: announcement.title,
    details: { changed },
    ip: req.ip,
  });

  // Real-time SSE push to department members
  const { User } = await import("../models/User.js");
  const departmentMembers = await User.find({ department: announcement.department }).select("_id");
  const recipientIds = departmentMembers
    .map((member) => member._id)
    .filter((id) => !id.equals(user._id));
  if (recipientIds.length > 0) {
    pushToUsers(
      recipientIds.map((id) => id.toString()),
      createEvent("announcement-new", {
        announcementId: announcement._id,
        title: announcement.title,
        action: "updated",
        author: user.name,
      })
    );
  }

  const populated = await announcement.populate([
    { path: "author", select: AUTHOR_SELECT },
    { path: "department", select: DEPARTMENT_SELECT },
  ]);
  res.json({ announcement: populated.toJSON() });
}

/** Admin-only: deletes an announcement (heads cannot delete — enforced here as well as in the route). */
export async function deleteAnnouncement(req: Request, res: Response): Promise<void> {
  const announcement = await getAnnouncementOr404(req, res);
  if (!announcement) return;
  const user = req.user!;

  if (user.role !== "admin") {
    res.status(403).json({ error: "Only admins can delete announcements" });
    return;
  }

  // Snapshot the target BEFORE removal so the audit trail stays meaningful.
  const deletedId = announcement._id;
  const deletedTitle = announcement.title;

  await announcement.deleteOne();

  logActivity({
    action: "announcement_deleted",
    actor: user,
    targetType: "announcement",
    targetId: deletedId,
    targetName: deletedTitle,
    ip: req.ip,
  });

  // Real-time SSE push to department members
  const { User } = await import("../models/User.js");
  const departmentMembers = await User.find({ department: announcement.department }).select("_id");
  const recipientIds = departmentMembers
    .map((member) => member._id)
    .filter((id) => !id.equals(user._id));
  if (recipientIds.length > 0) {
    pushToUsers(
      recipientIds.map((id) => id.toString()),
      createEvent("announcement-new", {
        announcementId: deletedId,
        title: deletedTitle,
        action: "deleted",
        author: user.name,
      })
    );
  }

  res.json({ message: "Announcement deleted" });
}

/**
 * AI Announcement Broadcast Composer & Tone Polisher.
 * Generates structured, high-engagement broadcasts with customized tone, key takeaways, and action items.
 */
export async function draftAnnouncementWithAI(req: Request, res: Response): Promise<void> {
  const { topic, tone = "professional", keyPoints = [], targetAudience = "All Team Members", departmentName } = req.body ?? {};

  if (!topic || typeof topic !== "string" || !topic.trim()) {
    res.status(400).json({ error: "topic is required" });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  let draftResult: {
    title: string;
    body: string;
    suggestedTags: string[];
    callout?: string;
  } | null = null;

  if (apiKey && !apiKey.startsWith("AQ.dummy")) {
    const models = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.0-flash"];
    const prompt = `You are an expert executive communications director and HR specialist.
Generate a polished, beautifully formatted corporate announcement broadcast based on the following input:

Topic: ${topic}
Tone: ${tone} (Options: professional, enthusiastic, policy, alert)
Key Points: ${keyPoints.length > 0 ? keyPoints.join("; ") : "Highlight relevant updates, next steps, and team context"}
Target Audience: ${targetAudience}
${departmentName ? `Department: ${departmentName}` : ""}

Return ONLY a valid JSON object matching this schema:
{
  "title": "Clear, compelling headline",
  "body": "Markdown formatted announcement body with clear paragraphs, bullet points, callout section, and action items / next steps",
  "suggestedTags": ["tag1", "tag2", "tag3"],
  "callout": "Short 1-sentence highlight or action deadline"
}`;

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0.3 },
          }),
        });

        if (resp.ok) {
          const json = (await resp.json()) as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
          };
          const raw = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.title && parsed.body) {
              draftResult = parsed;
              break;
            }
          }
        }
      } catch (err) {
        // Fallback to next model
      }
    }
  }

  // Fallback heuristic draft generation
  if (!draftResult) {
    const cleanTopic = topic.trim();
    const pointsFormatted = (Array.isArray(keyPoints) && keyPoints.length > 0
      ? keyPoints
      : ["Important operational updates and workflow guidelines", "Timeline and key milestone commitments", "Resource links and contact point for questions"]
    ).map((p: string) => `- ${p}`).join("\n");

    if (tone === "enthusiastic") {
      draftResult = {
        title: `🎉 Exciting Update: ${cleanTopic}`,
        body: `### Team Milestone & Celebration 🚀\n\nWe are thrilled to share an exciting milestone regarding **${cleanTopic}**!\n\n#### Key Highlights & Achievements\n${pointsFormatted}\n\n#### What This Means for Us\nEvery team member's dedication has been pivotal in reaching this benchmark. Let's continue this momentum and celebrate our collective success!\n\n> *Thank you all for your extraordinary energy, passion, and continuous innovation!*`,
        suggestedTags: ["Milestone", "Celebration", "TeamWin", "Recognition"],
        callout: "🎉 Celebrate with the team and share your thoughts in the comments!",
      };
    } else if (tone === "alert") {
      draftResult = {
        title: `🚨 URGENT ACTION REQUIRED: ${cleanTopic}`,
        body: `### ⚠️ High Priority Notification\n\nPlease review this urgent operational update regarding **${cleanTopic}** immediately.\n\n#### Critical Directives & Next Steps\n${pointsFormatted}\n\n#### Immediate Actions\n1. Review the affected systems or guidelines outlined above.\n2. Confirm completion or report any blockers to your department lead.\n3. Stay tuned for further operational advisories.\n\n> **Deadline**: Compliance is mandatory within 24 hours of this broadcast.`,
        suggestedTags: ["Urgent", "ActionRequired", "Operations", "Priority"],
        callout: "⚠️ Immediate review and compliance required by end of day.",
      };
    } else if (tone === "policy") {
      draftResult = {
        title: `📋 Policy Notice: ${cleanTopic}`,
        body: `### Official Policy & Procedural Update\n\nThis communication formalizes company-wide guidelines concerning **${cleanTopic}** for ${targetAudience}.\n\n#### Summary of Guidelines\n${pointsFormatted}\n\n#### Implementation & Compliance\n- These policies take effect immediately upon publication.\n- All team members are requested to review standard operating procedures.\n- Please reach out to HR or your department head for clarifications.\n\n> **Compliance Note**: Full adherence is required to maintain governance and operational integrity.`,
        suggestedTags: ["Policy", "Compliance", "HR", "Guidelines"],
        callout: "📋 Please review and acknowledge standard operating guidelines.",
      };
    } else {
      draftResult = {
        title: `📢 Company Update: ${cleanTopic}`,
        body: `### Executive & Team Briefing\n\nWe would like to provide an important update to all team members regarding **${cleanTopic}**.\n\n#### Key Updates\n${pointsFormatted}\n\n#### Next Steps\n- Team leads will review localized impact during upcoming weekly check-ins.\n- For any questions or feedback, please reach out directly through the Copilot portal.\n\nThank you for your ongoing commitment and dedication.`,
        suggestedTags: ["Announcement", "GeneralUpdate", "Organization"],
        callout: "📢 Please read through the full briefing and reach out with any questions.",
      };
    }
  }

  res.json({ draft: draftResult });
}

