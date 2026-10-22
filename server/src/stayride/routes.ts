import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { tenantManager, StayRideMemoryStore, isDemoKey, pick, WRITABLE, clean } from './store.js';
import { beginIdempotent } from './idempotency.js';
import {
  OPEN_STATUSES, cabModel, payoutModel, userModel, parseFare, overlayTrips, ownerConfirmQuote, cancelRequest,
  driverTripView, listDriverTrips, driverSubmitQuote, startTrip, completeTrip, payoutSummary, requestPayout,
  istDateTime, notifyNewRequest, rateDriver, rateDriverByGuest, ownerPayoutView, parseTime12, hashToken, readDriverQuoteToken, ownerCounterOffer, driverAcceptCounter, ownerCompleteTrip, onDriverStatusChange, issueGuestLink, sendAskCab, dispatchRequest, assignOwnFleet, recordGatewayPayment, pushOwner,
} from './platform.js';
import { CommissionService } from '../services/commission.service.js';
import { publicConfig, PlatformConfig } from '../services/platform-config.js';
import { verifyWebhookSignature } from '../services/payment-gateway.service.js';
import { buildIcs, feedFor, setImports, syncRoom, syncAll, storeForExportToken } from './ical.js';
import { LEGAL_VERSION, LEGAL_DOCS, LegalDoc, legalDocument } from './legal.js';
import { audit } from '../models/audit-log.model.js';
import { FEATURE_KEYS, FeatureKey } from '../models/tenant-control.model.js';
import { getFeatureAppealModel } from '../models/feature-appeal.model.js';
import { User } from '../models/user.model.js';
import { Property } from '../models/property.model.js';
import { Driver } from '../models/driver.model.js';
import { Booking } from '../models/booking.model.js';
import { tenantDbModel } from '../utils/tenant-model.js';

export function getUserModel(isDemo: boolean = false): mongoose.Model<any> {
  return tenantDbModel(isDemo, 'User', User.schema);
}

export function getPropertyModel(isDemo: boolean = false): mongoose.Model<any> {
  return tenantDbModel(isDemo, 'Property', Property.schema);
}

export function getBookingModel(isDemo: boolean = false): mongoose.Model<any> {
  return tenantDbModel(isDemo, 'Booking', Booking.schema);
}

export function getDriverModel(isDemo: boolean = false): mongoose.Model<any> {
  return tenantDbModel(isDemo, 'Driver', Driver.schema);
}

import jwt from 'jsonwebtoken';
import { verifyToken, clerkClient } from '@clerk/express';
import { verifyWebhook } from '@clerk/express/webhooks';
import { config } from '../config/env.js';
import uploadRoutes from '../routes/upload.routes.js';
import telemetryRoutes from '../routes/telemetry.routes.js';

interface StayRideAuthPayload {
  id: string;
  email: string;
  role: string;
  tenantKey: string;
  isDemo: boolean;
  tv?: number; // users.tokenVersion at issue time; a mismatch means the session was revoked (S1)
}

const stayrideV1Router = Router();

// Typed + audience-scoped tokens: access and refresh are not interchangeable,
// and /api/v1 rejects aud=stayride (see middlewares/auth.ts).
const TOKEN_AUDIENCE = 'stayride';
function issueTokens(payload: StayRideAuthPayload) {
  return {
    accessToken: jwt.sign({ ...payload, type: 'access' }, config.jwtSecret, { expiresIn: '1d', audience: TOKEN_AUDIENCE }),
    refreshToken: jwt.sign({ ...payload, type: 'refresh' }, config.jwtSecret, { expiresIn: '60d', audience: TOKEN_AUDIENCE }),
  };
}
function verifyStayRideToken(token: string, type: 'access' | 'refresh'): StayRideAuthPayload {
  const decoded = jwt.verify(token, config.jwtSecret, { audience: TOKEN_AUDIENCE }) as StayRideAuthPayload & { type?: string };
  if (decoded.type !== type || !decoded.tenantKey) throw new Error('Wrong token type');
  return decoded;
}
const bearer = (req: Request) => {
  const h = req.headers.authorization;
  return h && h.startsWith('Bearer ') ? h.slice(7) : '';
};

const RESERVED_EMAILS = new Set(['driver@stayride.in', 'demo-driver@stayride.in']);
export const isReservedEmail = (email: string) => isDemoKey(email) || RESERVED_EMAILS.has((email || '').toLowerCase().trim());

// ==========================================
// Tenant Resolution & Auth Middleware
// ==========================================
async function getStoreForReq(req: Request): Promise<{ store: StayRideMemoryStore; tenantKey: string; isDemo: boolean }> {
  const authUser = (req as any).stayrideUser as StayRideAuthPayload | undefined;
  if (!authUser?.tenantKey) throw new Error('Unauthenticated request reached a protected route');
  const store = await tenantManager.getStoreAsync(authUser.tenantKey);
  return { store, tenantKey: authUser.tenantKey, isDemo: Boolean(authUser.isDemo) };
}

// Middleware that enforces valid JWT (StayRide or Clerk) on protected routes
async function authenticateStayRide(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: { message: 'Authentication required. Missing Bearer token.' } });
  }

  const token = authHeader.split(' ')[1];

  // 1. Try StayRide access token first (refresh tokens are rejected here)
  let payload: StayRideAuthPayload | null = null;
  try {
    payload = verifyStayRideToken(token, 'access');
  } catch {
    // Custom JWT check failed, fallback to Clerk check
  }
  if (payload) {
    // Demo status comes only from the tenant key; a token that disagrees is rejected.
    const demo = isDemoKey(payload.tenantKey);
    if (Boolean(payload.isDemo) !== demo || (demo && !config.demoEnabled)) {
      return res.status(401).json({ error: { message: 'Invalid session. Please sign in again.' } });
    }
    if (!demo) {
      // S1: every request re-checks the session version (logout-all / admin revoke end it at once).
      const user: any = mongoose.Types.ObjectId.isValid(payload.id)
        ? await getUserModel(false).findById(payload.id).select('accountStatus role tokenVersion').lean()
        : null;
      if (user && (payload.tv ?? 0) !== (user.tokenVersion ?? 0)) {
        return res.status(401).json({ error: { message: 'Your session has ended. Please sign in again.', code: 'SESSION_REVOKED' } });
      }
      (req as any).stayrideAccount = user; // reused by the owner/driver gates; null = account gone
    }
    (req as any).stayrideUser = { ...payload, isDemo: demo };
    return next();
  }

  // 2. Try Clerk session token verification
  if (config.clerkSecretKey) {
    try {
      const clerkPayload = await verifyToken(token, { secretKey: config.clerkSecretKey });
      if (clerkPayload && clerkPayload.sub) {
        const UserModel = getUserModel(false);
        const user = await UserModel.findOne({ clerkId: clerkPayload.sub });
        if (user && user.accountStatus !== 'BLOCKED' && !isDemoKey(user.email) && (user.role === 'owner' || user.role === 'driver')) {
          (req as any).stayrideAccount = user.toObject();
          (req as any).stayrideUser = {
            id: user._id.toString(),
            email: user.email,
            role: user.role || 'owner',
            tenantKey: user.email,
            isDemo: false,
          };
          return next();
        }
      }
    } catch {}
  }

  return res.status(401).json({ error: { message: 'Invalid or expired token. Please sign in again.' } });
}

// ==========================================
// Authentication & Multi-Tenant Setup
// ==========================================
stayrideV1Router.post('/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if ((email !== undefined && typeof email !== 'string') || (password !== undefined && typeof password !== 'string')) {
    return res.status(400).json({ error: { message: 'Email and password must be text.' } });
  }
  const cleanEmail = (email || '').toLowerCase().trim();
  const cleanPass = (password || '').trim();

  if (!cleanEmail) {
    return res.status(400).json({ error: { message: 'Email address is required.' } });
  }

  const isDemoHost =
    config.demoEnabled && cleanEmail === 'demo@stayride.in' && (cleanPass === 'demo123' || cleanPass === 'demo');
  const isDemoDriver =
    config.demoEnabled &&
    (cleanEmail === 'demo-driver@stayride.in' || cleanEmail === 'driver@stayride.in') &&
    (cleanPass === 'demo123' || cleanPass === 'demo');
  if (!config.demoEnabled && isReservedEmail(cleanEmail)) {
    return res.status(403).json({ error: { message: 'The demo account is disabled.' } });
  }

  // 1A. DEMO HOST LOGIN
  if (isDemoHost) {
    const tenantKey = 'demo@stayride.in';
    const store = await tenantManager.load(tenantKey);

    const tokenPayload: StayRideAuthPayload = {
      id: 'demo-owner-1',
      email: 'demo@stayride.in',
      role: 'owner',
      tenantKey: 'demo@stayride.in',
      isDemo: true,
    };

    const { accessToken, refreshToken } = issueTokens(tokenPayload);

    return res.json({
      accessToken,
      refreshToken,
      role: 'owner',
      owner: {
        id: 1,
        name: store.homestay.ownerName || 'Tshering Bhutia (Demo Host)',
        phone: store.homestay.phone || '+91 98001 23456',
        email: 'demo@stayride.in',
      },
      homestay: {
        id: 1,
        name: store.homestay.name || 'Mountain View Homestay',
        link: store.homestay.link || 'https://stayride.in/h/mountain-view-gangtok',
      },
    });
  }

  // 1B. DEMO DRIVER LOGIN
  if (isDemoDriver) {
    const tokenPayload: StayRideAuthPayload = {
      id: 'demo-driver-1',
      email: cleanEmail,
      role: 'driver',
      tenantKey: 'demo@stayride.in',
      isDemo: true,
    };

    const { accessToken, refreshToken } = issueTokens(tokenPayload);

    return res.json({
      accessToken,
      refreshToken,
      role: 'driver',
      driver: { ...driverProfile(DEMO_DRIVER), email: cleanEmail },
    });
  }

  // 2. REAL PRODUCTION USER LOGIN - Requires correct password
  if (!cleanPass) {
    return res.status(400).json({ error: { message: 'Password is required.' } });
  }

  try {
    const UserModel = getUserModel(false); // Production DB
    const user = await UserModel.findOne({ email: cleanEmail });

    // S2: one message for unknown email and wrong password (no account-existence leak).
    if (!user || !(await user.comparePassword(cleanPass))) {
      return res.status(401).json({ error: { message: 'Invalid email or password.', code: 'INVALID_CREDENTIALS' } });
    }

    if (user.role === 'admin') {
      return res.status(403).json({
        error: {
          message: 'Access Denied: You are an Administrator. The mobile app is strictly for Homestay Hosts and Cab Drivers. Please use the Web Control Tower.',
          code: 'ADMIN_NOT_ALLOWED',
        },
      });
    }

    if (user.role !== 'owner' && user.role !== 'driver') {
      return res.status(403).json({ error: { message: 'This account cannot sign in to the StayRide app.' } });
    }
    const userRole = user.role as 'owner' | 'driver';

    if (user.accountStatus === 'BLOCKED') {
      return res.status(403).json({ error: { message: 'This account is blocked. Contact StayRide support.', code: 'ACCOUNT_BLOCKED' } });
    }

    // 2A. DRIVER USER LOGIN (pending drivers can sign in but see "awaiting approval")
    if (userRole === 'driver') {
      const tokenPayload: StayRideAuthPayload = {
        id: user._id.toString(),
        email: user.email,
        role: 'driver',
        tenantKey: user.email,
        isDemo: false,
        tv: user.tokenVersion || 0,
      };

      const { accessToken, refreshToken } = issueTokens(tokenPayload);

      return res.json({
        accessToken,
        refreshToken,
        role: 'driver',
        driver: driverProfile(user),
      });
    }

    // 2B. HOMESTAY OWNER LOGIN
    const tenantKey = cleanEmail;
    const account = await CommissionService.getAccountState(tenantKey, false);
    if (account.blocked) {
      return res.status(403).json({ error: { message: `Your homestay account is suspended by StayRide${account.blockReason ? `: ${account.blockReason}` : '.'}`, code: 'ACCOUNT_BLOCKED' } });
    }
    const store = await tenantManager.load(tenantKey);

    const tokenPayload: StayRideAuthPayload = {
      id: user._id.toString(),
      email: user.email,
      role: 'owner',
      tenantKey,
      isDemo: false,
      tv: user.tokenVersion || 0,
    };

    const { accessToken, refreshToken } = issueTokens(tokenPayload);

    return res.json({
      accessToken,
      refreshToken,
      role: 'owner',
      owner: {
        id: 1,
        name: store.homestay.ownerName || user.name,
        phone: store.homestay.phone || user.phone,
        email: user.email,
      },
      homestay: {
        id: 1,
        name: store.homestay.name || 'My Homestay',
        link: store.homestay.link || '',
      },
    });
  } catch (err: any) {
    console.error('[StayRide] Login error:', err);
    return res.status(500).json({ error: { message: 'Internal server error during authentication.' } });
  }
});

