// One-time index migration for deployed databases. Safe to re-run.
// Usage: npx tsx scripts/migrate-indexes.ts
//   Outside Vercel the "production" database is refused unless ALLOW_LOCAL_PRODUCTION_DB=true is set
//   (e.g. ALLOW_LOCAL_PRODUCTION_DB=true npx tsx scripts/migrate-indexes.ts) — only when you mean it.
import mongoose from 'mongoose';
import { config, dbNameFor, liveDbName } from '../src/config/env.js';
import { getPayoutRequestModel } from '../src/models/payout-request.model.js';
import { getCabRequestModel } from '../src/models/cab-request.model.js';
import { getStayRideTenantModel } from '../src/stayride/store.js';
import { getTenantControlModel } from '../src/models/tenant-control.model.js';
import { getGuestLinkModel } from '../src/models/guest-link.model.js';

if (!config.mongoUri) {
  console.error('MONGODB_URI is not set.');
  process.exit(1);
}
try {
  liveDbName();
} catch (err: any) {
  console.error(err.message);
  process.exit(1);
}
await mongoose.connect(config.mongoUri, { dbName: liveDbName() });

for (const isDemo of [false, true]) {
  const db = dbNameFor(isDemo);
  const payouts = getPayoutRequestModel(isDemo) as any;
  // Old auto-named index blocked the one-pending-payout rule; it is replaced by named indexes.
  for (const name of ['tenantId_1', 'status_1', 'isDemo_1']) {
    try {
      await payouts.collection.dropIndex(name);
      console.log(`[${db}] dropped payoutrequests.${name}`);
    } catch {}
  }
  // Payout method/bank field names (payoutMethod/bankDetails -> method/bank).
  const renamed = await payouts.collection.updateMany({ method: { $exists: false } }, [
    {
      $set: {
        method: { $ifNull: ['$payoutMethod', 'UPI'] },
        bank: {
          $cond: [
            { $ifNull: ['$bankDetails.accountNumber', false] },
            { accountName: '$bankDetails.accountHolderName', accountNumber: '$bankDetails.accountNumber', ifsc: '$bankDetails.ifscCode', bankName: '$bankDetails.bankName' },
            '$$REMOVE',
          ],
        },
      },
    },
  ]);
  if (renamed.modifiedCount) console.log(`[${db}] payoutrequests: ${renamed.modifiedCount} migrated to method/bank`);
  // clientRequestId is now unique per homestay ({propertyId, clientRequestId}), not globally.
  try {
    await (getCabRequestModel(isDemo) as any).collection.dropIndex('clientRequestId_1');
    console.log(`[${db}] dropped cabrequests.clientRequestId_1`);
  } catch {}
  const pendingDupes = await payouts.aggregate([
    { $match: { status: 'PENDING' } },
    { $group: { _id: '$tenantId', n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
  ]);
  if (pendingDupes.length) {
    console.error(`[${db}] tenants with more than one PENDING payout (reject extras in admin first):`, pendingDupes.map((d: any) => d._id));
  }
  for (const model of [payouts, getCabRequestModel(isDemo), getStayRideTenantModel(isDemo), getTenantControlModel(isDemo), getGuestLinkModel(isDemo)]) {
    try {
      await (model as any).syncIndexes();
      console.log(`[${db}] ${(model as any).collection.name}: indexes in sync`);
    } catch (err: any) {
      console.error(`[${db}] ${(model as any).collection.name}: ${err.message}`);
    }
  }
}
await mongoose.disconnect();
