import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { tenantManager, StayRideMemoryStore, isDemoKey, pick, WRITABLE } from './store.js';
import {
  OPEN_STATUSES, cabModel, payoutModel, userModel, parseFare, overlayTrips, ownerConfirmQuote, cancelRequest,
  sanitizeOpenRequest, assignedTripForDriver, driverSubmitQuote, startTrip, completeTrip, payoutSummary, requestPayout,
} from './platform.js';
import { CommissionService } from '../services/commission.service.js';
import { FEATURE_KEYS, FeatureKey } from '../models/tenant-control.model.js';
import { getFeatureAppealModel } from '../models/feature-appeal.model.js';
import { User } from '../models/user.model.js';
import { Property } from '../models/property.model.js';
import { Driver } from '../models/driver.model.js';
import { Booking } from '../models/booking.model.js';

export function getUserModel(isDemo: boolean = false): mongoose.Model<any> {
  const dbName = isDemo ? 'test' : 'production';
  if (mongoose.connection.readyState === 1) {
    const db = mongoose.connection.useDb(dbName, { useCache: true });
    return (db.models.User || db.model('User', User.schema)) as mongoose.Model<any>;
  }
  return User as mongoose.Model<any>;
}

export function getPropertyModel(isDemo: boolean = false): mongoose.Model<any> {
  const dbName = isDemo ? 'test' : 'production';
  if (mongoose.connection.readyState === 1) {
    const db = mongoose.connection.useDb(dbName, { useCache: true });
    return (db.models.Property || db.model('Property', Property.schema)) as mongoose.Model<any>;
  }
  return Property as mongoose.Model<any>;
}

export function getBookingModel(isDemo: boolean = false): mongoose.Model<any> {
  const dbName = isDemo ? 'test' : 'production';
  if (mongoose.connection.readyState === 1) {
    const db = mongoose.connection.useDb(dbName, { useCache: true });
    return (db.models.Booking || db.model('Booking', Booking.schema)) as mongoose.Model<any>;
  }
  return Booking as mongoose.Model<any>;
}

export function getDriverModel(isDemo: boolean = false): mongoose.Model<any> {
  const dbName = isDemo ? 'test' : 'production';
  if (mongoose.connection.readyState === 1) {
    const db = mongoose.connection.useDb(dbName, { useCache: true });
    return (db.models.Driver || db.model('Driver', Driver.schema)) as mongoose.Model<any>;
  }
  return Driver as mongoose.Model<any>;
}

import jwt from 'jsonwebtoken';
import { verifyToken, clerkClient } from '@clerk/express';
import { verifyWebhook } from '@clerk/express/webhooks';
import { config } from '../config/env.js';

interface StayRideAuthPayload {
  id: string;
  email: string;
  role: string;
  tenantKey: string;
  isDemo: boolean;
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
        if (user && user.accountStatus !== 'BLOCKED' && !isDemoKey(user.email)) {
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

    if (!user) {
      return res.status(401).json({ error: { message: 'No account found with this email. Please sign up.' } });
    }

    const isMatch = await user.comparePassword(cleanPass);
    if (!isMatch) {
      return res.status(401).json({ error: { message: 'Invalid password. Please check your credentials.' } });
    }

    if (user.role === 'admin') {
      return res.status(403).json({
        error: {
          message: 'Access Denied: You are an Administrator. The mobile app is strictly for Homestay Hosts and Cab Drivers. Please use the Web Control Tower.',
          code: 'ADMIN_NOT_ALLOWED',
        },
      });
    }

    const userRole = (user.role || 'owner') as 'owner' | 'driver';

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
        link: store.homestay.link || `https://stayride.in/h/${encodeURIComponent(cleanEmail)}`,
      },
    });
  } catch (err: any) {
    console.error('[StayRide] Login error:', err);
    return res.status(500).json({ error: { message: 'Internal server error during authentication.' } });
  }
});