stayrideV1Router.post('/auth/signup', async (req: Request, res: Response) => {
  const { name, phone, email, password, homestayName, location, role, vehicleType, vehicleNumber, area } = req.body;
  if ((email !== undefined && typeof email !== 'string') || (password !== undefined && typeof password !== 'string')) {
    return res.status(400).json({ error: { message: 'Email and password must be text.' } });
  }
  const cleanEmail = (email || '').toLowerCase().trim();
  const cleanPhone = (phone || '').trim();
  const cleanPass = (password || '').trim();
  const userRole = (role === 'driver' ? 'driver' : 'owner') as 'owner' | 'driver';
  const cleanName = (name || (userRole === 'driver' ? 'Driver' : 'Host')).trim();

  if (!cleanEmail) {
    return res.status(400).json({ error: { message: 'Email address is required.' } });
  }
  if (!cleanPass) {
    return res.status(400).json({ error: { message: 'Password is required.' } });
  }

  if (isDemoKey(cleanEmail) || cleanEmail === 'driver@stayride.in' || cleanEmail === 'demo-driver@stayride.in') {
    return res.status(400).json({ error: { message: 'This email is reserved for demo showcase accounts and cannot be registered.' } });
  }

  // Prevent duplicate signup wiping existing account!
  try {
    const UserModel = getUserModel(false);
    const existingUser = await UserModel.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(409).json({
        error: { message: 'An account with this email already exists. Please sign in instead.' },
      });
    }

    if (cleanPass.length < 8) {
      return res.status(400).json({ error: { message: 'Password must be at least 8 characters long.' } });
    }
    if (userRole === 'driver' && (!cleanPhone || !vehicleNumber)) {
      return res.status(400).json({ error: { message: 'Drivers must provide a phone number and vehicle number.' } });
    }
    if (userRole === 'driver' && !str(area, 100)) {
      return res.status(400).json({ error: { message: 'Drivers must provide the area they serve.' } });
    }
    if (userRole === 'driver') {
      const cfg = await CommissionService.getPlatformConfig(false);
      const vt = VEHICLE_TYPES.includes(vehicleType) ? vehicleType : 'SUV';
      if (cfg.vehicles[vt as keyof typeof cfg.vehicles]?.enabled === false) {
        return res.status(400).json({ error: { message: 'This vehicle type is currently disabled by StayRide.' } });
      }
    }

    const userDoc = await UserModel.create({
      name: cleanName,
      email: cleanEmail,
      password: cleanPass,
      phone: cleanPhone,
      role: userRole,
      // Drivers can only take StayRide trips after admin approval.
      accountStatus: userRole === 'driver' ? 'PENDING_APPROVAL' : 'ACTIVE',
      ...(userRole === 'driver'
        ? { vehicle: { type: VEHICLE_TYPES.includes(vehicleType) ? vehicleType : 'SUV', model: str(req.body.vehicleModel, 60), plate: str(vehicleNumber, 20).toUpperCase(), seats: Number(req.body.seats) || 0, area: str(area, 100) } }
        : {}),
    });

    // DRIVER SIGNUP FLOW
    if (userRole === 'driver') {
      const { accessToken, refreshToken } = issueTokens({ id: userDoc._id.toString(), email: cleanEmail, role: 'driver', tenantKey: cleanEmail, isDemo: false });
      return res.status(201).json({ accessToken, refreshToken, role: 'driver', driver: driverProfile(userDoc) });
    }

    // HOMESTAY OWNER SIGNUP FLOW
    const cleanHomestay = (homestayName || 'My Homestay').trim();
    const cleanLocation = str(location, 200);
    const cleanLat = req.body.latitude ? Number(req.body.latitude) : null;
    const cleanLng = req.body.longitude ? Number(req.body.longitude) : null;
    const cleanMapQuery = req.body.mapQuery || (cleanLat && cleanLng ? `${cleanLat},${cleanLng}` : cleanLocation);
    const tenantKey = cleanEmail;
    const store = await tenantManager.createTenantIfMissing(tenantKey, {
      name: cleanHomestay,
      ownerName: cleanName,
      phone: cleanPhone,
      email: cleanEmail,
      location: cleanLocation,
      mapQuery: cleanMapQuery,
    });

    const PropertyModel = getPropertyModel(false);
    let propDoc = await PropertyModel.findOne({ email: cleanEmail });
    if (!propDoc && userDoc) {
      propDoc = await PropertyModel.create({
        ownerId: (userDoc as any)._id,
        name: cleanHomestay,
        email: cleanEmail,
        phone: cleanPhone || 'not provided',
        address: cleanLocation || 'not provided',
        town: cleanLocation.split(',')[0].trim() || 'Gangtok',
        region: 'Sikkim',
        coordinates: cleanLat && cleanLng ? { latitude: cleanLat, longitude: cleanLng } : undefined,
        status: 'active',
      } as any);
      (userDoc as any).propertyId = (propDoc as any)?._id;
      await (userDoc as any).save();
    }

    console.log(`✅ Production user registered: ${cleanEmail} (${cleanHomestay})`);

    const tokenPayload: StayRideAuthPayload = {
      id: userDoc._id.toString(),
      email: cleanEmail,
      role: 'owner',
      tenantKey,
      isDemo: false,
    };

    const { accessToken, refreshToken } = issueTokens(tokenPayload);

    return res.status(201).json({
      accessToken,
      refreshToken,
      role: 'owner',
      owner: {
        id: 1,
        name: store.homestay.ownerName,
        phone: store.homestay.phone,
        email: store.homestay.email,
      },
      homestay: {
        id: 1,
        name: store.homestay.name,
        link: store.homestay.link,
      },
    });
  } catch (err: any) {
    console.error('[StayRide] Signup error:', err);
    return res.status(500).json({ error: { message: err.message || 'Registration failed.' } });
  }
});

stayrideV1Router.post('/auth/refresh', async (req: Request, res: Response) => {
  const token =
    req.body?.refreshToken ||
    (req.headers.authorization && req.headers.authorization.split(' ')[1]);

  if (!token) {
    return res.status(401).json({ error: { message: 'Refresh token is required.' } });
  }

  try {
    const decoded = verifyStayRideToken(token, 'refresh');
    const userRole = (decoded.role || 'owner') as 'owner' | 'driver';

    if (Boolean(decoded.isDemo) !== isDemoKey(decoded.tenantKey) || (decoded.isDemo && !config.demoEnabled)) {
      return res.status(401).json({ error: { message: 'Invalid session. Please sign in again.' } });
    }
    let user: any = null;
    if (!decoded.isDemo) {
      user = mongoose.Types.ObjectId.isValid(decoded.id) ? await getUserModel(false).findById(decoded.id).lean() : null;
      if (!user || user.accountStatus === 'BLOCKED') {
        return res.status(401).json({ error: { message: 'This account is no longer active.', code: 'ACCOUNT_BLOCKED' } });
      }
      if ((decoded.tv ?? 0) !== (user.tokenVersion ?? 0)) {
        return res.status(401).json({ error: { message: 'Your session has ended. Please sign in again.', code: 'SESSION_REVOKED' } });
      }
    }

    const tokenPayload: StayRideAuthPayload = {
      id: decoded.id,
      email: decoded.email,
      role: userRole,
      tenantKey: decoded.tenantKey,
      isDemo: Boolean(decoded.isDemo),
      tv: user?.tokenVersion || 0,
    };
    const { accessToken: newAccessToken, refreshToken: newRefreshToken } = issueTokens(tokenPayload);

    if (userRole === 'driver') {
      return res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken, role: 'driver', driver: driverProfile(user || DEMO_DRIVER) });
    }

    const store = await tenantManager.load(decoded.tenantKey);

    return res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      role: 'owner',
      owner: {
        id: 1,
        name: store.homestay.ownerName,
        phone: store.homestay.phone,
        email: decoded.email,
      },
      homestay: {
        id: 1,
        name: store.homestay.name,
        link: store.homestay.link,
      },
    });
  } catch (err) {
    return res.status(401).json({ error: { message: 'Invalid or expired refresh token.' } });
  }
});

// ==========================================
// Clerk Sync & Webhook (Google + Password + MongoDB Sync)
// ==========================================
// Does this Google/Clerk sign-in already have a StayRide account (and which role)? The app asks this
// before deciding to sign in directly or to show registration, so a role is never guessed.
stayrideV1Router.post('/auth/clerk-status', async (req: Request, res: Response) => {
  if (!config.clerkSecretKey) {
    return res.status(503).json({ error: { message: 'Clerk sign-in is not configured on the server.' } });
  }
  let clerkUserId = '';
  try {
    clerkUserId = (await verifyToken(bearer(req), { secretKey: config.clerkSecretKey })).sub;
  } catch {
    return res.status(401).json({ error: { message: 'Invalid or missing Clerk session. Please sign in again.' } });
  }
  const clerkUser = await clerkClient.users.getUser(clerkUserId);
  const primary = clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId);
  const email = primary?.verification?.status === 'verified' ? primary.emailAddress.toLowerCase().trim() : '';
  const user: any = await getUserModel(false)
    .findOne({ $or: [{ clerkId: clerkUserId }, ...(email ? [{ email }] : [])] })
    .select('role accountStatus deletedAt')
    .lean();
  // A deleted account still exists (blocked): its email cannot silently register again
  return res.json({ exists: Boolean(user), role: user?.role ?? null, blocked: user?.accountStatus === 'BLOCKED', deleted: Boolean(user?.deletedAt) });
});

