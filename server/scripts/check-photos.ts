// Self-check for homestay photos (no database, no real Cloudinary keys needed):
//   JWT_SECRET=x npx tsx scripts/check-photos.ts
import assert from "node:assert/strict";
import express from "express";
import { signParams } from "../src/services/cloudinary.service.js";
import uploadRoutes from "../src/routes/upload.routes.js";
import { clean } from "../src/stayride/store.js";

// 1. Signature matches Cloudinary's documented examples (authentication_signatures docs)
assert.equal(signParams({ timestamp: 1315060510 }, "abcd"), "a21ad0f63beb4de2e5575204b79ab90bffb02c10");
assert.equal(
  signParams({ timestamp: 1315060510, public_id: "sample_image", eager: "w_400,h_300,c_pad|w_260,h_200,c_crop" }, "abcd"),
  "bfd09f95f331f558cbd1320e67aa8d488770583e"
);

// 2. What PUT /homestay accepts as photos
process.env.CLOUDINARY_CLOUD_NAME = "demo-cloud";
const ours = "https://res.cloudinary.com/demo-cloud/image/upload/v1/stayride/homestays/ab/x.jpg";
const photos = (list: string[], existing: string[] = []) => clean("homestay", { photos: list }, existing).photos;
assert.deepEqual(photos([ours]), [ours]);
assert.throws(() => photos(["https://evil.example.com/x.jpg"]), /uploaded from the StayRide app/);
assert.throws(() => photos(["https://res.cloudinary.com/someone-else/image/upload/x.jpg"]), /uploaded from the StayRide app/);
assert.throws(() => photos(["Deluxe room"]), /https URLs/); // a new text label is not a photo
assert.deepEqual(photos(["Deluxe room"], ["Deluxe room"]), ["Deluxe room"]); // already-stored legacy value kept
assert.throws(() => photos(Array(11).fill(ours)), /At most 10/);

// 3. Who gets an upload signature
const app = express();
app.use((req, _res, next) => {
  (req as any).stayrideUser = JSON.parse(String(req.headers["x-user"] || "{}"));
  next();
});
app.use("/upload", uploadRoutes);
app.use((err: any, _req: any, res: any, _next: any) => res.status(err.status || 500).json({ message: err.message }));
const server = app.listen(0);
const port = (server.address() as any).port;
const get = (user: object) => fetch(`http://127.0.0.1:${port}/upload/signature`, { headers: { "x-user": JSON.stringify(user) } });
const owner = { role: "owner", tenantKey: "owner@home.com", isDemo: false };

delete process.env.CLOUDINARY_API_KEY;
assert.equal((await get(owner)).status, 503); // keys not set yet → clear "not set up" error
process.env.CLOUDINARY_API_KEY = "key";
process.env.CLOUDINARY_API_SECRET = "secret";
assert.equal((await get({ ...owner, role: "driver" })).status, 403);
assert.equal((await get({ ...owner, isDemo: true })).status, 403);
const ok = await get(owner);
assert.equal(ok.status, 200);
const sig: any = await ok.json();
assert.match(sig.folder, /^stayride\/homestays\/[0-9a-f]{16}$/);
assert.ok(!sig.folder.includes("owner@home.com")); // email never in the public URL
const { allowed_formats, folder, timestamp, transformation } = sig;
assert.equal(sig.signature, signParams({ allowed_formats, folder, timestamp, transformation }, "secret"));
assert.equal(sig.uploadUrl, "https://api.cloudinary.com/v1_1/demo-cloud/image/upload");
server.close();

console.log("photo checks passed");