stayrideV1Router.post('/auth/signup', async (req: Request, res: Response) => {
  const { name, phone, email, password, homestayName, location, role, vehicleType, vehicleNumber, area } = req.body;
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
    const cleanLocation = (location || 'Gangtok, Sikkim').trim();
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
      link: `https://stayride.in/h/${cleanHomestay.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
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
        address: cleanLocation,
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

    const tokenPayload: StayRideAuthPayload = {
      id: decoded.id,
      email: decoded.email,
      role: userRole,
      tenantKey: decoded.tenantKey,
      isDemo: Boolean(decoded.isDemo),
    };

    const { accessToken: newAccessToken, refreshToken: newRefreshToken } = issueTokens(tokenPayload);

    if (Boolean(decoded.isDemo) !== isDemoKey(decoded.tenantKey) || (decoded.isDemo && !config.demoEnabled)) {
      return res.status(401).json({ error: { message: 'Invalid session. Please sign in again.' } });
    }
    if (!decoded.isDemo) {
      const user: any = mongoose.Types.ObjectId.isValid(decoded.id) ? await getUserModel(false).findById(decoded.id).lean() : null;
      if (!user || user.accountStatus === 'BLOCKED') {
        return res.status(401).json({ error: { message: 'This account is no longer active.', code: 'ACCOUNT_BLOCKED' } });
      }
      if (userRole === 'driver') {
        return res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken, role: 'driver', driver: driverProfile(user) });
      }
    } else if (userRole === 'driver') {
      return res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken, role: 'driver', driver: driverProfile(DEMO_DRIVER) });
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

    if (!user) {
      user = await UserModel.create({
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
        const cleanLocation = String(location || 'Gangtok, Sikkim').trim();
        const PropertyModel = getPropertyModel(false);
        let propDoc = await PropertyModel.findOne({ email: cleanEmail });
        if (!propDoc) {
          propDoc = await PropertyModel.create({
            ownerId: (user as any)._id,
            name: cleanHomestay,
            email: cleanEmail,
            phone: cleanPhone || 'not provided',
            address: cleanLocation,
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
    const cleanLocation = String(location || 'Gangtok, Sikkim').trim();
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
      link: `https://stayride.in/h/${cleanHomestay.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
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
        address: cleanLocation,
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
        link: store.homestay.link || `https://stayride.in/h/${encodeURIComponent(cleanEmail)}`,
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
const IST_OFFSET_MS = 330 * 60000;
const DAY_MS = 86400000;
const VEHICLE_TYPES = ['SUV', 'Sedan', '7-seater', '9-seater'];

function parseTime12(t: unknown): number | null {
  const m = typeof t === 'string' ? t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i) : null;
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (h < 1 || h > 12 || min > 59) return null;
  return ((h % 12) + (m[3].toUpperCase() === 'PM' ? 12 : 0)) * 60 + min;
}

// `date` is any instant on the chosen calendar day (IST); `time` is "hh:mm AM".
function istDateTime(date: unknown, time: unknown): number | null {
  const d = Number(date);
  const mins = parseTime12(time);
  if (!Number.isFinite(d) || d <= 0 || mins === null) return null;
  const dayStart = Math.floor((d + IST_OFFSET_MS) / DAY_MS) * DAY_MS - IST_OFFSET_MS;
  return dayStart + mins * 60000;
}

export function validateSchedule(body: any): string | null {
  const pickupAt = istDateTime(body.date, body.time);
  if (pickupAt === null) return 'A valid pickup date and time (hh:mm AM/PM) are required.';
  if (pickupAt < Date.now() - 10 * 60000) return 'Pickup date and time cannot be in the past.';
  if (pickupAt > Date.now() + 365 * DAY_MS) return 'Pickup must be within the next 12 months.';
  if (body.isRoundTrip) {
    const returnAt = istDateTime(body.returnDate, body.returnTime);
    if (returnAt === null) return 'Round trips need a return date and time.';
    if (returnAt <= pickupAt) return 'Return must be after the pickup date and time.';
  }
  return null;
}

const newReference = () => `REQ-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
const hashToken = (t: string) => crypto.createHash('sha256').update(t).digest('hex');
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const authOf = (req: Request) => (req as any).stayrideUser as StayRideAuthPayload;
const tenantOf = (req: Request) => {
  const u = authOf(req);
  return { tenantKey: u.tenantKey, isDemo: isDemoKey(u.tenantKey), actor: u.email };
};

/** Create the admin-queue CabRequest for a platform trip (the single source of truth for its money). */
async function createCabRequest(tenantKey: string, isDemo: boolean, store: StayRideMemoryStore, trip: any, source: string, extra: Record<string, any> = {}) {
  await cabModel(isDemo).create({
    reference: trip.reference,
    propertyId: tenantKey,
    tripId: trip.id,
    homestayName: store.homestay.name || 'Homestay',
    guestId: trip.guestId ?? null,
    guestName: trip.guestName,
    guestPhone: trip.phone,
    pickupLocation: { address: trip.pickup },
    destinations: trip.destinations?.length ? trip.destinations : [{ address: trip.destination || 'Destination', order: 0 }],
    isRoundTrip: Boolean(trip.isRoundTrip),
    returnDate: trip.returnDate,
    returnTime: trip.returnTime || '',
    date: trip.date,
    time: trip.time,
    passengers: trip.passengers || 1,
    vehicleType: VEHICLE_TYPES.includes(trip.vehicleType) ? trip.vehicleType : 'SUV',
    requestSource: source,
    status: 'FINDING_DRIVER',
    ...extra,
  });
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
  const scheduleError = validateSchedule(input);
  if (scheduleError) return res.status(400).json({ error: { message: scheduleError } });

  const tenantKey = link.tenantKey as string;
  const isDemo = isDemoKey(tenantKey);
  const Cab = cabModel(isDemo);

  // Idempotent retries: same clientRequestId returns the original request.
  const existing: any = await Cab.findOne({ clientRequestId, propertyId: tenantKey }).lean();
  if (existing) return res.status(201).json({ reference: existing.reference, status: existing.status });
  // Abuse cap per link.
  if ((await Cab.countDocuments({ propertyId: tenantKey, guestPhone: input.phone, status: { $in: OPEN_STATUSES } })) >= 5) {
    return res.status(429).json({ error: { message: 'Too many open requests. Please contact your homestay.' } });
  }

  const reference = newReference();
  const trip = await tenantManager.mutate(tenantKey, (store) => {
    const t = store.createTrip({ ...input, guestId: link.guestId ?? undefined, pickup: input.pickup || store.homestay.location || store.homestay.name }, 'GUEST_WEB_LINK');
    t.reference = reference;
    t.dispatchMode = 'PLATFORM';
    return t;
  });
  const store = await tenantManager.load(tenantKey);
  try {
    await createCabRequest(tenantKey, isDemo, store, trip, 'GUEST_WEB_LINK', { clientRequestId, guestNotes: str(req.body.notes, 500) });
  } catch (err: any) {
    await tenantManager.mutate(tenantKey, (s) => { s.trips = s.trips.filter((t) => t.reference !== reference); });
    if (err?.code === 11000) {
      const dup: any = await Cab.findOne({ clientRequestId, propertyId: tenantKey }).lean();
      if (dup) return res.status(201).json({ reference: dup.reference, status: dup.status });
    }
    throw err;
  }
  return res.status(201).json({ reference, status: 'FINDING_DRIVER' });
});

stayrideV1Router.get('/public/cab-requests/:reference', async (req: Request, res: Response) => {
  const link = await findGuestLink(req.query.t);
  if (!link) return invalidLink(res);
  const doc: any = await cabModel(isDemoKey(link.tenantKey))
    .findOne({ reference: String(req.params.reference), propertyId: link.tenantKey })
    .lean();
  if (!doc) return res.status(404).json({ error: { message: 'Cab request not found.' } });
  return res.json({
    reference: doc.reference,
    status: doc.status,
    agreedFare: doc.agreedFare,
    advanceAmount: doc.advanceAmount,
    advancePaid: doc.advancePaid,
    remainingCashAmount: doc.remainingCashAmount,
    driverName: doc.assignedDriverName || '',
    vehicle: [doc.vehicleDetails?.model, doc.vehicleDetails?.plate].filter(Boolean).join(' '),
    refundStatus: doc.refundStatus,
  });
});

// ==========================================
// Clerk webhook (raw body, svix-signed)
// ==========================================
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
        if (!user && type === 'user.created') {
          user = await UserModel.create({
            name,
            email: cleanEmail,
            clerkId,
            password: crypto.randomBytes(32).toString('hex'),
            role: 'owner',
            avatar,
          });
          await tenantManager.createTenantIfMissing(cleanEmail, {
            name: `${name}'s Homestay`,
            ownerName: name,
            email: cleanEmail,
          });
        } else if (user) {
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
  const id = String(driver._id);
  const settings = await CommissionService.getSettings(isDemo);
  const quotesOn = CommissionService.globalFeatures(settings).driverQuotes.enabled && driver.isAvailable !== false;
  const [open, mine] = await Promise.all([
    quotesOn ? cabModel(isDemo).find({ status: { $in: OPEN_STATUSES } }).sort({ date: 1 }).limit(50).lean() : Promise.resolve([]),
    cabModel(isDemo).find({ assignedDriverUserId: id }).sort({ date: -1 }).limit(100).lean(),
  ]);
  return [...mine.map(assignedTripForDriver), ...open.map((d: any) => sanitizeOpenRequest(d, id))];
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
  res.json(sanitizeOpenRequest(updated, String((req as any).driver._id)));
});