stayrideV1Router.post('/auth/clerk-sync', async (req: Request, res: Response) => {
  if (!config.clerkSecretKey) {
    return res.status(503).json({ error: { message: 'Clerk sign-in is not configured on the server.' } });
  }

  // Identity comes ONLY from a verified Clerk session token, never from the body.
  let clerkUserId = '';
  try {
    const payload = await verifyToken(bearer(req), { secretKey: config.clerkSecretKey });
    clerkUserId = payload.sub;
  } catch {
    return res.status(401).json({ error: { message: 'Invalid or missing Clerk session. Please sign in again.' } });
  }

  try {
    const clerkUser = await clerkClient.users.getUser(clerkUserId);
    const primary = clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId);
    if (!primary || primary.verification?.status !== 'verified') {
      return res.status(403).json({ error: { message: 'A verified email address is required.' } });
    }

    const cleanEmail = primary.emailAddress.toLowerCase().trim();
    if (isReservedEmail(cleanEmail)) {
      return res.status(403).json({ error: { message: 'This email is reserved and cannot be used to sign in.' } });
    }
    const cleanAvatar = clerkUser.imageUrl || '';
    const clerkId = clerkUser.id;

    // Profile hints from client
    const { phone, homestayName, location, role, vehicleType, vehicleNumber, area } = req.body;
    const requestedRole = (role === 'driver' ? 'driver' : 'owner') as 'owner' | 'driver';
    const cleanPhone = String(phone || '').trim();
    const cleanName = (clerkUser.fullName || clerkUser.firstName || (requestedRole === 'driver' ? 'Driver' : 'Host')).trim();

    const UserModel = getUserModel(false); // Production DB
    let user = await UserModel.findOne({ $or: [{ clerkId }, { email: cleanEmail }] });

    if (user && user.role === 'admin') {
      return res.status(403).json({
        error: {
          message: 'Access Denied: You are an Administrator. The mobile app is strictly for Homestay Hosts and Cab Drivers. Please use the Web Control Tower.',
          code: 'ADMIN_NOT_ALLOWED',
        },
      });
    }

    if (user && user.accountStatus === 'BLOCKED') {
      return res.status(403).json({ error: { message: 'This account is blocked. Contact StayRide support.', code: 'ACCOUNT_BLOCKED' } });
    }
    if (user && user.clerkId && user.clerkId !== clerkId) {
      return res.status(409).json({ error: { message: 'This email is already linked to a different sign-in account.' } });
    }

    const isNew = !user;
    const userRole = (user?.role || requestedRole) as 'owner' | 'driver';

    if (!user && userRole === 'driver' && !str(area, 100)) {
      return res.status(400).json({ error: { message: 'Drivers must provide the area they serve.' } });
    }
    if (!user && userRole === 'driver') {
      const cfg = await CommissionService.getPlatformConfig(false);
      const vt = VEHICLE_TYPES.includes(vehicleType) ? vehicleType : 'SUV';
      if (cfg.vehicles[vt as keyof typeof cfg.vehicles]?.enabled === false) {
        return res.status(400).json({ error: { message: 'This vehicle type is currently disabled by StayRide.' } });
      }
    }
    // New accounts must accept the Terms + Privacy Policy and confirm they are 18 or older
    if (!user && req.body?.acceptedTerms !== true) {
      return res.status(400).json({ error: { message: 'Please accept the Terms of Service and Privacy Policy to create an account.', code: 'TERMS_REQUIRED' } });
    }
    if (!user) {
      user = await UserModel.create({
        termsAcceptedAt: new Date(),
        termsVersion: LEGAL_VERSION,
        name: cleanName,
        email: cleanEmail,
        clerkId,
        password: crypto.randomBytes(32).toString('hex'), // unusable; Clerk handles sign-in
        phone: cleanPhone,
        avatar: cleanAvatar,
        role: userRole,
        accountStatus: userRole === 'driver' ? 'PENDING_APPROVAL' : 'ACTIVE',
        ...(userRole === 'driver'
          ? { vehicle: { type: VEHICLE_TYPES.includes(vehicleType) ? vehicleType : 'SUV', model: str(req.body.vehicleModel, 60), plate: str(vehicleNumber, 20).toUpperCase(), seats: Number(req.body.seats) || 0, area: str(area, 100) } }
          : {}),
      });

      if (userRole !== 'driver') {
        const cleanHomestay = String(homestayName || `${cleanName}'s Homestay`).trim();
        const cleanLocation = str(location, 200);
        const PropertyModel = getPropertyModel(false);
        let propDoc = await PropertyModel.findOne({ email: cleanEmail });
        if (!propDoc) {
          propDoc = await PropertyModel.create({
            ownerId: (user as any)._id,
            name: cleanHomestay,
            email: cleanEmail,
            phone: cleanPhone || 'not provided',
            address: cleanLocation || 'not provided',
            town: cleanLocation.split(',')[0].trim() || 'Gangtok',
            region: 'Sikkim',
            status: 'active',
          } as any);
        }
        (user as any).propertyId = propDoc._id;
        await user.save();
      }
    } else {
      // Clerk verified ownership of this email, so linking is safe.
      let modified = false;
      if (!user.clerkId) {
        user.clerkId = clerkId;
        modified = true;
      }
      if (cleanAvatar && !user.avatar) {
        user.avatar = cleanAvatar;
        modified = true;
      }
      if (modified) await user.save();
    }

    const tokenPayload: StayRideAuthPayload = {
      id: user._id.toString(),
      email: cleanEmail,
      role: userRole,
      tenantKey: cleanEmail,
      isDemo: false,
      tv: user.tokenVersion || 0,
    };

    const { accessToken, refreshToken } = issueTokens(tokenPayload);

    if (userRole === 'driver') {
      return res.json({ accessToken, refreshToken, role: 'driver', driver: driverProfile(user), isNew });
    }

    const account = await CommissionService.getAccountState(cleanEmail, false);
    if (account.blocked) {
      return res.status(403).json({ error: { message: 'Your homestay account is suspended by StayRide.', code: 'ACCOUNT_BLOCKED' } });
    }

    // Owner role return
    const cleanHomestay = String(homestayName || `${cleanName}'s Homestay`).trim();
    const cleanLocation = str(location, 200);
    const cleanLat = req.body.latitude ? Number(req.body.latitude) : null;
    const cleanLng = req.body.longitude ? Number(req.body.longitude) : null;
    const cleanMapQuery = req.body.mapQuery || (cleanLat && cleanLng ? `${cleanLat},${cleanLng}` : cleanLocation);
    const tenantKey = cleanEmail;
    const store = await tenantManager.createTenantIfMissing(tenantKey, {
      name: cleanHomestay,
      ownerName: cleanName,
      phone: cleanPhone,
      email: cleanEmail,
      location: cleanLocation,
      mapQuery: cleanMapQuery,
    });

    const PropertyModel = getPropertyModel(false);
    let propDoc = await PropertyModel.findOne({ email: cleanEmail });
    if (!propDoc) {
      propDoc = await PropertyModel.create({
        ownerId: (user as any)._id,
        name: cleanHomestay,
        email: cleanEmail,
        phone: cleanPhone || 'not provided',
        address: cleanLocation || 'not provided',
        town: cleanLocation.split(',')[0].trim() || 'Gangtok',
        region: 'Sikkim',
        coordinates: cleanLat && cleanLng ? { latitude: cleanLat, longitude: cleanLng } : undefined,
        status: 'active',
      } as any);
      (user as any).propertyId = (propDoc as any)?._id;
      await (user as any).save();
    } else if (cleanLat && cleanLng) {
      propDoc.coordinates = { latitude: cleanLat, longitude: cleanLng };
      await propDoc.save();
    }
    console.log(`✅ [Clerk Sync] ${isNew ? 'New' : 'Existing'} user synced (clerk ${clerkId}) with GPS`);

    return res.json({
      accessToken,
      refreshToken,
      role: 'owner',
      owner: {
        id: 1,
        name: store.homestay.ownerName || user.name,
        phone: store.homestay.phone || user.phone,
        email: user.email,
        avatar: user.avatar,
      },
      homestay: {
        id: 1,
        name: store.homestay.name || cleanHomestay,
        link: store.homestay.link || '',
      },
      isNew,
    });
  } catch (err: any) {
    console.error('[StayRide] Clerk sync error:', err?.message);
    return res.status(500).json({ error: { message: 'Clerk synchronization failed.' } });
  }
});

// ==========================================
// Shared helpers
// ==========================================
const DAY_MS = 86400000;
const VEHICLE_TYPES = ['SUV', 'Sedan', '7-seater', '9-seater'];

// Pickup time helpers (istDateTime) live in platform.ts (also used for request expiry).
export function validateSchedule(body: any, cfgOrHorizon: PlatformConfig | number = 365): string | null {
  const cfg = typeof cfgOrHorizon === 'object' && cfgOrHorizon !== null ? cfgOrHorizon : null;
  const horizonDays = cfg ? cfg.bookingHorizonDays : (typeof cfgOrHorizon === 'number' ? cfgOrHorizon : 365);
  const pickupAt = istDateTime(body.date, body.time);
  if (pickupAt === null) return 'A valid pickup date and time (hh:mm AM/PM) are required.';
  if (pickupAt < Date.now() - 10 * 60000) return 'Pickup date and time cannot be in the past.';
  if (pickupAt > Date.now() + (horizonDays + 1) * DAY_MS) return `Pickup must be within the next ${horizonDays} days.`;

  if (cfg?.pickupStart && cfg?.pickupEnd) {
    const t = parseTime12(body.time);
    const start = parseTime12(cfg.pickupStart);
    const end = parseTime12(cfg.pickupEnd);
    if (t === null || start === null || end === null || t < start || t > end) {
      return `Pickup time must be between ${cfg.pickupStart} and ${cfg.pickupEnd}.`;
    }
  }

  if (body.isRoundTrip) {
    const returnAt = istDateTime(body.returnDate, body.returnTime);
    if (returnAt === null) return 'Round trips need a return date and time.';
    if (returnAt <= pickupAt) return 'Return must be after the pickup date and time.';
    if (returnAt > Date.now() + (horizonDays + 1) * DAY_MS) return `Return date must be within the next ${horizonDays} days.`;
    if (cfg?.pickupStart && cfg?.pickupEnd) {
      const rt = parseTime12(body.returnTime);
      const start = parseTime12(cfg.pickupStart);
      const end = parseTime12(cfg.pickupEnd);
      if (rt === null || start === null || end === null || rt < start || rt > end) {
        return `Return time must be between ${cfg.pickupStart} and ${cfg.pickupEnd}.`;
      }
    }
  }
  return null;
}

