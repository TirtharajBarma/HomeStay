import { Request, Response } from "express";
import mongoose from "mongoose";
import { Influencer } from "../models/influencer.model.js";
import { CollaborationRequest } from "../models/collaboration-request.model.js";
import { NotificationService } from "../services/notification.service.js";
import { logger } from "../utils/logger.js";

// Sample initial seeds for hill destinations if database is empty
export const SAMPLE_HILL_INFLUENCERS = [
  {
    name: "Rohan & Priyadarshini",
    tagline: "Himalayan Storytellers • Heritage & Offbeat Homestays",
    bio: "Full-time travel filmmakers documenting hidden mountain hamlets across Darjeeling, Kalimpong and Sikkim. Featured on Outlook Traveller and Tripoto.",
    profilePhoto: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80",
    instagramHandle: "@hillsandhomestays",
    instagramUrl: "https://instagram.com/hillsandhomestays",
    followersCount: 145000,
    averageViews: 220000,
    destinations: ["Darjeeling", "Kalimpong", "Kurseong", "Sikkim"],
    categories: ["Travel", "Homestay Reviews", "Himalayan Culture"],
    startingPrice: 6500,
    isVerified: true,
    isFeatured: true,
    isActive: true,
    packages: [
      {
        name: "Homestay Spotlight Reel",
        price: 6500,
        deliverables: "1 cinematic 4K Instagram Reel (60-90s) covering rooms, mountain view & food + 3 Stories with direct booking link.",
        turnaroundDays: 5,
      },
      {
        name: "Full Experience Showcase",
        price: 12000,
        deliverables: "2 High-production Reels, 5 High-res edited photos for host use, 5 Stories with pinned highlight & Homestay collaboration tag.",
        turnaroundDays: 7,
      },
      {
        name: "Weekend Takeover & YouTube Short",
        price: 18500,
        deliverables: "2 Dedicated Reels, 1 YouTube Short (30k+ views typical), complete host interview, story series & drone footage package.",
        turnaroundDays: 10,
      },
    ],
    sampleReels: [
      { title: "Waking up to Kanchenjunga in Kurseong", url: "https://instagram.com/reel/sample1" },
      { title: "Top 3 Hidden Tea Garden Homestays in Darjeeling", url: "https://instagram.com/reel/sample2" },
    ],
  },
  {
    name: "Ananya Sharma",
    tagline: "Solo Female Backpacker • Darjeeling & Sikkim Specialist",
    bio: "Explorer living between Gangtok and Darjeeling. Helps boutique homestays reach independent and female travelers across India with authentic visual stories.",
    profilePhoto: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80",
    instagramHandle: "@ananya_in_the_hills",
    instagramUrl: "https://instagram.com/ananya_in_the_hills",
    followersCount: 88000,
    averageViews: 110000,
    destinations: ["Darjeeling", "Gangtok", "Sikkim"],
    categories: ["Solo Travel", "Budget Stays", "Food"],
    startingPrice: 4500,
    isVerified: true,
    isFeatured: true,
    isActive: true,
    packages: [
      {
        name: "Viral Aesthetic Reel",
        price: 4500,
        deliverables: "1 Trending-audio aesthetic Reel highlighting cosy room vibes, hot tea & morning mountain scenery + 2 Stories.",
        turnaroundDays: 4,
      },
      {
        name: "Creator Weekend Visit",
        price: 8000,
        deliverables: "2 Reels + Story takeover during stay + Google Maps 5-star host review with professional photos.",
        turnaroundDays: 6,
      },
    ],
    sampleReels: [
      { title: "Hidden Cafe & Homestay in Upper Darjeeling", url: "https://instagram.com/reel/sample3" },
    ],
  },
  {
    name: "Tashi Bhutia",
    tagline: "Sikkim & Kalimpong Cultural Filmmaker • Drone Certified",
    bio: "Born and raised in Gangtok, capturing remote heritage homes, organic farm stays, and traditional Sikkim cuisine. Official tourism visual partner.",
    profilePhoto: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80",
    instagramHandle: "@tashi_himalayan",
    instagramUrl: "https://instagram.com/tashi_himalayan",
    followersCount: 112000,
    averageViews: 175000,
    destinations: ["Gangtok", "Sikkim", "Kalimpong"],
    categories: ["Culture & Heritage", "Cinematography", "Drone"],
    startingPrice: 7500,
    isVerified: true,
    isFeatured: false,
    isActive: true,
    packages: [
      {
        name: "Drone + Property Tour",
        price: 7500,
        deliverables: "1 Aerial 4K Reel showing valley approach, property exterior, garden and rooms + 4 Stories.",
        turnaroundDays: 6,
      },
      {
        name: "Full Heritage Story",
        price: 14000,
        deliverables: "2 Reels (Drone + Host story), raw drone b-roll clips delivered to host for their own marketing, 6 Stories.",
        turnaroundDays: 8,
      },
    ],
    sampleReels: [
      { title: "Drone view above foggy Kalimpong Ridge", url: "https://instagram.com/reel/sample4" },
    ],
  },
  {
    name: "Dev & Meghna",
    tagline: "Couple Travellers • Luxury & Cosy Mountain Escapes",
    bio: "Digital nomads sharing romantic mountain getaways, tea estate retreats, and cozy attic rooms across North Bengal and Sikkim.",
    profilePhoto: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=600&q=80",
    instagramHandle: "@roamwithdevmeg",
    instagramUrl: "https://instagram.com/roamwithdevmeg",
    followersCount: 65000,
    averageViews: 95000,
    destinations: ["Kurseong", "Darjeeling", "Kalimpong"],
    categories: ["Couples", "Luxury Stays", "Food & Dining"],
    startingPrice: 5000,
    isVerified: true,
    isFeatured: false,
    isActive: true,
    packages: [
      {
        name: "Couple Getaway Reel",
        price: 5000,
        deliverables: "1 Aesthetic couple reel enjoying morning breakfast with mountain view + 3 Stories.",
        turnaroundDays: 5,
      },
    ],
    sampleReels: [
      { title: "Cozy Wooden Attic Homestay in Kurseong", url: "https://instagram.com/reel/sample5" },
    ],
  },
];

