// Create or reset a platform admin in the database the API uses (MONGODB_DATABASE, default "production").
// Usage: ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='long-random-password' [ALLOW_LOCAL_PRODUCTION_DB=true] npx tsx scripts/create-admin.ts
//   ALLOW_LOCAL_PRODUCTION_DB=true is required to write to the "production" database from outside Vercel.
import mongoose from 'mongoose';
import { config, liveDbName } from '../src/config/env.js';
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

let dbName = '';
try {
  dbName = liveDbName();
} catch (err: any) {
  console.error(err.message);
  process.exit(1);
}
await mongoose.connect(config.mongoUri, { dbName });
let user = await User.findOne({ email });
if (user) {
  user.role = 'admin';
  user.password = password; // hashed by the pre-save hook
  (user as any).accountStatus = 'ACTIVE';
  (user as any).tokenVersion = ((user as any).tokenVersion || 0) + 1; // a password reset ends old sessions
} else {
  user = new User({ name: 'Platform Admin', email, password, role: 'admin', accountStatus: 'ACTIVE' });
}
await user.save();
console.log(`✓ Admin ready: ${email} (db: ${mongoose.connection.db?.databaseName})`);
await mongoose.disconnect();