const newReference = () => `REQ-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
const str =(v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const authOf = (req: Request) => (req as any).stayrideUser as StayRideAuthPayload;
const tenantOf = (req: Request) => {
  const u = authOf(req);
  return { tenantKey: u.tenantKey, isDemo: isDemoKey(u.tenantKey), actor: u.email };
};

/**
 * Create a platform trip: the owner's tenant trip first, then its CabRequest (the single source of
 * truth for money), upserted on {propertyId, clientRequestId} so a retry can never create two.
 * If the request write fails, both sides are compensated (best effort); overlayTrips tolerates and
 * repairs either side missing. Returns the trip that won (a concurrent retry may have won).
 */
async function createPlatformTrip(
  tenantKey: string,
  isDemo: boolean,
  make: (s: StayRideMemoryStore) => any,
  source: string,
  clientRequestId: string | null,
  extra: Record<string, any> = {},
  // `make` returned a trip that already existed (an old own-driver trip): on failure keep it, just unlink it
  existing = false
): Promise<{ trip: any | null; doc: any }> {
  const reference = newReference();
  let homestayName = 'Homestay';
  const trip = await tenantManager.mutate(tenantKey, (s) => {
    homestayName = s.homestay.name || 'Homestay';
    const t = make(s);
    t.reference = reference;
    t.dispatchMode = 'PLATFORM';
    return t;
  });
  const crid = clientRequestId || `trip:${reference}`; // deterministic per tenant + trip
  const Cab = cabModel(isDemo);
  const removeTrip = () =>
    tenantManager.mutate(tenantKey, (s) => {
      if (existing) {
        const t = s.trips.find((x) => x.reference === reference);
        if (t) delete t.reference;
      } else {
        s.trips = s.trips.filter((t) => t.reference !== reference);
      }
    });
  // "Nearby" drivers are measured from the homestay: the owner's map pin, else the property's signup GPS.
  const pinned = await tenantManager.load(tenantKey).then((s) => s.homestay).catch(() => null);
  const prop: any = isDemo || (pinned?.latitude && pinned?.longitude) ? null : await getPropertyModel(false).findOne({ email: tenantKey }).select('coordinates').lean();
  const homestayLocation =
    pinned?.latitude && pinned?.longitude
      ? { lat: Number(pinned.latitude), lng: Number(pinned.longitude) }
      : prop?.coordinates?.latitude && prop?.coordinates?.longitude
      ? { lat: Number(prop.coordinates.latitude), lng: Number(prop.coordinates.longitude) }
      : null;
  let doc: any;
  try {
    const fields = {
      reference,
      propertyId: tenantKey,
      tripId: trip.id,
      clientRequestId: crid,
      homestayName,
      guestId: trip.guestId ?? null,
      guestName: trip.guestName,
      guestPhone: trip.phone,
      pickupLocation: { address: trip.pickup, lat: trip.pickupLat ?? homestayLocation?.lat ?? null, lng: trip.pickupLng ?? homestayLocation?.lng ?? null },
      destinations: trip.destinations?.length ? trip.destinations : [{ address: trip.destination || 'Destination', order: 0 }],
      isRoundTrip: Boolean(trip.isRoundTrip),
      returnDate: trip.returnDate ?? null,
      returnTime: trip.returnTime || '',
      date: trip.date,
      time: trip.time,
      passengers: trip.passengers || 1,
      vehicleType: VEHICLE_TYPES.includes(trip.vehicleType) ? trip.vehicleType : 'SUV',
      requestSource: source,
      homestayLocation,
      status: 'FINDING_DRIVER',
      // A guest's inquiry waits for the owner (nearby drivers or own fleet); the owner's own bookings go straight out.
      dispatched: source !== 'GUEST_WEB_LINK',
      ...extra,
    };
    const upsert = () => Cab.findOneAndUpdate({ propertyId: tenantKey, clientRequestId: crid }, { $setOnInsert: fields }, { upsert: true, returnDocument: 'after', runValidators: true }).lean();
    try {
      doc = await upsert();
    } catch (err: any) {
      if (err?.code !== 11000) throw err;
      doc = await Cab.findOne({ propertyId: tenantKey, clientRequestId: crid }).lean(); // parallel upsert won
      if (!doc) throw err;
    }
  } catch (err) {
    await Promise.allSettled([
      Cab.deleteOne({ propertyId: tenantKey, reference, status: 'FINDING_DRIVER', 'quotes.0': { $exists: false } }),
      removeTrip(),
    ]);
    throw err;
  }
  if (doc.reference !== reference) {
    await removeTrip().catch(() => {}); // a retry with the same clientRequestId already created it
    return { trip: null, doc };
  }
  if (doc.dispatched !== false) await notifyNewRequest(isDemo, doc);
  return { trip, doc };
}

/** Normalize trip input coming from owner app / guest page. Never accepts money fields. */
function tripInput(b: any) {
  const destinations = Array.isArray(b.destinations)
    ? b.destinations.map((d: unknown) => str(typeof d === 'object' && d ? (d as any).address : d, 200)).filter(Boolean).slice(0, 6)
    : [];
  const isRoundTrip = b.isRoundTrip === true;
  return {
    guestName: str(b.guestName, 100),
    phone: str(b.phone ?? b.guestPhone, 20),
    pickup: str(b.pickup, 200),
    // optional map pin for the pickup (lat/lng); India-sized sanity range
    ...(Number.isFinite(Number(b.pickupLat)) && Number.isFinite(Number(b.pickupLng)) && Math.abs(Number(b.pickupLat)) <= 90 && Math.abs(Number(b.pickupLng)) <= 180 && b.pickupLat !== null && b.pickupLat !== ''
      ? { pickupLat: Number(b.pickupLat), pickupLng: Number(b.pickupLng) }
      : {}),
    destination: destinations.length ? destinations.join(' ➔ ') : str(b.destination, 200),
    destinations: destinations.map((address: string, order: number) => ({ address, order })),
    isRoundTrip,
    returnDate: isRoundTrip ? Number(b.returnDate) : undefined,
    returnTime: isRoundTrip ? str(b.returnTime, 10) : undefined,
    date: Number(b.date),
    time: str(b.time, 10),
    passengers: Math.min(20, Math.max(1, Math.round(Number(b.passengers) || 1))),
    vehicleType: VEHICLE_TYPES.includes(b.vehicleType) ? b.vehicleType : 'SUV',
    guestId: Number.isFinite(Number(b.guestId)) ? Number(b.guestId) : undefined,
    bookingId: Number.isFinite(Number(b.bookingId)) ? Number(b.bookingId) : undefined,
  };
}

async function findGuestLink(token: unknown) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
  const { getGuestLinkModel } = await import('../models/guest-link.model.js');
  const tokenHash = hashToken(token);
  for (const isDemo of [false, true]) {
    if (isDemo && !config.demoEnabled) break;
    const link = await getGuestLinkModel(isDemo).findOne({ tokenHash, expiresAt: { $gt: new Date() } }).lean();
    if (link) return link as any;
  }
  return null;
}

/** Guest links only work while the homestay is active and the feature is on. */
async function activeGuestLink(token: unknown) {
  const link = await findGuestLink(token);
  if (!link) return null;
  const account = await CommissionService.getAccountState(link.tenantKey, isDemoKey(link.tenantKey));
  if (account.blocked || !account.features.guestCabLinks) return null;
  return link;
}

const invalidLink = (res: Response) => res.status(404).json({ error: { message: 'This link is invalid or has expired.' } });

// ==========================================
// Public Guest Web Cab Requests (secure token link, no login)
// ==========================================
stayrideV1Router.get('/public/guest-links/:token', async (req: Request, res: Response) => {
  const link = await activeGuestLink(req.params.token);
  if (!link) return invalidLink(res);
  const store = await tenantManager.load(link.tenantKey);
  return res.json({
    homestayName: store.homestay.name,
    pickup: store.homestay.location || store.homestay.name,
    guestName: link.guestName,
    guestPhone: link.guestPhone,
    expiresAt: new Date(link.expiresAt).getTime(),
    // times, booking window, presets and vehicle classes come from the admin's settings
    config: publicConfig(await CommissionService.getPlatformConfig(isDemoKey(link.tenantKey))),
  });
});

stayrideV1Router.post('/public/guest-links/:token/cab-requests', async (req: Request, res: Response) => {
  const link = await activeGuestLink(req.params.token);
  if (!link) return invalidLink(res);

  const input = tripInput(req.body);
  const clientRequestId = str(req.body.clientRequestId, 64);
  if (!input.guestName || !input.phone) return res.status(400).json({ error: { message: 'Guest name and phone number are required.' } });
  if (!clientRequestId) return res.status(400).json({ error: { message: 'clientRequestId is required.' } });
  if (input.destinations.length < 1) return res.status(400).json({ error: { message: 'Add between 1 and 6 destinations.' } });
  const tenantKey = link.tenantKey as string;
  const isDemo = isDemoKey(tenantKey);
  const cfg = await CommissionService.getPlatformConfig(isDemo);
  const inputError = vehicleError(cfg, input.vehicleType) || validateSchedule(input, cfg);
  if (inputError) return res.status(400).json({ error: { message: inputError } });
  const Cab = cabModel(isDemo);

  // Idempotent retries: same clientRequestId returns the original request.
  const existing: any = await Cab.findOne({ clientRequestId, propertyId: tenantKey }).lean();
  if (existing) return res.status(201).json({ reference: existing.reference, status: existing.status });
  // Abuse cap per link.
  if ((await Cab.countDocuments({ propertyId: tenantKey, guestPhone: input.phone, status: { $in: OPEN_STATUSES } })) >= cfg.maxOpenRequestsPerPhone) {
    return res.status(429).json({ error: { message: 'Too many open requests. Please contact your homestay.' } });
  }

  const { doc } = await createPlatformTrip(
    tenantKey,
    isDemo,
    (store) => withEstimate(cfg, store.createTrip({ ...input, guestId: link.guestId ?? undefined, pickup: input.pickup || store.homestay.location || store.homestay.name }, 'GUEST_WEB_LINK')),
    'GUEST_WEB_LINK',
    clientRequestId,
    { guestNotes: str(req.body.notes, 500) }
  );
  pushOwner(isDemo, tenantKey, {
    title: 'New Guest Cab Inquiry',
    body: `${input.guestName} requested a cab for ${input.pickup || 'homestay'}.`,
    data: { type: 'NEW_REQUEST', reference: doc.reference, tripId: doc.tripId },
  }).catch(() => {});

  // Instant zero-touch dispatch to priority and nearby drivers
  try {
    await dispatchRequest(tenantKey, isDemo, doc.reference);
  } catch (dispErr: any) {
    console.warn(`[Auto-Dispatch] Notice for ${doc.reference}:`, dispErr?.message);
  }

  return res.status(201).json({ reference: doc.reference, status: doc.status });
});

stayrideV1Router.get('/public/cab-requests/:reference', async (req: Request, res: Response) => {
  let link = await findGuestLink(req.query.t);
  let doc: any = null;
  if (link) {
    doc = await cabModel(isDemoKey(link.tenantKey))
      .findOne({ reference: String(req.params.reference), propertyId: link.tenantKey })
      .lean();
  } else {
    for (const isDemo of [false, true]) {
      if (isDemo && !config.demoEnabled) break;
      const found = await cabModel(isDemo).findOne({ reference: String(req.params.reference) }).lean();
      if (found) {
        doc = found;
        break;
      }
    }
  }
  if (!doc) return res.status(404).json({ error: { message: 'Cab request not found.' } });
  const showContact = ['CONFIRMED', 'EN_ROUTE_PICKUP', 'ARRIVED_HOMESTAY', 'TRIP_STARTED', 'COMPLETED'].includes(doc.status);
  return res.json({
    id: doc.tripId ?? null,
    reference: doc.reference,
    status: doc.status,
    agreedFare: doc.agreedFare,
    advanceAmount: doc.advanceAmount,
    advancePaid: doc.advancePaid,
    advanceDueAt: doc.advanceDueAt || null,
    remainingCashAmount: doc.remainingCashAmount,
    paymentLinkUrl: doc.paymentLinkUrl || null,
    driverName: doc.assignedDriverName || '',
    driverPhone: showContact ? doc.assignedDriverPhone || '' : '',
    vehicle: [doc.vehicleDetails?.model, doc.vehicleDetails?.plate].filter(Boolean).join(' '),
    pickup: doc.pickup || '',
    destinations: doc.destinations || [],
    date: doc.date,
    time: doc.time,
    passengers: doc.passengers,
    vehicleType: doc.vehicleType,
    refundStatus: doc.refundStatus,
    cancellationReason: doc.status === 'CANCELLED' ? doc.cancellationReason || '' : '',
    guestRating: doc.guestRating || null,
    biddingFallback: Boolean(doc.biddingFallbackAlertSentAt),
  });
});

stayrideV1Router.post('/public/cab-requests/:reference/rate', async (req: Request, res: Response) => {
  const reference = String(req.params.reference);
  let isDemo = false;
  const link = await findGuestLink(req.query.t);
  if (link) {
    isDemo = isDemoKey(link.tenantKey);
  } else {
    const prodDoc = await cabModel(false).findOne({ reference }).select('_id').lean();
    if (!prodDoc && config.demoEnabled) {
      const demoDoc = await cabModel(true).findOne({ reference }).select('_id').lean();
      if (demoDoc) isDemo = true;
    }
  }
  const updated = await rateDriverByGuest(isDemo, reference, req.body);
  return res.json({ success: true, guestRating: updated.guestRating });
});

// ==========================================
// Clerk webhook (raw body, svix-signed)
// ==========================================
// ------------------------------------------------------------------------------------------------
// Driver quote page (signed link from the WhatsApp message): WhatsApp-only drivers quote without the
// app. The link is bound to one driver and one request; the view never shows guest contact details.
// ------------------------------------------------------------------------------------------------
async function quoteLinkDriver(token: unknown, res: Response) {
  const link = readDriverQuoteToken(token);
  if (!link) {
    res.status(404).json({ error: { message: 'This link is invalid or has expired.' } });
    return null;
  }
  if (link.isDemo && !config.demoEnabled) {
    res.status(404).json({ error: { message: 'This link is invalid or has expired.' } });
    return null;
  }
  let driver: any = null;
  if (link.isDemo && String(link.driverId) === 'demo-driver-1') {
    driver = { _id: 'demo-driver-1', name: 'Demo Driver', phone: '+919876543210', accountStatus: 'ACTIVE', role: 'driver' };
  } else if (mongoose.Types.ObjectId.isValid(link.driverId)) {
    driver = await getUserModel(link.isDemo).findOne({ _id: link.driverId, role: 'driver' }).lean();
  }
  if (!driver || driver.accountStatus !== 'ACTIVE') {
    res.status(403).json({ error: { message: 'Your driver account is not active. Contact StayRide support.', code: 'DRIVER_NOT_ACTIVE' } });
    return null;
  }
  return { ...link, driver };
}

const quotePageView = async (isDemo: boolean, reference: string, driver: any) => {
  const settings = await CommissionService.getSettings(isDemo);
  const quotesOn = CommissionService.globalFeatures(settings).driverQuotes.enabled;
  const doc: any = await cabModel(isDemo).findOne({ reference }).lean();
  if (!doc) return null;
  const view = driverTripView(doc, String(driver._id));
  return { ...view, driverName: driver.name, canQuote: quotesOn && view.driverView !== 'ASSIGNED' && OPEN_STATUSES.includes(doc.status) && doc.dispatched !== false };
};

stayrideV1Router.get('/public/driver-quote', async (req: Request, res: Response) => {
  const ctx = await quoteLinkDriver(req.query.t, res);
  if (!ctx) return;
  const view = await quotePageView(ctx.isDemo, ctx.reference, ctx.driver);
  return view ? res.json(view) : res.status(404).json({ error: { message: 'This trip is no longer available.' } });
});

stayrideV1Router.post('/public/driver-quote/quote', async (req: Request, res: Response) => {
  const ctx = await quoteLinkDriver(req.body?.t, res);
  if (!ctx) return;
  const settings = await CommissionService.getSettings(ctx.isDemo);
  if (!CommissionService.globalFeatures(settings).driverQuotes.enabled) {
    return res.status(403).json({ error: { message: 'Driver quotes are currently disabled by StayRide.', code: 'FEATURE_DISABLED' } });
  }
  await driverSubmitQuote(ctx.isDemo, ctx.reference, ctx.driver, req.body?.quotedFare, req.body?.notes);
  return res.json(await quotePageView(ctx.isDemo, ctx.reference, ctx.driver));
});

stayrideV1Router.post('/public/driver-quote/accept-counter', async (req: Request, res: Response) => {
  const ctx = await quoteLinkDriver(req.body?.t, res);
  if (!ctx) return;
  await driverAcceptCounter(ctx.isDemo, ctx.reference, ctx.driver);
  return res.json(await quotePageView(ctx.isDemo, ctx.reference, ctx.driver));
});

stayrideV1Router.post('/public/driver-quote/start', async (req: Request, res: Response) => {
  const ctx = await quoteLinkDriver(req.body?.t, res);
  if (!ctx) return;
  await startTrip(ctx.isDemo, { reference: ctx.reference, assignedDriverUserId: String(ctx.driver._id) }, `driver-web:${ctx.driver.name}`);
  return res.json(await quotePageView(ctx.isDemo, ctx.reference, ctx.driver));
});

stayrideV1Router.post('/public/driver-quote/complete', async (req: Request, res: Response) => {
  const ctx = await quoteLinkDriver(req.body?.t, res);
  if (!ctx) return;
  await completeTrip(ctx.isDemo, { reference: ctx.reference, assignedDriverUserId: String(ctx.driver._id) }, `driver-web:${ctx.driver.name}`);
  return res.json(await quotePageView(ctx.isDemo, ctx.reference, ctx.driver));
});

// Legal pages (app + web): public, so they can be read before signing up
stayrideV1Router.get('/public/legal/:doc', async (req: Request, res: Response) => {
  const doc = String(req.params.doc) as LegalDoc;
  if (!LEGAL_DOCS.includes(doc)) return res.status(404).json({ error: { message: 'Page not found.' } });
  const cfg = await CommissionService.getPlatformConfig(false);
  return res.json({ ...legalDocument(doc, cfg.business), business: cfg.business });
});

// Room calendar for Airbnb / Booking.com to read (secret link; busy dates only, no guest details).
stayrideV1Router.get('/public/ical/:token', async (req: Request, res: Response) => {
  const found = await storeForExportToken(String(req.params.token).replace(/\.ics$/, ''));
  if (!found) return res.status(404).type('text/plain').send('Calendar not found.');
  res.set('Cache-Control', 'no-store');
  return res.type('text/calendar; charset=utf-8').send(buildIcs(found.store, found.feed.roomId));
});

// Scheduled calendar sync (call every 15-60 min from any scheduler with Authorization: Bearer CRON_SECRET).
stayrideV1Router.get('/cron/ical-sync', async (req: Request, res: Response) => {
  const secret = process.env.CRON_SECRET || '';
  const given = String(req.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!secret || given.length !== secret.length || !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return res.status(401).json({ error: { message: 'Unauthorized' } });
  }
  return res.json({ ok: true, ...(await syncAll(false)) });
});

// Razorpay payment-link webhook (raw body; signature checked before anything is read).
stayrideV1Router.post('/webhooks/razorpay', async (req: Request, res: Response) => {
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
  if (!verifyWebhookSignature(raw, req.get('X-Razorpay-Signature'))) {
    return res.status(400).json({ error: { message: 'Invalid signature.' } });
  }
  let event: any;
  try {
    event = JSON.parse(raw.toString('utf8'));
  } catch {
    return res.status(400).json({ error: { message: 'Invalid payload.' } });
  }
  if (event?.event !== 'payment_link.paid') return res.json({ ok: true, ignored: true });
  const link = event.payload?.payment_link?.entity;
  const payment = event.payload?.payment?.entity;
  const result = await recordGatewayPayment(String(link?.id || ''), String(payment?.id || ''), Number(payment?.amount) / 100);
  return res.json({ ok: true, result });
});

stayrideV1Router.post('/auth/clerk-webhook', async (req: Request, res: Response) => {
  if (!config.clerkWebhookSecret) {
    return res.status(503).json({ error: { message: 'Webhook signing secret is not configured.' } });
  }

  let event: any;
  try {
    event = await verifyWebhook(req, { signingSecret: config.clerkWebhookSecret });
  } catch {
    return res.status(400).json({ error: { message: 'Webhook signature verification failed.' } });
  }

  try {
    const UserModel = getUserModel(false);
    const { type, data } = event;

    if (type === 'user.created' || type === 'user.updated') {
      const clerkId = data.id;
      const primary =
        data.email_addresses?.find((e: any) => e.id === data.primary_email_address_id) || data.email_addresses?.[0];
      const name = [data.first_name, data.last_name].filter(Boolean).join(' ') || data.username || 'Host';
      const avatar = data.image_url || '';

      if (primary?.email_address && primary.verification?.status === 'verified') {
        const cleanEmail = primary.email_address.toLowerCase().trim();
        if (isReservedEmail(cleanEmail)) return res.json({ received: true, ignored: 'reserved email' });
        let user =
          (await UserModel.findOne({ clerkId })) ||
          (await UserModel.findOne({ email: cleanEmail, $or: [{ clerkId: { $exists: false } }, { clerkId: '' }] }));
        // Accounts are created only by /auth/clerk-sync, which knows the role the user picked in the
        // app (a driver must land in PENDING_APPROVAL, never as an owner). The webhook only updates.
        if (user) {
          user.name = name;
          user.avatar = avatar;
          user.clerkId = clerkId;
          await user.save();
        }
      }
    } else if (type === 'user.deleted') {
      const clerkId = data.id;
      if (clerkId) {
        // Keep the account record (money history); just block sign-in.
        await UserModel.updateOne({ clerkId }, { $set: { accountStatus: 'BLOCKED', statusReason: 'Deleted in Clerk' } });
      }
    }

    return res.json({ received: true });
  } catch (err: any) {
    console.error('[StayRide] Webhook handling error:', err?.message);
    return res.status(500).json({ error: { message: 'Webhook processing failed.' } });
  }
});

// Everything below requires a valid StayRide/Clerk session.
stayrideV1Router.use(authenticateStayRide);
// Cloudinary uploads and client error reports: signed-in app users only
stayrideV1Router.use('/upload', uploadRoutes);
stayrideV1Router.use('/telemetry', telemetryRoutes);

// ==========================================
// Change password for email/password (non-Clerk) accounts.
// ==========================================
stayrideV1Router.post('/auth/set-password', async (req: Request, res: Response) => {
  const authUser = authOf(req);
  if (isDemoKey(authUser.tenantKey)) {
    return res.status(403).json({ error: { message: 'The demo account password cannot be changed.' } });
  }
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 8) {
    return res.status(400).json({ error: { message: 'Password must be at least 8 characters long.' } });
  }
  const user = mongoose.Types.ObjectId.isValid(authUser.id) ? await getUserModel(false).findById(authUser.id) : null;
  if (!user) return res.status(404).json({ error: { message: 'User account not found.' } });
  if (typeof currentPassword !== 'string' || !(await user.comparePassword(currentPassword.trim()))) {
    return res.status(401).json({ error: { message: 'Current password is incorrect.' } });
  }
  user.password = newPassword.trim(); // pre-save hook hashes once
  await user.save();
  return res.json({ success: true, message: 'Password updated successfully.' });
});

// S1: end every session of this account (all devices). Demo sessions are shared and can't be revoked.
stayrideV1Router.post('/auth/logout-all', async (req: Request, res: Response) => {
  const u = authOf(req);
  if (!isDemoKey(u.tenantKey) && mongoose.Types.ObjectId.isValid(u.id)) {
    await getUserModel(false).updateOne({ _id: u.id }, { $inc: { tokenVersion: 1 } });
  }
  return res.json({ ok: true });
});

// ==========================================
// Driver API (platform drivers approved by admin)
// ==========================================
const DEMO_DRIVER = { _id: 'demo-driver-1', name: 'Pemba Lepcha (Demo Driver)', phone: '', vehicle: { type: 'SUV', model: 'Demo SUV', plate: '' }, accountStatus: 'ACTIVE' };

async function loadDriver(req: Request): Promise<any> {
  const u = authOf(req);
  if (isDemoKey(u.tenantKey)) return DEMO_DRIVER;
  if (!mongoose.Types.ObjectId.isValid(u.id)) return null;
  return userModel(false).findOne({ _id: u.id, role: 'driver' }).lean();
}

const driverProfile = (d: any) => ({
  id: String(d._id),
  name: d.name,
  phone: d.phone || '',
  email: d.email || '',
  vehicleType: d.vehicle?.type || '',
  vehicle: d.vehicle?.model || '',
  plate: d.vehicle?.plate || '',
  area: d.vehicle?.area || '',
  seats: d.vehicle?.seats || 0,
  status: d.accountStatus, // ACTIVE | PENDING_APPROVAL | BLOCKED
  available: d.accountStatus === 'ACTIVE' && d.isAvailable !== false,
  active: d.accountStatus === 'ACTIVE',
});

async function driverTrips(isDemo: boolean, driver: any) {
  const settings = await CommissionService.getSettings(isDemo);
  const quotesOn = CommissionService.globalFeatures(settings).driverQuotes.enabled && driver.isAvailable !== false;
  return listDriverTrips(isDemo, driver, quotesOn);
}

/** Drivers: must be approved (ACTIVE) for any driver action. */
async function driverGate(req: Request, res: Response, next: () => void) {
  if (authOf(req).role !== 'driver') return res.status(403).json({ error: { message: 'Driver account required.', code: 'FORBIDDEN' } });
  const driver = await loadDriver(req);
  if (!driver || driver.accountStatus === 'BLOCKED') {
    return res.status(403).json({ error: { message: 'Your driver account is blocked. Contact StayRide support.', code: 'ACCOUNT_BLOCKED' } });
  }
  if (driver.accountStatus !== 'ACTIVE') {
    return res.status(403).json({ error: { message: 'Your driver account is awaiting approval by StayRide.', code: 'DRIVER_NOT_APPROVED' } });
  }
  (req as any).driver = driver;
  next();
}

// Driver snapshot (owners fall through to the owner snapshot below).
stayrideV1Router.get('/snapshot', async (req: Request, res: Response, next: () => void) => {
  if (authOf(req).role !== 'driver') return next();
  const driver = await loadDriver(req);
  if (!driver || driver.accountStatus === 'BLOCKED') {
    return res.status(403).json({ error: { message: 'Your driver account is blocked. Contact StayRide support.', code: 'ACCOUNT_BLOCKED' } });
  }
  const trips = driver.accountStatus === 'ACTIVE' ? await driverTrips(isDemoKey(authOf(req).tenantKey), driver) : [];
  return res.json({
    driverProfile: driverProfile(driver),
    config: publicConfig(await CommissionService.getPlatformConfig(isDemoKey(authOf(req).tenantKey))),
    homestay: null,
    rooms: [],
    guests: [],
    bookings: [],
    drivers: [],
    networkDrivers: [],
    trips,
    campaigns: [],
  });
});

stayrideV1Router.patch('/driver/availability', driverGate, async (req: Request, res: Response) => {
  const isDemo = isDemoKey(authOf(req).tenantKey);
  const available = req.body?.available !== false;
  if (!isDemo) {
    await getUserModel(false).updateOne({ _id: (req as any).driver._id }, { $set: { isAvailable: available } });
  }
  res.json({ success: true, available });
});

stayrideV1Router.patch('/driver/whatsapp-alerts', driverGate, async (req: Request, res: Response) => {
  const isDemo = isDemoKey(authOf(req).tenantKey);
  const enabled = req.body?.enabled !== false;
  if (!isDemo) {
    await getUserModel(false).updateOne({ _id: (req as any).driver._id }, { $set: { whatsappAlerts: enabled } });
  }
  res.json({ success: true, whatsappAlerts: enabled });
});

// Driver app reports where the driver is, so "nearby" requests are really nearby.
stayrideV1Router.patch('/driver/location', driverGate, async (req: Request, res: Response) => {
  const lat = Number(req.body?.lat);
  const lng = Number(req.body?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return res.status(400).json({ error: { message: 'A valid location is required.', code: 'VALIDATION' } });
  }
  if (!isDemoKey(authOf(req).tenantKey)) {
    await getUserModel(false).updateOne({ _id: (req as any).driver._id }, { $set: { location: { lat, lng, updatedAt: new Date() } } });
  }
  res.json({ ok: true });
});

stayrideV1Router.get('/driver/trips', driverGate, async (req: Request, res: Response) => {
  res.json(await driverTrips(isDemoKey(authOf(req).tenantKey), (req as any).driver));
});

stayrideV1Router.post('/driver/trips/:reference/quote', driverGate, async (req: Request, res: Response) => {
  const isDemo = isDemoKey(authOf(req).tenantKey);
  const settings = await CommissionService.getSettings(isDemo);
  if (!CommissionService.globalFeatures(settings).driverQuotes.enabled) {
    return res.status(403).json({ error: { message: 'Driver quotes are currently disabled by StayRide.', code: 'FEATURE_DISABLED' } });
  }
  const updated = await driverSubmitQuote(isDemo, String(req.params.reference), (req as any).driver, req.body?.quotedFare, req.body?.notes);
  res.json(driverTripView(updated, String((req as any).driver._id)));
});

stayrideV1Router.post('/driver/trips/:reference/accept-counter', driverGate, async (req: Request, res: Response) => {
  const isDemo = isDemoKey(authOf(req).tenantKey);
  const updated = await driverAcceptCounter(isDemo, String(req.params.reference), (req as any).driver);
  res.json(driverTripView(updated, String((req as any).driver._id)));
});

stayrideV1Router.post('/driver/trips/:reference/start', driverGate, async (req: Request, res: Response) => {
  const isDemo = isDemoKey(authOf(req).tenantKey);
  const updated = await startTrip(isDemo, { reference: String(req.params.reference), assignedDriverUserId: String((req as any).driver._id) }, authOf(req).email);
  res.json(driverTripView(updated, String((req as any).driver._id)));
});

stayrideV1Router.post('/driver/trips/:reference/complete', driverGate, async (req: Request, res: Response) => {
  const isDemo = isDemoKey(authOf(req).tenantKey);
  const updated = await completeTrip(isDemo, { reference: String(req.params.reference), assignedDriverUserId: String((req as any).driver._id) }, authOf(req).email);
  res.json(driverTripView(updated, String((req as any).driver._id)));
});

// ==========================================
// Push tokens (owners and drivers, including drivers awaiting approval)
// ==========================================
const EXPO_TOKEN = /^Expo(nent)?PushToken\[[^\]\s]{1,200}\]$/;

async function pushTokenUser(req: Request, res: Response): Promise<any | null | undefined> {
  const u = authOf(req);
  if (isDemoKey(u.tenantKey)) return null; // demo: accepted, never stored
  const user: any = mongoose.Types.ObjectId.isValid(u.id) ? await getUserModel(false).findById(u.id).select('accountStatus role').lean() : null;
  if (!user || user.accountStatus === 'BLOCKED' || user.role !== u.role) {
    res.status(403).json({ error: { message: 'This account is blocked. Contact StayRide support.', code: 'ACCOUNT_BLOCKED' } });
    return undefined;
  }
  return user;
}

stayrideV1Router.post('/push-token', async (req: Request, res: Response) => {
  const token = req.body?.token;
  const platform = req.body?.platform;
  if (typeof token !== 'string' || !EXPO_TOKEN.test(token)) return res.status(400).json({ error: { message: 'A valid Expo push token is required.', code: 'VALIDATION' } });
  if (platform !== 'android' && platform !== 'ios') return res.status(400).json({ error: { message: "Platform must be 'android' or 'ios'.", code: 'VALIDATION' } });
  const user = await pushTokenUser(req, res);
  if (user === undefined) return;
  if (user) {
    // One atomic update: drop this token if present, append it, keep the newest 10.
    await getUserModel(false).collection.updateOne({ _id: user._id }, [
      {
        $set: {
          pushTokens: {
            $slice: [
              {
                $concatArrays: [
                  { $filter: { input: { $ifNull: ['$pushTokens', []] }, cond: { $ne: ['$$this.token', { $literal: token }] } } },
                  [{ token: { $literal: token }, platform, updatedAt: '$$NOW' }],
                ],
              },
              -10,
            ],
          },
        },
      },
    ]);
  }
  res.json({ ok: true });
});

stayrideV1Router.delete('/push-token', async (req: Request, res: Response) => {
  const token = req.body?.token;
  if (typeof token !== 'string' || !token || token.length > 250) return res.status(400).json({ error: { message: 'token is required.', code: 'VALIDATION' } });
  const user = await pushTokenUser(req, res);
  if (user === undefined) return;
  if (user) await getUserModel(false).updateOne({ _id: user._id }, { $pull: { pushTokens: { token } } });
  res.json({ ok: true });
});

// Delete my account (owners and drivers): required by the app stores. Immediate and irreversible:
// sign-in is removed, personal profile data is erased, and money/trip records are kept as the law requires.
stayrideV1Router.post('/account/delete', async (req: Request, res: Response) => {
  const u = authOf(req);
  if (isDemoKey(u.tenantKey)) return res.status(400).json({ error: { message: 'The demo account cannot be deleted.' } });
  if (req.body?.confirm !== 'DELETE') return res.status(400).json({ error: { message: 'Type DELETE to confirm.', code: 'CONFIRM_REQUIRED' } });
  const Users = getUserModel(false);
  const user: any = mongoose.Types.ObjectId.isValid(u.id) ? await Users.findById(u.id).lean() : null;
  if (!user || (user.role !== 'owner' && user.role !== 'driver')) return res.status(404).json({ error: { message: 'Account not found.' } });
  await Users.updateOne(
    { _id: user._id },
    {
      $set: { accountStatus: 'BLOCKED', statusReason: 'Deleted by the user', deletedAt: new Date(), name: 'Deleted user', phone: '', avatar: '', pushTokens: [], location: null },
      $unset: { clerkId: '' },
      $inc: { tokenVersion: 1 }, // ends every session
    }
  );
  if (user.role === 'driver') await onDriverStatusChange(false, String(user._id), 'BLOCKED', `user:${user._id}`);
  if (user.clerkId && config.clerkSecretKey) {
    await clerkClient.users.deleteUser(user.clerkId).catch((err: any) => console.warn('[StayRide] Clerk user delete failed:', err?.message));
  }
  await audit(`user:${user._id}`, 'user.self_delete', 'User', String(user._id), { role: user.role }, false);
  return res.json({ ok: true });
});

// ==========================================
// Homestay-owner API. Admin controls (block / feature switches) are enforced here for every route.
// ==========================================
stayrideV1Router.use(async (req: Request, res: Response, next: () => void) => {
  const u = authOf(req);
  if (u.role === 'driver') {
    return res.status(403).json({ error: { message: 'This action is for homestay owners only.', code: 'FORBIDDEN' } });
  }
  // Admin can block the person (User.accountStatus) or the homestay (TenantControl); both stop access now.
  if (!isDemoKey(u.tenantKey)) {
    const user: any = (req as any).stayrideAccount;
    if (user?.accountStatus === 'PENDING_APPROVAL') {
      return res.status(403).json({ error: { message: 'Your homestay account is pending approval by StayRide.', code: 'OWNER_NOT_APPROVED' } });
    }
    if (!user || user.accountStatus !== 'ACTIVE' || user.role !== 'owner') {
      return res.status(403).json({ error: { message: 'This account is blocked. Contact StayRide support.', code: 'ACCOUNT_BLOCKED' } });
    }
  }
  const account = await CommissionService.getAccountState(u.tenantKey, isDemoKey(u.tenantKey));
  if (account.blocked) {
    return res.status(403).json({
      error: { message: `Your homestay account is suspended by StayRide${account.blockReason ? `: ${account.blockReason}` : '.'}`, code: 'ACCOUNT_BLOCKED' },
    });
  }
  (req as any).account = account;
  next();
});

const requireFeature = (key: FeatureKey) => (req: Request, res: Response, next: () => void) => {
  if ((req as any).account?.features?.[key]) return next();
  return res.status(403).json({ error: { message: 'This feature is not enabled for your homestay. You can request access from StayRide.', code: 'FEATURE_DISABLED', feature: key } });
};

// O1: Idempotency-Key on owner create endpoints. Same tenant + key within 24h replays the stored
// 2xx status+body; nothing is created twice. Concurrent duplicates get 409 IDEMPOTENCY_IN_PROGRESS.
stayrideV1Router.post(
  ['/bookings', '/rooms', '/guests', '/drivers', '/trips', '/guest-links', '/guest-links/send', '/payouts/request', '/appeals', '/trips/:id/rate', '/bookings/:id/payments'],
  async (req: Request, res: Response, next: (err?: any) => void) => {
    const { tenantKey, isDemo } = tenantOf(req);
    const outcome = await beginIdempotent(req.get('Idempotency-Key'), tenantKey, isDemo, `${req.method} ${req.path}`);
    if (outcome.kind === 'none') return next();
    if (outcome.kind === 'replay') return res.status(outcome.status).json(outcome.body);
    const json = res.json.bind(res);
    res.json = (body: any) => {
      // Record the result BEFORE replying: a serverless instance may freeze right after the response.
      outcome.finish(res.statusCode, body).then(() => json(body), (err: any) => {
        console.error('[StayRide] idempotency record failed:', err?.message);
        json(body);
      });
      return res;
    };
    next();
  }
);

const loadReqStore = (req: Request) => tenantManager.load(authOf(req).tenantKey);
const mutateReq = <T>(req: Request, fn: (s: StayRideMemoryStore) => T) => tenantManager.mutate(authOf(req).tenantKey, fn);
const notFound = (res: Response, what: string) => res.status(404).json({ error: { message: `${what} not found` } });

// ==========================================
// Snapshot (owner)
// ==========================================
stayrideV1Router.get('/snapshot', async (req: Request, res: Response) => {
  const { tenantKey, isDemo } = tenantOf(req);
  const store = await loadReqStore(req);
  const account = (req as any).account;
  const rates = await CommissionService.getEffectiveRates(tenantKey, isDemo);
  res.json({
    account: { blocked: false, features: account.features },
    config: publicConfig(await CommissionService.getPlatformConfig(isDemo)),
    commissionRates: { pfPercent: rates.pfPercent, hcPercent: rates.hcPercent, advancePercent: rates.advancePercent, minAdvanceAmount: rates.minAdvanceAmount },
    homestay: store.homestay,
    rooms: store.roomsView(),
    guests: store.guests,
    bookings: store.bookings,
    drivers: store.drivers,
    networkDrivers: isDemo ? store.networkDrivers : [],
    trips: await overlayTrips(tenantKey, isDemo, store.trips, { complete: true }),
    campaigns: account.features.campaigns ? store.campaigns : [],
  });
});

// ==========================================
// Homestay Profile
// ==========================================
stayrideV1Router.get('/homestay', async (req: Request, res: Response) => {
  res.json((await loadReqStore(req)).homestay);
});

stayrideV1Router.put('/homestay', async (req: Request, res: Response) => {
  for (const key of ['checkInTime', 'checkOutTime'] as const) {
    const v = req.body?.[key];
    if (v !== undefined && v !== '' && parseTime12(v) === null) {
      return res.status(400).json({ error: { message: 'Times must look like 12:00 PM.', code: 'VALIDATION' } });
    }
  }
  res.json(await mutateReq(req, (s) => Object.assign(s.homestay, clean('homestay', req.body, s.homestay.photos))));
});

// Owner pins the homestay on the map. Saved on the homestay and on the property record, so nearby
// drivers are matched from the real spot (also for owners who skipped GPS at signup).
stayrideV1Router.put('/homestay/location', async (req: Request, res: Response) => {
  const { tenantKey, isDemo } = tenantOf(req);
  const lat = Number(req.body?.latitude);
  const lng = Number(req.body?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) {
    return res.status(400).json({ error: { message: 'Pick a valid location on the map.', code: 'VALIDATION' } });
  }
  const address = str(req.body?.address, 200);
  const homestay = await mutateReq(req, (s) => {
    s.homestay.latitude = lat;
    s.homestay.longitude = lng;
    s.homestay.mapQuery = `${lat},${lng}`;
    if (address) s.homestay.location = address; // the address is the one under the confirmed pin
    return s.homestay;
  });
  if (!isDemo) {
    await getPropertyModel(false).updateOne({ email: tenantKey }, { $set: { coordinates: { latitude: lat, longitude: lng } } });
  }
  res.json(homestay);
});

// ==========================================
// Rooms
// ==========================================
stayrideV1Router.get('/rooms', async (req: Request, res: Response) => {
  res.json((await loadReqStore(req)).roomsView());
});

stayrideV1Router.post('/rooms', async (req: Request, res: Response) => {
  res.status(201).json(await mutateReq(req, (s) => s.createRoom(req.body)));
});

stayrideV1Router.put('/rooms/:id', async (req: Request, res: Response) => {
  const updated = await mutateReq(req, (s) => s.updateRoom(Number(req.params.id), req.body));
  return updated ? res.json(updated) : notFound(res, 'Room');
});

stayrideV1Router.patch('/rooms/:id/status', async (req: Request, res: Response) => {
  const updated = await mutateReq(req, (s) => s.updateRoom(Number(req.params.id), { status: req.body.status }));
  return updated ? res.json(updated) : notFound(res, 'Room');
});

stayrideV1Router.delete('/rooms/:id', async (req: Request, res: Response) => {
  await mutateReq(req, (s) => s.deleteRoom(Number(req.params.id)));
  res.json({ success: true });
});

// Calendar sync with Airbnb / Booking.com for one room
const icalView = (req: Request, feed: any) => {
  const base = (process.env.PUBLIC_API_URL || `${req.get('x-forwarded-proto') || req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
  const prefix = req.baseUrl || '/v1';
  return {
    exportUrl: `${base}${prefix}/public/ical/${feed.exportToken}.ics`,
    imports: (feed.imports || []).map((i: any) => ({ id: i.id, url: i.url, source: i.source, lastSyncAt: i.lastSyncAt, lastError: i.lastError, eventCount: i.eventCount })),
  };
};
const roomOr404 = async (req: Request, res: Response) => {
  const room = (await loadReqStore(req)).room(Number(req.params.id));
  if (!room) notFound(res, 'Room');
  return room;
};

