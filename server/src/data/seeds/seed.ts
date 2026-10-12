import { connectDB, disconnectDB } from "../../config/db.js";
import { Property } from "../../models/property.model.js";
import { Room } from "../../models/room.model.js";
import { Driver } from "../../models/driver.model.js";
import { Booking } from "../../models/booking.model.js";
import { Guest } from "../../models/guest.model.js";
import { User } from "../../models/user.model.js";

import { initialProperty } from "./profile.seed.js";
import { initialRooms } from "./rooms.seed.js";
import { initialDrivers } from "./drivers.seed.js";
import { initialBookings } from "./bookings.seed.js";
import { initialGuests } from "./guests.seed.js";

export async function seedDatabase(cleanExisting = false): Promise<void> {
  console.log("🌱 Starting Database Seeding...");

  if (cleanExisting) {
    console.log("🧹 Clearing existing collections...");
    await Property.deleteMany({});
    await Room.deleteMany({});
    await Driver.deleteMany({});
    await Booking.deleteMany({});
    await Guest.deleteMany({});
  }

  const roomsCount = await Room.countDocuments();
  if (roomsCount === 0 || cleanExisting) {
    // 1. Seed Property
    await Property.findOneAndUpdate({}, initialProperty, { upsert: true, returnDocument: "after" });
    console.log("✅ Seeded Estate Property Profile & Locations");

    // 2. Seed Rooms
    for (const r of initialRooms) {
      await Room.findOneAndUpdate({ code: r.code }, r, { upsert: true, returnDocument: "after" });
    }
    console.log(`✅ Seeded ${initialRooms.length} Accommodation Rooms/Suites`);

    // 3. Seed Drivers
    for (const d of initialDrivers) {
      await Driver.findOneAndUpdate({ id: d.id }, d, { upsert: true, returnDocument: "after" });
    }
    console.log(`✅ Seeded ${initialDrivers.length} Fleet Drivers`);

    // 4. Seed Bookings
    for (const b of initialBookings) {
      await Booking.findOneAndUpdate({ reference: b.reference }, b, { upsert: true, returnDocument: "after" });
    }
    console.log(`✅ Seeded ${initialBookings.length} Initial Bookings`);

    // 5. Seed Guests
    for (const g of initialGuests) {
      await Guest.findOneAndUpdate({ email: g.email, code: g.code }, g, { upsert: true, returnDocument: "after" });
    }
    console.log(`✅ Seeded ${initialGuests.length} Guest CRM Records`);
  } else {
    console.log(`ℹ️ Database already contains ${roomsCount} rooms. Skipping room seed.`);
  }


  // 6. Seed Default Owner Account
  const existingOwner = await User.findOne({ email: "owner@estate.com" });
  if (!existingOwner) {
    await User.create({
      name: "Demo Estate Owner",
      email: "owner@estate.com",
      password: "estatePassword123!",
      role: "owner",
      phone: "+91 98300 41000",
    });
    console.log("✅ Seeded Default Owner Account (owner@estate.com / estatePassword123!)");
  }

  // 7. Seed Default Admin Account
  const existingAdmin = await User.findOne({ email: "admin@platform.com" });
  if (!existingAdmin) {
    await User.create({
      name: "Platform Super Admin",
      email: "admin@platform.com",
      password: "adminMasterPassword2026!",
      role: "admin",
      phone: "+91 98300 11111",
    });
    console.log("✅ Seeded Default Admin Account (admin@platform.com / adminMasterPassword2026!)");
  }

  console.log("🎉 Database seeding completed successfully!");
}

// Standalone execution: `tsx src/data/seeds/seed.ts`
if (process.argv[1] && process.argv[1].endsWith("seed.ts")) {
  (async () => {
    try {
      await connectDB();
      await seedDatabase(true);
      await disconnectDB();
      process.exit(0);
    } catch (err) {
      console.error("❌ Seeding failed:", err);
      process.exit(1);
    }
  })();
}
