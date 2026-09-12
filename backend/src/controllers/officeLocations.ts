import type { Request, Response } from "express";
import mongoose from "mongoose";
import { logActivity } from "../lib/activityLog.js";
import { isDuplicateKeyError } from "../lib/errors.js";
import { getIpAddress, normalizeIp } from "../lib/getIpAddress.js";
import { parsePagination, searchRegex } from "../lib/pagination.js";
import { OfficeLocation } from "../models/OfficeLocation.js";

interface OfficeLocationBody {
  branchName?: string;
  ipAddresses?: string[] | string;
  isActive?: boolean;
  address?: string;
}

function isInvalidObjectId(id: string): boolean {
  return !mongoose.isValidObjectId(id);
}

function paramId(req: Request): string | undefined {
  const id = req.params.id;
  return typeof id === "string" ? id : undefined;
}

function sanitizeIpList(raw: string[] | string | undefined): string[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : raw.split(",");
  return list
    .map((ip) => normalizeIp(ip))
    .filter((ip) => ip.length > 0 && ip !== "127.0.0.1");
}

/**
 * GET /api/office-locations
 * Admin-only: Retrieves list of office branch locations with IP whitelists.
 */
export async function getAllOfficeLocations(req: Request, res: Response): Promise<void> {
  const { search, q, isActive } = req.query;
  const searchTerm = typeof search === "string" ? search : typeof q === "string" ? q : "";
  const filter: Record<string, unknown> = {};

  if (searchTerm.trim()) {
    filter.branchName = searchRegex(searchTerm);
  }

  if (typeof isActive === "string") {
    filter.isActive = isActive === "true";
  }

  const { limit, offset } = parsePagination(req);

  const [officeLocations, total] = await Promise.all([
    OfficeLocation.find(filter)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit || 100),
    OfficeLocation.countDocuments(filter),
  ]);

  res.json({
    officeLocations: officeLocations.map((loc) => loc.toJSON()),
    total,
    limit,
    offset,
  });
}

/**
 * GET /api/office-locations/my-ip
 * Utility endpoint for admins to inspect their current detected public IP address.
 */
export async function getMyIp(req: Request, res: Response): Promise<void> {
  const clientIp = getIpAddress(req);

  // Check if this IP is already whitelisted in any active branch
  const activeLocations = await OfficeLocation.find({ isActive: true });
  const matchedBranch = activeLocations.find((loc) =>
    loc.ipAddresses.some((whitelisted) => normalizeIp(whitelisted) === clientIp)
  );

  res.json({
    ip: clientIp,
    isWhitelisted: Boolean(matchedBranch),
    branchName: matchedBranch?.branchName ?? null,
  });
}

/**
 * GET /api/office-locations/:id
 * Admin-only: Retrieves a single office branch by ID.
 */
export async function getOfficeLocationById(req: Request, res: Response): Promise<void> {
  const id = paramId(req);
  if (!id || isInvalidObjectId(id)) {
    res.status(404).json({ error: "Office location not found" });
    return;
  }

  const location = await OfficeLocation.findById(id);
  if (!location) {
    res.status(404).json({ error: "Office location not found" });
    return;
  }

  res.json({ officeLocation: location.toJSON() });
}

/**
 * POST /api/office-locations
 * Admin-only: Creates a new office branch location with an IP whitelist array.
 */