stayrideV1Router.get('/rooms/:id/ical', async (req: Request, res: Response) => {
  const { tenantKey, isDemo } = tenantOf(req);
  if (!(await roomOr404(req, res))) return;
  res.json(icalView(req, await feedFor(tenantKey, isDemo, Number(req.params.id))));
});

stayrideV1Router.put('/rooms/:id/ical', async (req: Request, res: Response) => {
  const { tenantKey, isDemo } = tenantOf(req);
  if (!(await roomOr404(req, res))) return;
  const feed = await setImports(tenantKey, isDemo, Number(req.params.id), req.body?.importUrls);
  const synced = feed.imports.length ? await syncRoom(tenantKey, isDemo, Number(req.params.id)) : { feed, results: [] };
  res.json({ ...icalView(req, synced.feed || feed), results: synced.results });
});

stayrideV1Router.post('/rooms/:id/ical/sync', async (req: Request, res: Response) => {
  const { tenantKey, isDemo } = tenantOf(req);
  if (!(await roomOr404(req, res))) return;
  const { feed, results } = await syncRoom(tenantKey, isDemo, Number(req.params.id));
  res.json({ ...icalView(req, feed || (await feedFor(tenantKey, isDemo, Number(req.params.id)))), results });
});

// ==========================================
// Guests
// ==========================================
stayrideV1Router.get('/guests', async (req: Request, res: Response) => {
  res.json((await loadReqStore(req)).guests);
});

