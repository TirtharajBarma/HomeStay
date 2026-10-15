// Create or reset a platform admin in the database the API uses (MONGODB_DATABASE, default "production").
// Usage: ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='long-random-password' npx tsx scripts/create-admin.ts
import mongoose from 'mongoose';
import { config } from '../src/config/env.js';
import { User } from '../src/models/user.model.js';

const email = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
const password = process.env.ADMIN_PASSWORD || '';
if (!email.includes('@') || password.length < 12) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters).');
  process.exit(1);
}
if (!config.mongoUri) {
  console.error('MONGODB_URI is not set.');
  process.exit(1);
}

await mongoose.connect(config.mongoUri, { dbName: process.env.MONGODB_DATABASE || 'production' });
let user = await User.findOne({ email });
if (user) {
  user.role = 'admin';
  user.password = password; // hashed by the pre-save hook
  (user as any).accountStatus = 'ACTIVE';
} else {
  user = new User({ name: 'Platform Admin', email, password, role: 'admin', accountStatus: 'ACTIVE' });
}
await user.save();
console.log(`✓ Admin ready: ${email} (db: ${mongoose.connection.db?.databaseName})`);
await mongoose.disconnect();