stayrideV1Router.post('/driver/trips/:reference/start', driverGate, async (req: Request, res: Response) => {
  const isDemo = isDemoKey(authOf(req).tenantKey);
  const updated = await startTrip(isDemo, { reference: String(req.params.reference), assignedDriverUserId: String((req as any).driver._id) }, authOf(req).email);
  res.json(assignedTripForDriver(updated));
});

stayrideV1Router.post('/driver/trips/:reference/complete', driverGate, async (req: Request, res: Response) => {
  const isDemo = isDemoKey(authOf(req).tenantKey);
  const updated = await completeTrip(isDemo, { reference: String(req.params.reference), assignedDriverUserId: String((req as any).driver._id) }, authOf(req).email);
  res.json(assignedTripForDriver(updated));
});

// ==========================================
// Homestay-owner API. Admin controls (block / feature switches) are enforced here for every route.
// ==========================================
stayrideV1Router.use(async (req: Request, res: Response, next: () => void) => {
  const u = authOf(req);
  if (u.role === 'driver') {
    return res.status(403).json({ error: { message: 'This action is for homestay owners only.', code: 'FORBIDDEN' } });
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
    commissionRates: { pfPercent: rates.pfPercent, hcPercent: rates.hcPercent, advancePercent: rates.advancePercent, minAdvanceAmount: rates.minAdvanceAmount },
    homestay: store.homestay,
    rooms: store.rooms,
    guests: store.guests,
    bookings: store.bookings,
    drivers: store.drivers,
    networkDrivers: isDemo ? store.networkDrivers : [],
    trips: await overlayTrips(tenantKey, isDemo, store.trips),
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
  res.json(await mutateReq(req, (s) => Object.assign(s.homestay, pick(req.body, WRITABLE.homestay))));
});

// ==========================================
// Rooms
// ==========================================
stayrideV1Router.get('/rooms', async (req: Request, res: Response) => {
  res.json((await loadReqStore(req)).rooms);
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
  if (!isDemo) {
    try {
      const PropertyModel = getPropertyModel(false);
      const BookingModel = getBookingModel(false);
      const prop = await PropertyModel.findOne({ email: tenantKey });
      if (prop) {
        const ref = 'BK-' + Math.random().toString(36).substring(2, 7).toUpperCase();
        await BookingModel.create({
          reference: ref,
          pin: '1234',
          ownerId: prop.ownerId,
          propertyId: prop._id,
          homestayName: prop.name,
          roomCode: String(created.roomNumber || '101'),
          roomName: `Room ${created.roomNumber || '101'}`,
          staySlug: (prop.name || 'homestay').toLowerCase().replace(/[^a-z0-9]/g, '-'),
          guestName: created.guestName || 'Guest',
          email: created.phone ? `${created.phone.replace(/[^0-9]/g, '')}@stayride.guest` : 'guest@stayride.in',
          phone: created.phone || '',
          checkIn: new Date(created.checkIn).toISOString().split('T')[0],
          checkOut: new Date(created.checkOut).toISOString().split('T')[0],
          nights: Math.max(1, Math.round((created.checkOut - created.checkIn) / (24 * 3600 * 1000))),
          party: created.guests || 1,
          channel: 'StayRide Host App',
          status: 'confirmed',
          totalAmount: created.amount || 0,
        });
      }
    } catch (bErr: any) {
      console.warn('[StayRide] Failed to sync booking to MongoDB Atlas:', bErr.message);
    }
  }
  res.status(201).json(created);
});

const bookingAction = (fn: (s: StayRideMemoryStore, id: number, body: any) => any) => async (req: Request, res: Response) => {
  const b = await mutateReq(req, (s) => fn(s, Number(req.params.id), req.body));
  return b ? res.json(b) : notFound(res, 'Booking');
};
stayrideV1Router.post('/bookings/:id/check-in', bookingAction((s, id) => s.checkInBooking(id)));
stayrideV1Router.post('/bookings/:id/check-out', bookingAction((s, id) => s.checkOutBooking(id)));
stayrideV1Router.post('/bookings/:id/cancel', bookingAction((s, id) => s.cancelBooking(id)));
stayrideV1Router.patch('/bookings/:id/payment', bookingAction((s, id, body) => s.setBookingPaid(id, Boolean(body?.paid))));
stayrideV1Router.post('/bookings/:id/room', bookingAction((s, id, body) => s.changeBookingRoom(id, body?.roomNumber)));

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
  res.json(await overlayTrips(tenantKey, isDemo, store.trips));
});