export async function createOfficeLocation(req: Request, res: Response): Promise<void> {
  const { branchName, ipAddresses, isActive, address } = (req.body ?? {}) as OfficeLocationBody;

  if (!branchName || !branchName.trim()) {
    res.status(400).json({ error: "branchName is required" });
    return;
  }

  // Parse and clean array of IPs
  let cleanedIps: string[] = [];
  if (Array.isArray(ipAddresses)) {
    cleanedIps = ipAddresses
      .map((ip) => (typeof ip === "string" ? normalizeIp(ip) : ""))
      .filter(Boolean);
  } else if (typeof ipAddresses === "string" && ipAddresses.trim()) {
    cleanedIps = ipAddresses
      .split(",")
      .map((ip) => normalizeIp(ip))
      .filter(Boolean);
  }

  // Deduplicate IPs
  cleanedIps = Array.from(new Set(cleanedIps));

  try {
    const location = await OfficeLocation.create({
      branchName: branchName.trim(),
      ipAddresses: cleanedIps,
      isActive: typeof isActive === "boolean" ? isActive : true,
      address: address?.trim() || undefined,
    });

    logActivity({
      action: "department_created", // Or generic entity created
      actor: req.user,
      targetType: "department",
      targetId: location._id,
      targetName: `Office Location: ${location.branchName}`,
      details: {
        branchName: location.branchName,
        ipAddressesCount: location.ipAddresses.length,
        isActive: location.isActive,
      },
      ip: getIpAddress(req),
    });

    res.status(201).json({
      message: "Office branch location created successfully",
      officeLocation: location.toJSON(),
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      res.status(409).json({ error: "An office location with this branch name already exists" });
      return;
    }
    console.error("Create office location error:", error);
    res.status(500).json({ error: "Failed to create office location" });
  }
}

/**
 * PUT /api/office-locations/:id or PATCH /api/office-locations/:id
 * Admin-only: Updates branch name, IP list, or active status.
 */
export async function updateOfficeLocation(req: Request, res: Response): Promise<void> {
  const id = paramId(req);
  if (!id || isInvalidObjectId(id)) {
    res.status(404).json({ error: "Office location not found" });
    return;
  }

  const { branchName, ipAddresses, isActive, address } = (req.body ?? {}) as OfficeLocationBody;

  const location = await OfficeLocation.findById(id);
  if (!location) {
    res.status(404).json({ error: "Office location not found" });
    return;
  }

  if (typeof branchName === "string" && branchName.trim()) {
    location.branchName = branchName.trim();
  }

  if (ipAddresses !== undefined) {
    let cleanedIps: string[] = [];
    if (Array.isArray(ipAddresses)) {
      cleanedIps = ipAddresses
        .map((ip) => (typeof ip === "string" ? normalizeIp(ip) : ""))
        .filter(Boolean);
    } else if (typeof ipAddresses === "string") {
      cleanedIps = ipAddresses
        .split(",")
        .map((ip) => normalizeIp(ip))
        .filter(Boolean);
    }
    location.ipAddresses = Array.from(new Set(cleanedIps));
  }

  if (typeof isActive === "boolean") {
    location.isActive = isActive;
  }

  if (typeof address === "string") {
    location.address = address.trim() || undefined;
  }

  try {
    await location.save();

    logActivity({
      action: "department_updated",
      actor: req.user,
      targetType: "department",
      targetId: location._id,
      targetName: `Office Location: ${location.branchName}`,
      details: {
        branchName: location.branchName,
        ipAddressesCount: location.ipAddresses.length,
        isActive: location.isActive,
      },
      ip: getIpAddress(req),
    });

    res.json({
      message: "Office branch location updated successfully",
      officeLocation: location.toJSON(),
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      res.status(409).json({ error: "An office location with this branch name already exists" });
      return;
    }
    console.error("Update office location error:", error);
    res.status(500).json({ error: "Failed to update office location" });
  }
}

/**
 * DELETE /api/office-locations/:id
 * Admin-only: Deletes an office location and its IP whitelist.
 */
export async function deleteOfficeLocation(req: Request, res: Response): Promise<void> {
  const id = paramId(req);
  if (!id || isInvalidObjectId(id)) {
    res.status(404).json({ error: "Office location not found" });
    return;
  }

  const location = await OfficeLocation.findByIdAndDelete(id);
  if (!location) {
    res.status(404).json({ error: "Office location not found" });
    return;
  }

  logActivity({
    action: "department_deleted",
    actor: req.user,
    targetType: "department",
    targetId: location._id,
    targetName: `Office Location: ${location.branchName}`,
    details: { branchName: location.branchName },
    ip: getIpAddress(req),
  });

  res.json({
    message: `Office location '${location.branchName}' deleted successfully`,
  });
}