stayrideV1Router.post('/guests', async (req: Request, res: Response) => {
  res.status(201).json(await mutateReq(req, (s) => s.createGuest(req.body)));
});

stayrideV1Router.put('/guests/:id', async (req: Request, res: Response) => {
  const updated = await mutateReq(req, (s) => s.updateGuest(Number(req.params.id), req.body));
  return updated ? res.json(updated) : notFound(res, 'Guest');
});

stayrideV1Router.delete('/guests/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const result = await mutateReq(req, (s) => {
    if (s.bookings.some((b) => b.guestId === id && (b.status === 'CONFIRMED' || b.status === 'CHECKED_IN'))) return 'HAS_BOOKINGS';
    const before = s.guests.length;
    s.guests = s.guests.filter((g) => g.id !== id);
    return before === s.guests.length ? 'NOT_FOUND' : 'OK';
  });
  if (result === 'NOT_FOUND') return notFound(res, 'Guest');
  if (result === 'HAS_BOOKINGS') return res.status(409).json({ error: { message: 'This guest has an active booking. Cancel or check out the booking first.' } });
  res.json({ success: true });
});

// ==========================================
// Bookings
// ==========================================
stayrideV1Router.get('/bookings', async (req: Request, res: Response) => {
  res.json((await loadReqStore(req)).bookings);
});

