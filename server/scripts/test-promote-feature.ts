import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { Influencer } from "../src/models/influencer.model.js";
import { CollaborationRequest } from "../src/models/collaboration-request.model.js";
import { SAMPLE_HILL_INFLUENCERS } from "../src/controllers/influencer.controller.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  "mongodb://localhost:27017/homestay_db";

async function runTest() {
  console.log("=== Testing Promote & Influencer Feature Integration ===");
  console.log("Connecting to Mongo:", MONGO_URI);
  await mongoose.connect(MONGO_URI);
  console.log("✓ Connected to MongoDB");

  // Step 1: Ensure initial sample hill creators exist
  const existingCount = await Influencer.countDocuments();
  if (existingCount === 0) {
    await Influencer.insertMany(SAMPLE_HILL_INFLUENCERS);
    console.log(`✓ Seeded ${SAMPLE_HILL_INFLUENCERS.length} initial mountain influencers`);
  } else {
    console.log(`✓ Influencers already present in DB (${existingCount} total)`);
  }

  // Step 2: Test Admin Adding a New Influencer
  console.log("\n--- Step 2: Admin Creates New Influencer ---");
  const testHandle = `@test_hill_creator_${Date.now()}`;
  const newInfluencer = await Influencer.create({
    name: "Aakash Pradhan",
    tagline: "Drone Filmmaker & Tea Garden Stays Explorer",
    bio: "Visual storyteller based in Kurseong covering mountain retreats.",
    profilePhoto: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d",
    instagramHandle: testHandle,
    instagramUrl: `https://instagram.com/${testHandle.replace("@", "")}`,
    followersCount: 95000,
    averageViews: 140000,
    destinations: ["Kurseong", "Darjeeling", "Mirik"],
    categories: ["Travel", "Homestays", "Drone"],
    startingPrice: 6000,
    packages: [
      {
        name: "1 4K Reel + 3 Stories",
        price: 6000,
        deliverables: "High-production Reel featuring property & host story + 3 Stories",
        turnaroundDays: 5,
      },
      {
        name: "Full Drone & Property Showcase",
        price: 11000,
        deliverables: "2 Cinematic Reels (with FPV drone) + Photo series",
        turnaroundDays: 7,
      },
    ],
    sampleReels: [{ title: "Morning mist in Kurseong", url: "https://instagram.com/reel/sample" }],
    isVerified: true,
    isFeatured: true,
    isActive: true,
    contactPhone: "9876543210",
    contactEmail: "aakash@hills.com",
    adminNotes: "Reliable creator, shoots on Sony A7SIII.",
  });
  console.log(`✓ Influencer created successfully: ${newInfluencer.name} (${newInfluencer.instagramHandle}) [ID: ${newInfluencer._id}]`);

  // Step 3: Test Owner Filtering by Destination (e.g. Kurseong)
  console.log("\n--- Step 3: Owner Explores Influencers by Destination ---");
  const kurseongCreators = await Influencer.find({
    isActive: true,
    destinations: { $in: [new RegExp("^Kurseong$", "i")] },
  });
  console.log(`✓ Found ${kurseongCreators.length} creators covering Kurseong:`);
  kurseongCreators.forEach((c) => {
    console.log(`   - ${c.name} (${c.instagramHandle}): Starting ₹${c.startingPrice}, Followers: ${c.followersCount}`);
  });
  if (!kurseongCreators.some((c) => c._id.equals(newInfluencer._id))) {
    throw new Error("Created influencer not found in destination search!");
  }

  // Step 4: Test Owner Submitting Collaboration Request
  console.log("\n--- Step 4: Owner Submits Collaboration Request ---");
  const testPhone = "9832012345";
  const testHomestayName = "Cloud Mist Homestay Kurseong";
  const newCollab = await CollaborationRequest.create({
    influencerId: newInfluencer._id,
    influencerName: newInfluencer.name,
    influencerHandle: newInfluencer.instagramHandle,
    influencerPhoto: newInfluencer.profilePhoto,
    tenantKey: "demo-tenant-kurseong",
    homestayName: testHomestayName,
    homestayLocation: "Dowhill, Kurseong",
    ownerName: "Dawa Lepcha",
    ownerPhone: testPhone,
    ownerEmail: "dawa@cloudmisthomestay.com",
    selectedPackage: newInfluencer.packages[0],
    customRequirements: "We have an attic balcony with 180° tea garden views. Please highlight our home-cooked momos.",
    proposedDates: "Dec 18 - Dec 20, 2026",
    status: "PENDING",
    statusHistory: [
      {
        status: "PENDING",
        updatedAt: new Date(),
        note: "Request submitted by homestay host.",
        updatedBy: "Dawa Lepcha",
      },
    ],
  });
  console.log(`✓ Collaboration Request created: ID: ${newCollab._id}, Status: ${newCollab.status}`);

  // Step 5: Test Admin Viewing Collaboration Requests
  console.log("\n--- Step 5: Admin Views Collaboration Queue ---");
  const adminPendingRequests = await CollaborationRequest.find({ status: "PENDING" }).sort({ createdAt: -1 });
  console.log(`✓ Admin sees ${adminPendingRequests.length} pending collaboration requests in panel`);
  const foundInQueue = adminPendingRequests.find((r) => r._id.equals(newCollab._id));
  if (!foundInQueue) throw new Error("Created collaboration request not found in admin queue!");
  console.log(`✓ Found request in queue: ${foundInQueue.homestayName} inviting ${foundInQueue.influencerName}`);

  // Step 6: Test Admin Contacting & Updating Status to CONFIRMED
  console.log("\n--- Step 6: Admin Updates Status to Shoot Confirmed ---");
  foundInQueue.status = "CONFIRMED";
  foundInQueue.confirmedShootingDate = "18-20 Dec 2026";
  foundInQueue.negotiatedPrice = 5500;
  foundInQueue.adminNotes = "Spoke with Dawa (host) and Aakash (creator). Shoot locked for 18th Dec. 2 nights stay provided.";
  foundInQueue.statusHistory.push({
    status: "CONFIRMED",
    updatedAt: new Date(),
    note: "Dates confirmed with creator and owner.",
    updatedBy: "Admin",
  });
  await foundInQueue.save();
  console.log(`✓ Status updated to: ${foundInQueue.status}, Confirmed Date: ${foundInQueue.confirmedShootingDate}`);

  // Step 7: Test Owner Tracking Their Request
  console.log("\n--- Step 7: Owner App Tracks Request Status ---");
  const ownerRequests = await CollaborationRequest.find({ ownerPhone: testPhone });
  console.log(`✓ Owner app fetched ${ownerRequests.length} requests for phone ${testPhone}`);
  const tracked = ownerRequests[0];
  console.log(`   - Homestay: ${tracked.homestayName}`);
  console.log(`   - Creator: ${tracked.influencerName} (${tracked.influencerHandle})`);
  console.log(`   - Live Status: ${tracked.status}`);
  console.log(`   - Confirmed Shoot Date: ${tracked.confirmedShootingDate}`);
  console.log(`   - StayCabs Admin Notes: ${tracked.adminNotes}`);

  if (tracked.status !== "CONFIRMED") {
    throw new Error(`Expected status CONFIRMED, got ${tracked.status}`);
  }

  // Step 8: Clean up test entries
  console.log("\n--- Step 8: Cleanup Test Artifacts ---");
  await CollaborationRequest.findByIdAndDelete(newCollab._id);
  await Influencer.findByIdAndDelete(newInfluencer._id);
  console.log("✓ Test records cleaned up successfully");

  console.log("\n========================================================");
  console.log("🎉 ALL PROMOTE & INFLUENCER INTEGRATION TESTS PASSED 100%");
  console.log("========================================================\n");
  process.exit(0);
}

runTest().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