stayrideV1Router.post('/trips', async (req: Request, res: Response) => {
  const { tenantKey, isDemo } = tenantOf(req);
  const input = tripInput(req.body);
  if (!input.guestName || !input.phone) return res.status(400).json({ error: { message: 'Guest name and phone are required.' } });
  const scheduleError = validateSchedule(input);
  if (scheduleError) return res.status(400).json({ error: { message: scheduleError } });
  const platform = req.body.dispatchMode === 'PLATFORM';
  if (platform && !(req as any).account.features.platformDispatch) {
    return res.status(403).json({ error: { message: 'Sending requests to StayRide drivers is not enabled for your homestay.', code: 'FEATURE_DISABLED', feature: 'platformDispatch' } });
  }
  const reference = platform ? newReference() : undefined;
  const trip = await mutateReq(req, (s) => {
    const t = s.createTrip({ ...input, pickup: input.pickup || s.homestay.location || s.homestay.name });
    t.dispatchMode = platform ? 'PLATFORM' : 'OWN_DRIVER';
    if (reference) t.reference = reference;
    return t;
  });
  if (platform) {
    const store = await loadReqStore(req);
    try {
      await createCabRequest(tenantKey, isDemo, store, trip, 'MANUAL_OWNER');
    } catch (err) {
      await mutateReq(req, (s) => { s.trips = s.trips.filter((t) => t.reference !== reference); });
      throw err;
    }
  }
  res.status(201).json(await overlayOne(req, trip));
});

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
stayrideV1Router.post('/trips/:id/start', ownTripAction((s, id) => s.startTrip(id)));
stayrideV1Router.post('/trips/:id/complete', ownTripAction((s, id, body) => s.completeTrip(id, body?.finalFare)));
stayrideV1Router.post('/trips/:id/quote', ownTripAction((s, id, body) => {
  // Owner records a quote from one of their OWN drivers.
  const driverId = Number(body?.driverId);
  if (!s.driver(driverId)) throw Object.assign(new Error('Choose one of your own drivers.'), { status: 400 });
  return s.quoteTrip(id, driverId, parseFare(body?.quotedFare));
}));