stayrideV1Router.post('/bookings', async (req: Request, res: Response) => {
  const { tenantKey, isDemo } = tenantOf(req);
  const created = await mutateReq(req, (s) => s.createBooking(req.body));
  res.status(201).json(created);

  // Automated Ask-for-Cab WhatsApp on booking creation
  if (created?.phone) {
    loadReqStore(req)
      .then((store) =>
        sendAskCab(tenantKey, isDemo, store.homestay.name, {
          guestId: created.guestId ?? created.id,
          guestName: created.guestName || 'Guest',
          guestPhone: created.phone,
        })
      )
      .catch((err) => {
        console.warn(`[Auto-AskCab] Booking notice for ${created.guestName}:`, err?.message);
      });
  }
});

const bookingAction = (fn: (s: StayRideMemoryStore, id: number, body: any) => any) => async (req: Request, res: Response) => {
  const b = await mutateReq(req, (s) => fn(s, Number(req.params.id), req.body));
  return b ? res.json(b) : notFound(res, 'Booking');
};
stayrideV1Router.post('/bookings/:id/check-in', async (req: Request, res: Response) => {
  const { tenantKey, isDemo } = tenantOf(req);
  const b = await mutateReq(req, (s) => s.checkInBooking(Number(req.params.id)));
  if (!b) return notFound(res, 'Booking');
  res.json(b);

  // Automated Ask-for-Cab WhatsApp on check-in (cooldown safely suppresses if already sent recently)
  if (b?.phone) {
    loadReqStore(req)
      .then((store) =>
        sendAskCab(tenantKey, isDemo, store.homestay.name, {
          guestId: b.guestId ?? b.id,
          guestName: b.guestName || 'Guest',
          guestPhone: b.phone,
        })
      )
      .catch((err) => {
        console.warn(`[Auto-AskCab] Check-in notice for ${b.guestName}:`, err?.message);
      });
  }
});
stayrideV1Router.post('/bookings/:id/check-out', bookingAction((s, id) => s.checkOutBooking(id)));
stayrideV1Router.post('/bookings/:id/cancel', bookingAction((s, id) => s.cancelBooking(id)));
stayrideV1Router.patch('/bookings/:id/payment', bookingAction((s, id, body) => s.setBookingPaid(id, Boolean(body?.paid))));
stayrideV1Router.post('/bookings/:id/room', bookingAction((s, id, body) => s.changeBookingRoom(id, body?.roomNumber)));
stayrideV1Router.patch('/bookings/:id', bookingAction((s, id, body) => s.editBooking(id, body || {})));
stayrideV1Router.post('/bookings/:id/payments', bookingAction((s, id, body) => s.addPayment(id, body || {})));
stayrideV1Router.delete('/bookings/:id/payments/:paymentId', async (req: Request, res: Response) => {
  const b = await mutateReq(req, (s) => s.removePayment(Number(req.params.id), Number(req.params.paymentId)));
  return b ? res.json(b) : notFound(res, 'Booking');
});

stayrideV1Router.delete('/bookings/:id', async (req: Request, res: Response) => {
  await mutateReq(req, (s) => s.deleteBooking(Number(req.params.id)));
  res.json({ success: true });
});

// ==========================================
// My Drivers (the homestay's own driver contacts; no platform accounts, no money)
// ==========================================
stayrideV1Router.get('/drivers', async (req: Request, res: Response) => {
  const store = await loadReqStore(req);
  if (req.query.scope === 'network') return res.json(tenantOf(req).isDemo ? store.networkDrivers : []);
  res.json(store.drivers);
});

stayrideV1Router.post('/drivers', async (req: Request, res: Response) => {
  if (!str(req.body.name, 100) || !str(req.body.phone, 20)) {
    return res.status(400).json({ error: { message: 'Driver name and phone are required.' } });
  }
  res.status(201).json(await mutateReq(req, (s) => s.createDriver({ ...req.body, rating: 0 })));
});

const driverAction = (fn: (s: StayRideMemoryStore, id: number, body: any) => any) => async (req: Request, res: Response) => {
  const d = await mutateReq(req, (s) => fn(s, Number(req.params.id), req.body));
  return d ? res.json(d) : notFound(res, 'Driver');
};
stayrideV1Router.put('/drivers/:id', driverAction((s, id, body) => s.updateDriver(id, body)));
stayrideV1Router.patch('/drivers/:id/availability', driverAction((s, id, body) => s.updateDriver(id, { available: Boolean(body?.available) })));
stayrideV1Router.patch('/drivers/:id/active', driverAction((s, id, body) => s.updateDriver(id, { active: Boolean(body?.active) })));

stayrideV1Router.delete('/drivers/:id', async (req: Request, res: Response) => {
  await mutateReq(req, (s) => s.deleteDriver(Number(req.params.id)));
  res.json({ success: true });
});

// ==========================================
// Trips
//  - OWN_DRIVER trips: the homestay's own business; no platform money, no admin queue.
//  - PLATFORM trips: a CabRequest is the source of truth; owners can confirm a driver quote or
//    cancel, but only admin / the assigned driver move money or completion.
// ==========================================
const PLATFORM_MANAGED = { error: { message: 'This trip is managed by StayRide (platform trip).', code: 'PLATFORM_MANAGED' } };

async function overlayOne(req: Request, trip: any) {
  const { tenantKey, isDemo } = tenantOf(req);
  return (await overlayTrips(tenantKey, isDemo, [trip]))[0];
}

stayrideV1Router.get('/trips', async (req: Request, res: Response) => {
  const { tenantKey, isDemo } = tenantOf(req);
  const store = await loadReqStore(req);
  res.json(await overlayTrips(tenantKey, isDemo, store.trips, { complete: true }));
});

stayrideV1Router.post('/trips', async (req: Request, res: Response) => {
  const { tenantKey, isDemo } = tenantOf(req);
  const input = tripInput(req.body);
  if (!input.guestName || !input.phone) return res.status(400).json({ error: { message: 'Guest name and phone are required.' } });
  const cfg = await CommissionService.getPlatformConfig(isDemo);
  const inputError = vehicleError(cfg, input.vehicleType) || validateSchedule(input, cfg);
  if (inputError) return res.status(400).json({ error: { message: inputError } });
  const platform = req.body.dispatchMode === 'PLATFORM';
  if (platform && !(req as any).account.features.platformDispatch) {
    return res.status(403).json({ error: { message: 'Sending requests to StayRide drivers is not enabled for your homestay.', code: 'FEATURE_DISABLED', feature: 'platformDispatch' } });
  }
  const make = (s: StayRideMemoryStore) => withEstimate(cfg, s.createTrip({ ...input, pickup: input.pickup || s.homestay.location || s.homestay.name }));
  // Every trip is a StayRide request now (StayRide earns on own-fleet trips too). An own-driver booking
  // is created held (drivers never see it) and the owner then assigns their driver with the fare.
  const trip = (await createPlatformTrip(tenantKey, isDemo, make, 'MANUAL_OWNER', null, platform ? {} : { dispatched: false })).trip;
  res.status(201).json(await overlayOne(req, trip));
});

const vehicleError = (cfg: PlatformConfig, type: string) =>
  cfg.vehicles[type as keyof PlatformConfig['vehicles']]?.enabled === false ? 'This vehicle type is not available right now.' : null;

/** Display estimate from the admin's vehicle settings (the real fare always comes from a quote). */
const withEstimate = (cfg: PlatformConfig, t: any) => {
  const est = cfg.vehicles[t.vehicleType as keyof PlatformConfig['vehicles']]?.estFare;
  if (typeof est === 'number') t.estFare = est;
  return t;
};

/** Own-fleet StayRide request of this owner, or null (then the owner-only trip rules apply). */
async function ownFleetDoc(tenantKey: string, isDemo: boolean, trip: any) {
  if (!trip?.reference) return null;
  const doc: any = await cabModel(isDemo).findOne({ reference: trip.reference, propertyId: tenantKey }).select('ownFleet').lean();
  return doc?.ownFleet ? doc : null;
}

/** Start/complete: own drivers may not have the app, so the owner records these for own-fleet trips. */
const ownFleetOrOwnTrip = (kind: 'start' | 'complete', fn: (s: StayRideMemoryStore, id: number, body: any) => any) => async (req: Request, res: Response) => {
  const { tenantKey, isDemo, actor } = tenantOf(req);
  const store = await loadReqStore(req);
  const trip = store.trip(Number(req.params.id));
  if (!trip) return notFound(res, 'Trip');
  if (await ownFleetDoc(tenantKey, isDemo, trip)) {
    const filter = { reference: trip.reference, propertyId: tenantKey, ownFleet: true };
    if (kind === 'start') await startTrip(isDemo, filter, actor);
    else await completeTrip(isDemo, filter, actor);
    return res.json(await overlayOne(req, trip));
  }
  // StayRide driver trip the driver forgot to close (rules in ownerCompleteTrip)
  if (trip.reference && kind === 'complete') {
    await ownerCompleteTrip(tenantKey, isDemo, trip.reference, actor);
    return res.json(await overlayOne(req, trip));
  }
  return ownTripAction(fn)(req, res);
};

/** Owner action on an OWN_DRIVER trip; refused for platform trips. */
const ownTripAction = (fn: (s: StayRideMemoryStore, id: number, body: any) => any) => async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const store = await loadReqStore(req);
  const trip = store.trip(id);
  if (!trip) return notFound(res, 'Trip');
  if (trip.reference) return res.status(409).json(PLATFORM_MANAGED);
  const updated = await mutateReq(req, (s) => {
    const t = s.trip(id);
    if (!t || t.reference) return null;
    return fn(s, id, req.body);
  });
  return updated ? res.json(updated) : res.status(409).json(PLATFORM_MANAGED);
};

stayrideV1Router.post('/trips/:id/accept', ownTripAction((s, id) => s.acceptTrip(id)));
stayrideV1Router.post('/trips/:id/reassign', ownTripAction((s, id) => s.reassignTrip(id)));
stayrideV1Router.post('/trips/:id/start', ownFleetOrOwnTrip('start', (s, id) => s.startTrip(id)));
stayrideV1Router.post('/trips/:id/complete', ownFleetOrOwnTrip('complete', (s, id, body) => s.completeTrip(id, body?.finalFare)));
stayrideV1Router.post('/trips/:id/quote', ownTripAction((s, id, body) => {
  // Owner records a quote from one of their OWN drivers.
  const driverId = Number(body?.driverId);
  if (!s.driver(driverId)) throw Object.assign(new Error('Choose one of your own drivers.'), { status: 400 });
  return s.quoteTrip(id, driverId, parseFare(body?.quotedFare));
}));

