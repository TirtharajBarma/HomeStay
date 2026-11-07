import dotenv from "dotenv";
import mongoose from "mongoose";
import dns from "node:dns";
import fs from "node:fs";
import path from "node:path";

dotenv.config({ path: "/Users/tirtharaj/Desktop/Desktop/github/stayride/my-code/server/.env" });

try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch {}

const TARGET_EMAIL = "tirtharajbarma3@gmail.com";

async function cleanProduction() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }

  console.log("Connecting to MongoDB Atlas...");
  const client = await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  const db = client.connection.useDb("production");

  console.log("\n==========================================");
  console.log("STEP 1: CREATING FULL BACKUP OF PRODUCTION");
  console.log("==========================================");

  const collections = await db.db.listCollections().toArray();
  const backupData: Record<string, any[]> = {};
  const backupDir = "/Users/tirtharaj/Desktop/Desktop/github/stayride/my-code/server/backups";

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  for (const col of collections) {
    const docs = await db.collection(col.name).find({}).toArray();
    backupData[col.name] = docs;
    console.log(`Backed up ${col.name}: ${docs.length} documents`);
  }

  const timestamp = Date.now();
  const backupPath = path.join(backupDir, `production_db_backup_pre_cleanup_${timestamp}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), "utf-8");
  console.log(`\n✅ Backup successfully saved to: ${backupPath} (${(fs.statSync(backupPath).size / 1024).toFixed(1)} KB)`);

  console.log("\n==========================================");
  console.log("STEP 2: CLEANING TEST DATA IN PRODUCTION");
  console.log(`KEEPING ONLY TARGET EMAIL: ${TARGET_EMAIL}`);
  console.log("==========================================");

  // 1. Users: keep only TARGET_EMAIL
  const userDeleteResult = await db.collection("users").deleteMany({
    email: { $ne: TARGET_EMAIL }
  });
  console.log(`- users: deleted ${userDeleteResult.deletedCount} non-${TARGET_EMAIL} users`);

  // 2. Properties: keep only TARGET_EMAIL's property
  const propertyDeleteResult = await db.collection("properties").deleteMany({
    email: { $ne: TARGET_EMAIL }
  });
  console.log(`- properties: deleted ${propertyDeleteResult.deletedCount} test properties`);

  // 3. StayRide Tenants: keep only TARGET_EMAIL's tenant
  const tenantDeleteResult = await db.collection("stayridetenants").deleteMany({
    $and: [
      { email: { $ne: TARGET_EMAIL } },
      { tenantId: { $ne: TARGET_EMAIL } }
    ]
  });
  console.log(`- stayridetenants: deleted ${tenantDeleteResult.deletedCount} test tenants`);

  // 4. Test Collections to purge completely:
  const collectionsToPurge = [
    "cabrequests",
    "guestlinks",
    "bookings",
    "guests",
    "drivers",
    "payoutrequests",
    "icalfeeds",
    "newsletters",
    "auditlogs",
    "rooms",
    "featureappeals",
    "ratelimits",
    "cabtrips",
    "idempotencykeys",
    "tenantcontrols"
  ];

  for (const colName of collectionsToPurge) {
    if (collections.some(c => c.name === colName)) {
      const res = await db.collection(colName).deleteMany({});
      console.log(`- ${colName}: purged ${res.deletedCount} documents (schema & indexes preserved)`);
    }
  }

  // 5. Commission Settings: PRESERVE!
  const commCount = await db.collection("commissionsettings").countDocuments();
  console.log(`- commissionsettings: preserved ${commCount} configuration document(s)`);

  console.log("\n==========================================");
  console.log("STEP 3: VERIFYING POST-CLEANUP PRODUCTION STATE");
  console.log("==========================================");

  const postCollections = await db.db.listCollections().toArray();
  for (const col of postCollections) {
    const count = await db.collection(col.name).countDocuments();
    console.log(`  ${col.name}: ${count} document(s) remaining`);
  }

  const remainingUsers = await db.collection("users").find({}).toArray();
  console.log("\nRemaining Users:");
  remainingUsers.forEach(u => console.log(`  - ${u.name} (${u.email}) [role: ${u.role}]`));

  const remainingProps = await db.collection("properties").find({}).toArray();
  console.log("\nRemaining Properties:");
  remainingProps.forEach(p => console.log(`  - ${p.name} (${p.email}) [slug: ${p.slug}]`));

  const remainingTenants = await db.collection("stayridetenants").find({}).toArray();
  console.log("\nRemaining Tenants:");
  remainingTenants.forEach(t => console.log(`  - ${t.homestayName} (${t.email}) [tenantId: ${t.tenantId}]`));

  await mongoose.disconnect();
  console.log("\n✅ Production database cleanup complete and verified!");
}

cleanProduction().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