// Assign one of the homestay's own drivers. For a still-open platform request this hands the
// trip back to the homestay (the StayRide request is cancelled; no money was involved yet).
stayrideV1Router.post('/trips/:id/assign', async (req: Request, res: Response) => {
  const { tenantKey, isDemo, actor } = tenantOf(req);
  const id = Number(req.params.id);
  const driverId = Number(req.body?.driverId);
  const store = await loadReqStore(req);
  const trip = store.trip(id);
  if (!trip) return notFound(res, 'Trip');
  if (!store.driver(driverId) && !(isDemo && store.networkDrivers.some((d) => d.id === driverId))) {
    return res.status(400).json({ error: { message: 'Choose one of your own drivers.' } });
  }
  if (trip.reference) {
    const doc: any = await cabModel(isDemo).findOne({ reference: trip.reference, propertyId: tenantKey }).lean();
    if (doc && !OPEN_STATUSES.includes(doc.status) && doc.status !== 'CANCELLED') return res.status(409).json(PLATFORM_MANAGED);
    if (doc && doc.status !== 'CANCELLED') {
      await cancelRequest({ _id: doc._id, status: { $in: OPEN_STATUSES } }, isDemo, actor, 'Handled by the homestay with its own driver');
    }
  }
  const updated = await mutateReq(req, (s) => {
    const t = s.trip(id);
    if (!t) return null;
    delete t.reference;
    t.dispatchMode = 'OWN_DRIVER';
    return s.assignTrip(id, driverId);
  });
  return updated ? res.json(updated) : notFound(res, 'Trip');
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
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 7 * DAY_MS);
  const { getGuestLinkModel } = await import('../models/guest-link.model.js');
  await getGuestLinkModel(isDemo).create({
    tokenHash: hashToken(token),
    tenantKey,
    guestId: Number.isFinite(guestId) ? guestId : null,
    guestName,
    guestPhone,
    expiresAt,
  });
  res.status(201).json({ url: `${config.guestWebUrl}/cab-request?t=${token}`, expiresAt: expiresAt.getTime() });
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
  if (!FEATURE_KEYS.includes(featureKey)) return res.status(400).json({ error: { message: 'Unknown feature.' } });
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
  res.status(201).json({ success: true, message: `Payout request of ₹${(payout as any).amount.toLocaleString('en-IN')} submitted.`, payout });
});

stayrideV1Router.get('/payouts/history', async (req: Request, res: Response) => {
  const { tenantKey, isDemo } = tenantOf(req);
  res.json(await payoutModel(isDemo).find({ tenantId: tenantKey }).sort({ requestedAt: -1 }).limit(50).lean());
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