export class InfluencerController {
  // GET /api/v1/influencers (Owner / Public)
  static async listPublic(req: Request, res: Response) {
    try {
      // Auto-seed if collection is completely empty
      const count = await Influencer.countDocuments();
      if (count === 0) {
        await Influencer.insertMany(SAMPLE_HILL_INFLUENCERS);
      }

      const { destination, search, featured, limit = 50, page = 1 } = req.query;

      const query: any = { isActive: true };

      if (destination && typeof destination === "string" && destination.trim() !== "All") {
        query.destinations = { $in: [new RegExp(`^${destination.trim()}$`, "i")] };
      }

      if (featured === "true") {
        query.isFeatured = true;
      }

      if (search && typeof search === "string" && search.trim()) {
        const s = search.trim();
        query.$or = [
          { name: { $regex: s, $options: "i" } },
          { tagline: { $regex: s, $options: "i" } },
          { instagramHandle: { $regex: s, $options: "i" } },
          { destinations: { $in: [new RegExp(s, "i")] } },
        ];
      }

      const skip = (Math.max(1, Number(page)) - 1) * Math.min(100, Number(limit));
      const influencers = await Influencer.find(query)
        .sort({ isFeatured: -1, followersCount: -1, createdAt: -1 })
        .skip(skip)
        .limit(Math.min(100, Number(limit)));

      const total = await Influencer.countDocuments(query);

      res.json({
        success: true,
        data: influencers,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (err: any) {
      logger.error("Error listing influencers:", err);
      res.status(500).json({ success: false, error: err.message || "Failed to fetch influencers" });
    }
  }

  // GET /api/v1/influencers/:id
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

  // POST /api/v1/collaboration-requests (Owner submits request)
  static async submitCollaborationRequest(req: Request, res: Response) {
    try {
      const {
        requestType = "INFLUENCER_COLLABORATION",
        budget,
        preferredDestination,
        promotionRequirements,
        additionalMessage,
        influencerId,
        homestayName,
        homestayLocation,
        homestayId,
        ownerName,
        ownerPhone,
        ownerEmail,
        selectedPackage,
        customRequirements,
        proposedDates,
        tenantKey,
      } = req.body;

      if (!homestayName || !homestayName.trim()) {
        return res.status(400).json({ success: false, error: "Homestay name is required" });
      }

      if (!ownerName || !ownerName.trim()) {
        return res.status(400).json({ success: false, error: "Owner name is required" });
      }

      const cleanPhone = (ownerPhone || "").replace(/\D/g, "").slice(-10);
      if (!cleanPhone || cleanPhone.length < 10) {
        return res.status(400).json({ success: false, error: "Valid 10-digit WhatsApp phone number is required" });
      }

      // Handle Budget-Based Promotion Request
      if (requestType === "BUDGET_BASED_PROMOTION") {
        const numBudget = Number(budget);
        if (isNaN(numBudget) || numBudget <= 0) {
          return res.status(400).json({
            success: false,
            error: "Please enter a valid promotion budget in INR greater than zero",
          });
        }

        const request = await CollaborationRequest.create({
          requestType: "BUDGET_BASED_PROMOTION",
          budget: numBudget,
          preferredDestination: preferredDestination?.trim() || "",
          promotionRequirements: promotionRequirements?.trim() || "",
          additionalMessage: additionalMessage?.trim() || "",
          tenantKey: tenantKey || (req as any).user?.tenantKey || "",
          ownerId: (req as any).user?.id || "",
          homestayId: homestayId || "",
          homestayName: homestayName.trim(),
          homestayLocation: homestayLocation || "",
          ownerName: ownerName.trim(),
          ownerPhone: cleanPhone,
          ownerEmail: ownerEmail?.trim() || "",
          status: "NEW",
          statusHistory: [
            {
              status: "NEW",
              updatedAt: new Date(),
              note: `Budget-based promotion request of ₹${numBudget.toLocaleString()} submitted by owner.`,
              updatedBy: ownerName.trim(),
            },
          ],
        });

        // Notify admin
        try {
          logger.info(
            `[BUDGET_PROMOTION_REQUEST] ${homestayName.trim()} submitted budget of ₹${numBudget} for ${preferredDestination || "homestay"}. RequestId: ${request.requestId} (_id: ${request._id})`
          );
        } catch (notifyErr: any) {
          logger.warn("Admin notification warning:", notifyErr?.message || String(notifyErr));
        }

        return res.status(201).json({
          success: true,
          message:
            "Your promotion request has been submitted! Our StayCabs team will find suitable influencers within your budget and contact you.",
          data: request,
        });
      }

      // Handle Direct Influencer Collaboration Request
      if (!influencerId || !mongoose.Types.ObjectId.isValid(influencerId)) {
        return res.status(400).json({ success: false, error: "Valid influencer ID is required" });
      }

      const influencer = await Influencer.findById(influencerId);
      if (!influencer) {
        return res.status(404).json({ success: false, error: "Influencer not found" });
      }

      const request = await CollaborationRequest.create({
        requestType: "INFLUENCER_COLLABORATION",
        influencerId: influencer._id,
        influencerName: influencer.name,
        influencerHandle: influencer.instagramHandle,
        influencerPhoto: influencer.profilePhoto,
        tenantKey: tenantKey || (req as any).user?.tenantKey || "",
        ownerId: (req as any).user?.id || "",
        homestayId: homestayId || "",
        homestayName: homestayName.trim(),
        homestayLocation: homestayLocation || "",
        ownerName: ownerName.trim(),
        ownerPhone: cleanPhone,
        ownerEmail: ownerEmail?.trim() || "",
        selectedPackage: selectedPackage || {
          name: influencer.packages?.[0]?.name || "Standard Promotion",
          price: influencer.packages?.[0]?.price || influencer.startingPrice,
          deliverables: influencer.packages?.[0]?.deliverables || "",
        },
        customRequirements: customRequirements?.trim() || "",
        proposedDates: proposedDates?.trim() || "",
        status: "NEW",
        statusHistory: [
          {
            status: "NEW",
            updatedAt: new Date(),
            note: "Collaboration request submitted by homestay owner.",
            updatedBy: ownerName.trim(),
          },
        ],
      });

      // Notify admin
      try {
        logger.info(
          `[COLLABORATION_REQUEST] ${homestayName.trim()} invited ${influencer.name} (${influencer.instagramHandle}) for collaboration. RequestId: ${request.requestId} (_id: ${request._id})`
        );
      } catch (notifyErr: any) {
        logger.warn("Admin notification warning:", notifyErr?.message || String(notifyErr));
      }

      return res.status(201).json({
        success: true,
        message: "Collaboration request submitted successfully. StayCabs team will contact you shortly.",
        data: request,
      });
    } catch (err: any) {
      logger.error("Error creating collaboration request:", err);
      return res.status(500).json({ success: false, error: err.message || "Failed to submit request" });
    }
  }

  // GET /api/v1/collaboration-requests/my (Owner's submitted requests)
  static async getMyCollaborationRequests(req: Request, res: Response) {
    try {
      const { phone, tenantKey } = req.query;
      const user = (req as any).user;

      const query: any = {};
      const conditions: any[] = [];

      if (user?.id) conditions.push({ ownerId: user.id });
      if (user?.tenantKey) conditions.push({ tenantKey: user.tenantKey });
      if (tenantKey && typeof tenantKey === "string") conditions.push({ tenantKey });
      if (phone && typeof phone === "string") {
        const clean = phone.replace(/\D/g, "").slice(-10);
        if (clean) conditions.push({ ownerPhone: clean });
      }

      if (conditions.length > 0) {
        query.$or = conditions;
      }

      const requests = await CollaborationRequest.find(query)
        .sort({ createdAt: -1 })
        .limit(100);

      res.json({ success: true, count: requests.length, data: requests });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || "Failed to fetch requests" });
    }
  }

  // GET /api/v1/collaboration-requests/:id
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
}