// Assign one of the homestay's own drivers, with the fare agreed with that driver. StayRide charges its
// own-fleet fee through the guest's advance (see assignOwnFleet); quotes from nearby drivers are closed.
stayrideV1Router.post('/trips/:id/assign', async (req: Request, res: Response) => {
  const { tenantKey, isDemo, actor } = tenantOf(req);
  const id = Number(req.params.id);
  const driverId = Number(req.body?.driverId);
  const store = await loadReqStore(req);
  const trip = store.trip(id);
  if (!trip) return notFound(res, 'Trip');
  const driver: any = store.driver(driverId) || (isDemo ? store.networkDrivers.find((d) => d.id === driverId) : null);
  if (!driver) return res.status(400).json({ error: { message: 'Choose one of your own drivers.' } });
  if (req.body?.fare === undefined || req.body?.fare === null || req.body?.fare === '') {
    return res.status(400).json({ error: { message: 'Enter the fare agreed with your driver.', code: 'FARE_REQUIRED' } });
  }
  let reference = trip.reference;
  if (!reference) {
    // An old own-driver trip from before every trip went through StayRide: attach a request to it.
    const created = await createPlatformTrip(tenantKey, isDemo, (s) => s.trip(id), 'MANUAL_OWNER', `trip:own:${id}`, { dispatched: false }, true);
    reference = created.doc.reference as string;
    // a retried attach finds the request made the first time: point the trip at that one
    await mutateReq(req, (s) => {
      const t = s.trip(id);
      if (t) t.reference = reference;
    });
  }
  await assignOwnFleet(
    tenantKey,
    isDemo,
    reference as string,
    { id: driver.id, name: driver.name, phone: driver.phone, vehicle: driver.vehicle, plate: driver.plate },
    req.body.fare,
    actor
  );
  const updated = await mutateReq(req, (s) => {
    const t = s.trip(id);
    if (!t) return null;
    t.driverId = driver.id;
    t.driverName = driver.name;
    t.ownerDriver = true;
    return t;
  });
  return updated ? res.json(await overlayOne(req, updated)) : notFound(res, 'Trip');
});

stayrideV1Router.post('/trips/:id/confirm-quote', async (req: Request, res: Response) => {
  const { tenantKey, isDemo, actor } = tenantOf(req);
  const id = Number(req.params.id);
  const store = await loadReqStore(req);
  const trip = store.trip(id);
  if (!trip) return notFound(res, 'Trip');
  if (trip.reference) {
    await ownerConfirmQuote(tenantKey, isDemo, trip.reference, String(req.body?.driverId || ''), actor);
    return res.json(await overlayOne(req, trip));
  }
  // Own-driver trip: record the agreed fare from the owner's own driver quote (no platform money).
  const driverId = Number(req.body?.driverId);
  const quote = (trip.quotes || []).find((q) => Number(q.driverId) === driverId);
  if (!quote || !store.driver(driverId)) return res.status(400).json({ error: { message: 'Choose one of the quotes from your own drivers.' } });
  const updated = await mutateReq(req, (s) => s.confirmTripQuote(id, driverId, quote.quotedFare));
  res.json(updated);
});

// Owner sends a held guest inquiry to the StayRide driver network.
stayrideV1Router.post('/trips/:id/dispatch', async (req: Request, res: Response) => {
  const { tenantKey, isDemo } = tenantOf(req);
  if (!(req as any).account.features.platformDispatch) {
    return res.status(403).json({ error: { message: 'Sending requests to StayRide drivers is not enabled for your homestay.', code: 'FEATURE_DISABLED', feature: 'platformDispatch' } });
  }
  const store = await loadReqStore(req);
  const trip = store.trip(Number(req.params.id));
  if (!trip) return notFound(res, 'Trip');
  if (!trip.reference) return res.status(409).json({ error: { message: 'Only StayRide requests can be sent to drivers.', code: 'INVALID_STATE' } });
  await dispatchRequest(tenantKey, isDemo, trip.reference);
  return res.json(await overlayOne(req, trip));
});

// Owner counter-offers a driver's quote (StayRide trips): the driver accepts, or quotes again
stayrideV1Router.post('/trips/:id/counter', async (req: Request, res: Response) => {
  const { tenantKey, isDemo, actor } = tenantOf(req);
  const store = await loadReqStore(req);
  const trip = store.trip(Number(req.params.id));
  if (!trip) return notFound(res, 'Trip');
  if (!trip.reference) return res.status(409).json({ error: { message: 'Counter-offers are for StayRide driver quotes.', code: 'INVALID_STATE' } });
  await ownerCounterOffer(tenantKey, isDemo, trip.reference, str(req.body?.driverId, 64), req.body?.fare, actor);
  return res.json(await overlayOne(req, trip));
});

stayrideV1Router.post('/trips/:id/cancel', async (req: Request, res: Response) => {
  const { tenantKey, isDemo, actor } = tenantOf(req);
  const id = Number(req.params.id);
  const store = await loadReqStore(req);
  const trip = store.trip(id);
  if (!trip) return notFound(res, 'Trip');
  if (trip.reference) {
    await cancelRequest({ reference: trip.reference, propertyId: tenantKey }, isDemo, actor, str(req.body?.reason, 300) || 'Cancelled by homestay');
    return res.json(await overlayOne(req, trip));
  }
  res.json(await mutateReq(req, (s) => s.cancelTrip(id)));
});

// Owner rates the StayRide driver of a completed platform trip (once).
stayrideV1Router.post('/trips/:id/rate', async (req: Request, res: Response) => {
  const { tenantKey, isDemo, actor } = tenantOf(req);
  const store = await loadReqStore(req);
  const trip = store.trip(Number(req.params.id));
  if (!trip) return notFound(res, 'Trip');
  if (!trip.reference) return res.status(409).json({ error: { message: 'Only StayRide platform trips can be rated.', code: 'INVALID_STATE' } });
  await rateDriver(tenantKey, isDemo, trip.reference, req.body, actor);
  res.json(await overlayOne(req, trip));
});

// Platform commission is paid only through admin-settled payouts.
stayrideV1Router.post('/trips/:id/commission/pay', (_req: Request, res: Response) => {
  res.status(410).json({ error: { message: 'Commission is settled by StayRide through payouts.', code: 'GONE' } });
});

// ==========================================
// Guest "Ask for Cab" secure links
// ==========================================
stayrideV1Router.post('/guest-links', requireFeature('guestCabLinks'), async (req: Request, res: Response) => {
  const { tenantKey, isDemo } = tenantOf(req);
  const guestName = str(req.body.guestName, 100);
  const guestPhone = str(req.body.guestPhone, 20);
  if (!guestName || !guestPhone) {
    return res.status(400).json({ error: { message: 'Guest name and phone are required.' } });
  }
  const guestId = Number(req.body.guestId);
  res.status(201).json(await issueGuestLink(tenantKey, isDemo, { guestId: Number.isFinite(guestId) ? guestId : null, guestName, guestPhone }));
});

// Ask a guest for a cab: StayRide sends the link from the company WhatsApp number (the owner's phone is not used).
// status SKIPPED = WhatsApp is not switched on (or demo account); nothing was sent.
stayrideV1Router.post('/guest-links/send', requireFeature('guestCabLinks'), async (req: Request, res: Response) => {
  const { tenantKey, isDemo } = tenantOf(req);
  const guestName = str(req.body.guestName, 100);
  const guestPhone = str(req.body.guestPhone, 20);
  if (!guestName || !guestPhone) {
    return res.status(400).json({ error: { message: 'Guest name and phone are required.' } });
  }
  // Only to a guest of this homestay who is checked in right now, and to the phone saved on their
  // record (not whatever the request says): the company number must never message strangers.
  const store = await loadReqStore(req);
  const digits = (p: unknown) => String(p ?? '').replace(/\D/g, '').slice(-10);
  const guestId = Number(req.body.guestId);
  const guest = store.guests.find((g) => (Number.isFinite(guestId) && g.id === guestId) || digits(g.phone) === digits(guestPhone));
  const hasBooking = store.bookings.some((b) => (b.status === 'CONFIRMED' || b.status === 'CHECKED_IN') && (b.guestId === guest?.id || digits(b.phone) === digits(guestPhone)));
  if (!guest && !hasBooking) {
    return res.status(400).json({ error: { message: 'Ask-for-Cab is only for guests registered with this homestay or with a booking.', code: 'GUEST_NOT_FOUND' } });
  }
  try {
    const { result, expiresAt } = await sendAskCab(tenantKey, isDemo, store.homestay.name, {
      guestId: guest?.id ?? (Number.isFinite(guestId) ? guestId : undefined),
      guestName: guest?.name || guestName,
      guestPhone: guest?.phone || guestPhone,
    });
    if (result === 'FAILED') {
      return res.status(502).json({ error: { message: 'Could not send the WhatsApp message. Please try again.', code: 'WHATSAPP_FAILED' } });
    }
    return res.status(201).json({ sent: result === 'SENT', status: result, expiresAt });
  } catch (err: any) {
    if (err?.code === 'ASK_CAB_COOLDOWN' || err?.status === 429) {
      return res.status(200).json({ sent: false, status: 'ALREADY_SENT', alreadySent: true, message: err.message });
    }
    throw err;
  }
});

// ==========================================
// Campaigns (feature-gated by admin)
// ==========================================
stayrideV1Router.get('/campaigns', requireFeature('campaigns'), async (req: Request, res: Response) => {
  res.json((await loadReqStore(req)).campaigns);
});

stayrideV1Router.post('/campaigns', requireFeature('campaigns'), async (req: Request, res: Response) => {
  const title = str(req.body.title, 120);
  const message = str(req.body.message, 1000);
  const audience = str(req.body.audience, 50) || 'All guests';
  if (!title || !message) return res.status(400).json({ error: { message: 'Title and message are required.' } });
  res.status(201).json(await mutateReq(req, (s) => s.createCampaign(title, message, audience)));
});

stayrideV1Router.post('/campaigns/:id/send', requireFeature('campaigns'), async (req: Request, res: Response) => {
  const sent = await mutateReq(req, (s) => s.sendCampaign(Number(req.params.id)));
  return sent ? res.json(sent) : notFound(res, 'Campaign');
});

stayrideV1Router.delete('/campaigns/:id', requireFeature('campaigns'), async (req: Request, res: Response) => {
  await mutateReq(req, (s) => s.deleteCampaign(Number(req.params.id)));
  res.json({ success: true });
});

// ==========================================
// Feature access appeals (owner → admin)
// ==========================================
stayrideV1Router.get('/appeals', async (req: Request, res: Response) => {
  const { tenantKey, isDemo } = tenantOf(req);
  res.json(await getFeatureAppealModel(isDemo).find({ propertyId: tenantKey }).sort({ createdAt: -1 }).limit(50).lean());
});

stayrideV1Router.post('/appeals', async (req: Request, res: Response) => {
  const { tenantKey, isDemo, actor } = tenantOf(req);
  const featureKey = req.body.featureKey as FeatureKey;
  // driverQuotes is one platform-wide switch for drivers, not something a homestay can be granted
  if (!FEATURE_KEYS.includes(featureKey) || featureKey === 'driverQuotes') return res.status(400).json({ error: { message: 'Unknown feature.' } });
  const reason = str(req.body.reason, 500);
  if (!reason) return res.status(400).json({ error: { message: 'Please tell StayRide why you need this feature.' } });
  const Appeal = getFeatureAppealModel(isDemo);
  if (await Appeal.exists({ propertyId: tenantKey, featureKey, status: 'PENDING' })) {
    return res.status(409).json({ error: { message: 'You already have a pending request for this feature.' } });
  }
  const store = await loadReqStore(req);
  const appeal = await Appeal.create({ propertyId: tenantKey, homestayName: store.homestay.name || tenantKey, ownerEmail: actor, featureKey, reason });
  res.status(201).json(appeal);
});

// ==========================================
// Homestay commission payouts (only commission StayRide actually collected)
// ==========================================
stayrideV1Router.get('/payouts/summary', async (req: Request, res: Response) => {
  const { tenantKey, isDemo } = tenantOf(req);
  res.json(await payoutSummary(tenantKey, isDemo));
});

stayrideV1Router.post('/payouts/request', requireFeature('payouts'), async (req: Request, res: Response) => {
  const { tenantKey, isDemo, actor } = tenantOf(req);
  const store = await loadReqStore(req);
  const payout = await requestPayout(
    tenantKey,
    isDemo,
    { name: store.homestay.ownerName, phone: store.homestay.phone, homestayName: store.homestay.name },
    req.body,
    actor
  );
  res.status(201).json({ success: true, message: `Payout request of ₹${(payout as any).amount.toLocaleString('en-IN')} submitted.`, payout: ownerPayoutView(payout) });
});

stayrideV1Router.get('/payouts/history', async (req: Request, res: Response) => {
  const { tenantKey, isDemo } = tenantOf(req);
  res.json((await payoutModel(isDemo).find({ tenantId: tenantKey }).sort({ requestedAt: -1 }).limit(50).lean()).map(ownerPayoutView));
});

// ==========================================
// Demo Controls (demo tenant only)
// ==========================================
const demoOnly = (req: Request, res: Response, next: () => void) =>
  isDemoKey(authOf(req).tenantKey) ? next() : res.status(403).json({ error: { message: 'Demo accounts only.' } });

stayrideV1Router.post('/demo/reset', demoOnly, async (_req: Request, res: Response) => {
  await tenantManager.resetDemoStore();
  res.json({ success: true, message: 'Demo data reset' });
});

stayrideV1Router.post('/dev/seed', demoOnly, async (_req: Request, res: Response) => {
  await tenantManager.resetDemoStore();
  res.json({ success: true, message: 'Demo data reset' });
});

export default stayrideV1Router;
