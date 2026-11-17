import { Request, Response } from "express";
import mongoose from "mongoose";
import { Influencer } from "../models/influencer.model.js";
import { CollaborationRequest } from "../models/collaboration-request.model.js";
import { logger } from "../utils/logger.js";

export class InfluencerAdminController {
  // GET /api/v1/admin/influencers
  static async list(req: Request, res: Response) {
    try {
      const { search, destination, active, featured, page = 1, limit = 50 } = req.query;

      const query: any = {};

      if (active === "true") query.isActive = true;
      if (active === "false") query.isActive = false;

      if (featured === "true") query.isFeatured = true;

      if (destination && typeof destination === "string" && destination.trim() !== "All") {
        query.destinations = { $in: [new RegExp(`^${destination.trim()}$`, "i")] };
      }

      if (search && typeof search === "string" && search.trim()) {
        const s = search.trim();
        query.$or = [
          { name: { $regex: s, $options: "i" } },
          { instagramHandle: { $regex: s, $options: "i" } },
          { tagline: { $regex: s, $options: "i" } },
          { destinations: { $in: [new RegExp(s, "i")] } },
        ];
      }

      const skip = (Math.max(1, Number(page)) - 1) * Math.min(100, Number(limit));

      const [influencers, total, totalActive, totalFeatured] = await Promise.all([
        Influencer.find(query)
          .sort({ isFeatured: -1, createdAt: -1 })
          .skip(skip)
          .limit(Math.min(100, Number(limit))),
        Influencer.countDocuments(query),
        Influencer.countDocuments({ isActive: true }),
        Influencer.countDocuments({ isFeatured: true }),
      ]);

      res.json({
        success: true,
        data: influencers,
        stats: {
          total,
          active: totalActive,
          featured: totalFeatured,
        },
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (err: any) {
      logger.error("Admin list influencers error:", err);
      res.status(500).json({ success: false, error: err.message || "Failed to list influencers" });
    }
  }

  // GET /api/v1/admin/influencers/:id
  static async getById(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, error: "Invalid influencer ID" });
      }

      const influencer = await Influencer.findById(id);
      if (!influencer) {
        return res.status(404).json({ success: false, error: "Influencer not found" });
      }

      res.json({ success: true, data: influencer });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || "Failed to load influencer" });
    }
  }

  // POST /api/v1/admin/influencers
  static async create(req: Request, res: Response) {
    try {
      const {
        name,
        tagline,
        bio,
        profilePhoto,
        instagramHandle,
        instagramUrl,
        followersCount,
        averageViews,
        destinations,
        categories,
        startingPrice,
        packages,
        sampleReels,
        isVerified = true,
        isFeatured = false,
        isActive = true,
        contactPhone,
        contactEmail,
        adminNotes,
      } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, error: "Influencer name is required" });
      }

      if (!instagramHandle || !instagramHandle.trim()) {
        return res.status(400).json({ success: false, error: "Instagram handle is required" });
      }

      // Auto-normalize instagram handle and url
      const handle = instagramHandle.trim().startsWith("@")
        ? instagramHandle.trim()
        : `@${instagramHandle.trim()}`;

      const url =
        instagramUrl && instagramUrl.trim()
          ? instagramUrl.trim()
          : `https://instagram.com/${handle.replace("@", "")}`;

      // Normalize destinations
      let destArray: string[] = [];
      if (Array.isArray(destinations)) {
        destArray = destinations.filter(Boolean);
      } else if (typeof destinations === "string") {
        destArray = destinations.split(",").map((d) => d.trim()).filter(Boolean);
      }
      if (destArray.length === 0) destArray = ["Darjeeling"];

      // Sanitize sample reels (only keep entries with non-empty url)
      const cleanReels = Array.isArray(sampleReels)
        ? sampleReels
            .filter((r) => r && typeof r.url === "string" && r.url.trim().length > 0)
            .map((r) => ({
              title: typeof r.title === "string" && r.title.trim() ? r.title.trim() : "Sample Reel",
              url: r.url.trim(),
            }))
        : [];

      const influencer = await Influencer.create({
        name: name.trim(),
        tagline: tagline?.trim() || "",
        bio: bio?.trim() || "",
        profilePhoto: profilePhoto?.trim() || "",
        instagramHandle: handle,
        instagramUrl: url,
        followersCount: Number(followersCount) || 0,
        averageViews: Number(averageViews) || 0,
        destinations: destArray,
        categories: Array.isArray(categories) ? categories : ["Travel"],
        startingPrice: Number(startingPrice) || 0,
        packages: Array.isArray(packages) ? packages : [],
        sampleReels: cleanReels,
        isVerified: Boolean(isVerified),
        isFeatured: Boolean(isFeatured),
        isActive: Boolean(isActive),
        contactPhone: contactPhone?.trim() || "",
        contactEmail: contactEmail?.trim() || "",
        adminNotes: adminNotes?.trim() || "",
      });

      res.status(201).json({
        success: true,
        message: "Influencer added successfully",
        data: influencer,
      });
    } catch (err: any) {
      logger.error("Admin create influencer error:", err);
      res.status(500).json({ success: false, error: err.message || "Failed to create influencer" });
    }
  }

  // PUT /api/v1/admin/influencers/:id
  static async update(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, error: "Invalid influencer ID" });
      }

      const updates: any = { ...req.body };

      if (updates.instagramHandle) {
        updates.instagramHandle = updates.instagramHandle.trim().startsWith("@")
          ? updates.instagramHandle.trim()
          : `@${updates.instagramHandle.trim()}`;
      }

      if (updates.destinations && typeof updates.destinations === "string") {
        updates.destinations = updates.destinations.split(",").map((d: string) => d.trim()).filter(Boolean);
      }

      if (updates.sampleReels && Array.isArray(updates.sampleReels)) {
        updates.sampleReels = updates.sampleReels
          .filter((r: any) => r && typeof r.url === "string" && r.url.trim().length > 0)
          .map((r: any) => ({
            title: typeof r.title === "string" && r.title.trim() ? r.title.trim() : "Sample Reel",
            url: r.url.trim(),
          }));
      }

      const influencer = await Influencer.findByIdAndUpdate(id, updates, {
        new: true,
        runValidators: true,
      });

      if (!influencer) {
        return res.status(404).json({ success: false, error: "Influencer not found" });
      }

      res.json({
        success: true,
        message: "Influencer updated successfully",
        data: influencer,
      });
    } catch (err: any) {
      logger.error("Admin update influencer error:", err);
      res.status(500).json({ success: false, error: err.message || "Failed to update influencer" });
    }
  }

  // PATCH /api/v1/admin/influencers/:id/toggle-status
  static async toggleStatus(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, error: "Invalid influencer ID" });
      }

      const influencer = await Influencer.findById(id);
      if (!influencer) {
        return res.status(404).json({ success: false, error: "Influencer not found" });
      }

      influencer.isActive = !influencer.isActive;
      await influencer.save();

      res.json({
        success: true,
        message: `Influencer ${influencer.isActive ? "activated" : "deactivated"} successfully`,
        data: influencer,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || "Failed to toggle status" });
    }
  }

  // DELETE /api/v1/admin/influencers/:id
  static async delete(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, error: "Invalid influencer ID" });
      }

      const influencer = await Influencer.findByIdAndDelete(id);
      if (!influencer) {
        return res.status(404).json({ success: false, error: "Influencer not found" });
      }

      res.json({ success: true, message: "Influencer removed successfully" });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || "Failed to delete influencer" });
    }
  }

  // GET /api/v1/admin/collaboration-requests
  static async listCollaborationRequests(req: Request, res: Response) {
    try {
      const { status, search, influencerId, requestType, page = 1, limit = 50 } = req.query;

      const query: any = {};

      if (status && typeof status === "string" && status.trim() !== "ALL") {
        query.status = status.trim().toUpperCase();
      }

      if (requestType && typeof requestType === "string" && requestType.trim() !== "ALL") {
        query.requestType = requestType.trim().toUpperCase();
      }

      if (influencerId && typeof influencerId === "string" && mongoose.Types.ObjectId.isValid(influencerId)) {
        query.influencerId = influencerId;
      }

      if (search && typeof search === "string" && search.trim()) {
        const s = search.trim();
        query.$or = [
          { requestId: { $regex: s, $options: "i" } },
          { homestayName: { $regex: s, $options: "i" } },
          { homestayLocation: { $regex: s, $options: "i" } },
          { ownerName: { $regex: s, $options: "i" } },
          { ownerPhone: { $regex: s, $options: "i" } },
          { influencerName: { $regex: s, $options: "i" } },
          { influencerHandle: { $regex: s, $options: "i" } },
          { preferredDestination: { $regex: s, $options: "i" } },
          { promotionRequirements: { $regex: s, $options: "i" } },
        ];
      }

      const skip = (Math.max(1, Number(page)) - 1) * Math.min(100, Number(limit));

      const [requests, total, pendingCount, newCount, confirmedCount, budgetCount] = await Promise.all([
        CollaborationRequest.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(Math.min(100, Number(limit))),
        CollaborationRequest.countDocuments(query),
        CollaborationRequest.countDocuments({ status: "PENDING" }),
        CollaborationRequest.countDocuments({ status: "NEW" }),
        CollaborationRequest.countDocuments({ status: "CONFIRMED" }),
        CollaborationRequest.countDocuments({ requestType: "BUDGET_BASED_PROMOTION" }),
      ]);

      res.json({
        success: true,
        data: requests,
        stats: {
          total,
          pending: pendingCount,
          new: newCount,
          confirmed: confirmedCount,
          budgetRequests: budgetCount,
        },
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (err: any) {
      logger.error("Admin list collaboration requests error:", err);
      res.status(500).json({ success: false, error: err.message || "Failed to list requests" });
    }
  }

  // GET /api/v1/admin/collaboration-requests/stats
  static async getCollaborationStats(_req: Request, res: Response) {
    try {
      const [total, pending, contacted, inNegotiation, confirmed, completed, cancelled] =
        await Promise.all([
          CollaborationRequest.countDocuments(),
          CollaborationRequest.countDocuments({ status: "PENDING" }),
          CollaborationRequest.countDocuments({ status: "CONTACTED" }),
          CollaborationRequest.countDocuments({ status: "IN_NEGOTIATION" }),
          CollaborationRequest.countDocuments({ status: "CONFIRMED" }),
          CollaborationRequest.countDocuments({ status: "COMPLETED" }),
          CollaborationRequest.countDocuments({ status: "CANCELLED" }),
        ]);

      res.json({
        success: true,
        data: {
          total,
          pending,
          contacted,
          inNegotiation,
          confirmed,
          completed,
          cancelled,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || "Failed to get stats" });
    }
  }

  // GET /api/v1/admin/collaboration-requests/:id
  static async getCollaborationRequestById(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, error: "Invalid request ID" });
      }

      const request = await CollaborationRequest.findById(id).populate("influencerId");
      if (!request) {
        return res.status(404).json({ success: false, error: "Request not found" });
      }

      res.json({ success: true, data: request });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || "Failed to load request" });
    }
  }

  // PATCH /api/v1/admin/collaboration-requests/:id/status
  static async updateCollaborationStatus(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, error: "Invalid request ID" });
      }

      const {
        status,
        adminNotes,
        negotiatedPrice,
        confirmedShootingDate,
        deliveredPostUrl,
        statusNote,
        assignedInfluencerId,
        assignedInfluencerName,
        agreedPrice,
      } = req.body;

      const request = await CollaborationRequest.findById(id);
      if (!request) {
        return res.status(404).json({ success: false, error: "Request not found" });
      }

      const oldStatus = request.status;
      if (status) request.status = status;
      if (adminNotes !== undefined) request.adminNotes = adminNotes;
      if (negotiatedPrice !== undefined) request.negotiatedPrice = Number(negotiatedPrice);
      if (confirmedShootingDate !== undefined) request.confirmedShootingDate = confirmedShootingDate;
      if (deliveredPostUrl !== undefined) request.deliveredPostUrl = deliveredPostUrl;
      if (agreedPrice !== undefined) request.agreedPrice = Number(agreedPrice);
      if (assignedInfluencerName !== undefined) request.assignedInfluencerName = assignedInfluencerName;
      if (assignedInfluencerId !== undefined) {
        request.assignedInfluencerId = assignedInfluencerId || undefined;
        if (assignedInfluencerId && mongoose.Types.ObjectId.isValid(assignedInfluencerId)) {
          const inf = await Influencer.findById(assignedInfluencerId);
          if (inf) {
            request.assignedInfluencerName = inf.name;
          }
        }
      }

      // Add status change entry to history
      if (status && status !== oldStatus) {
        request.statusHistory.push({
          status,
          updatedAt: new Date(),
          note: statusNote || `Status changed from ${oldStatus} to ${status} by admin.`,
          updatedBy: (req as any).user?.name || "Admin",
        });
      }

      await request.save();

      res.json({
        success: true,
        message: "Collaboration status updated successfully",
        data: request,
      });
    } catch (err: any) {
      logger.error("Admin update collaboration status error:", err);
      res.status(500).json({ success: false, error: err.message || "Failed to update status" });
    }
  }
}
