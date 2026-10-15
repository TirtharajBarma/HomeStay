import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { tenantManager, StayRideMemoryStore, StayRideTenantModel, isDemoKey, pick, WRITABLE } from './store.js';
import { User } from '../models/user.model.js';
import { Property } from '../models/property.model.js';
import { Driver } from '../models/driver.model.js';
import { getPayoutRequestModel } from '../models/payout-request.model.js';

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
  try {
    (req as any).stayrideUser = verifyStayRideToken(token, 'access');
    return next();
  } catch {
    // Custom JWT check failed, fallback to Clerk check
  }

  // 2. Try Clerk session token verification
  if (config.clerkSecretKey) {
    try {
      const clerkPayload = await verifyToken(token, { secretKey: config.clerkSecretKey });
      if (clerkPayload && clerkPayload.sub) {
        const UserModel = getUserModel(false);
        const user = await UserModel.findOne({ clerkId: clerkPayload.sub });
        if (user) {
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
    cleanEmail === 'demo@stayride.in' && (cleanPass === 'demo123' || cleanPass === 'demo');
  const isDemoDriver =
    (cleanEmail === 'demo-driver@stayride.in' || cleanEmail === 'driver@stayride.in') &&
    (cleanPass === 'demo123' || cleanPass === 'demo');

  // 1A. DEMO HOST LOGIN
  if (isDemoHost) {
    const tenantKey = 'demo@stayride.in';
    const store = await tenantManager.getStoreAsync(tenantKey);

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
      driver: {
        id: 1,
        name: 'Pemba Lepcha (Demo Driver)',
        phone: '+91 98000 11223',
        email: cleanEmail,
        vehicle: 'Mahindra Scorpio (SUV)',
        vehicleType: 'SUV',
        plate: 'SK-01-A-4488',
        rating: 4.9,
        available: true,
        active: true,
        area: 'Gangtok & North Sikkim',
      },
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

    const userRole = (user.role || 'owner') as 'owner' | 'driver';

    // 2A. DRIVER USER LOGIN
    if (userRole === 'driver') {
      const DriverModel = getDriverModel(false);
      const driverDoc = await DriverModel.findOne({ email: cleanEmail });

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
        driver: {
          id: driverDoc ? driverDoc._id.toString() : user._id.toString(),
          name: user.name,
          phone: user.phone || '',
          email: user.email,
          vehicle: driverDoc?.vehicle || 'Mahindra Scorpio (SUV)',
          vehicleType: (driverDoc?.vehicle?.includes('Sedan') ? 'Sedan' : 'SUV'),
          plate: driverDoc?.plate || 'SK-01-A-9999',
          rating: driverDoc?.rating || 5.0,
          area: driverDoc?.coverage || 'Darjeeling • Hill Roads',
          available: driverDoc?.status !== 'Paused',
          active: true,
        },
      });
    }

    // 2B. HOMESTAY OWNER LOGIN
    const tenantKey = cleanEmail;
    const store = await tenantManager.getStoreAsync(tenantKey);

    if (!store.homestay.ownerName || store.homestay.ownerName === 'Host') {
      store.homestay.ownerName = user.name;
    }
    if (!store.homestay.phone && user.phone) {
      store.homestay.phone = user.phone;
    }

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

    const userDoc = await UserModel.create({
      name: cleanName,
      email: cleanEmail,
      password: cleanPass,
      phone: cleanPhone,
      role: userRole,
    });

    // DRIVER SIGNUP FLOW
    if (userRole === 'driver') {
      const DriverModel = getDriverModel(false);
      const vehicle = vehicleType || 'SUV';
      const plate = vehicleNumber || `SK-01-A-${Math.floor(1000 + Math.random() * 9000)}`;
      const coverage = area || 'Darjeeling • Hill Roads';

      const driverDoc = await DriverModel.create({
        ownerId: (userDoc as any)._id,
        id: `DRV-${Date.now().toString().slice(-4)}`,
        name: cleanName,
        phone: cleanPhone,
        email: cleanEmail,
        vehicle,
        plate,
        coverage,
        status: 'Active',
      } as any);

      const tokenPayload: StayRideAuthPayload = {
        id: userDoc._id.toString(),
        email: cleanEmail,
        role: 'driver',
        tenantKey: cleanEmail,
        isDemo: false,
      };

      const { accessToken, refreshToken } = issueTokens(tokenPayload);

      return res.status(201).json({
        accessToken,
        refreshToken,
        role: 'driver',
        driver: {
          id: driverDoc._id.toString(),
          name: cleanName,
          phone: cleanPhone,
          email: cleanEmail,
          vehicle,
          vehicleType: vehicle,
          plate,
          rating: 5.0,
          area: coverage,
          available: true,
          active: true,
        },
      });
    }

    // HOMESTAY OWNER SIGNUP FLOW
    const cleanHomestay = (homestayName || 'My Homestay').trim();
    const cleanLocation = (location || 'Gangtok, Sikkim').trim();
    const cleanLat = req.body.latitude ? Number(req.body.latitude) : null;
    const cleanLng = req.body.longitude ? Number(req.body.longitude) : null;
    const cleanMapQuery = req.body.mapQuery || (cleanLat && cleanLng ? `${cleanLat},${cleanLng}` : cleanLocation);
    const tenantKey = cleanEmail;
    const store = tenantManager.createFreshTenant(tenantKey, {
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

    await tenantManager.persistTenant(tenantKey);
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

    if (userRole === 'driver') {
      const DriverModel = getDriverModel(Boolean(decoded.isDemo));
      const driverDoc = await DriverModel.findOne({ email: decoded.email });

      return res.json({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        role: 'driver',
        driver: {
          id: driverDoc ? driverDoc._id.toString() : decoded.id,
          name: driverDoc?.name || 'Driver',
          phone: driverDoc?.phone || '',
          email: decoded.email,
          vehicle: driverDoc?.vehicle || 'Mahindra Scorpio (SUV)',
          vehicleType: driverDoc?.vehicle?.includes('Sedan') ? 'Sedan' : 'SUV',
          plate: driverDoc?.plate || 'SK-01-A-9999',
          rating: driverDoc?.rating || 5.0,
          area: driverDoc?.coverage || 'Darjeeling • Hill Roads',
          available: driverDoc?.status !== 'Paused',
          active: true,
        },
      });
    }

    const store = await tenantManager.getStoreAsync(decoded.tenantKey);

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
    const cleanAvatar = clerkUser.imageUrl || '';
    const clerkId = clerkUser.id;

    // Profile hints from client
    const { phone, homestayName, location, role, vehicleType, vehicleNumber, area } = req.body;
    const requestedRole = (role === 'driver' ? 'driver' : 'owner') as 'owner' | 'driver';
    const cleanPhone = String(phone || '').trim();
    const cleanName = (clerkUser.fullName || clerkUser.firstName || (requestedRole === 'driver' ? 'Driver' : 'Host')).trim();

    const UserModel = getUserModel(false); // Production DB
    let user = await UserModel.findOne({ $or: [{ clerkId }, { email: cleanEmail }] });

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
      });

      if (userRole === 'driver') {
        const DriverModel = getDriverModel(false);
        const vehicle = vehicleType || 'SUV';
        const plate = vehicleNumber || `SK-01-A-${Math.floor(1000 + Math.random() * 9000)}`;
        const coverage = area || 'Darjeeling • Hill Roads';

        await DriverModel.create({
          ownerId: (user as any)._id,
          id: `DRV-${Date.now().toString().slice(-4)}`,
          name: cleanName,
          phone: cleanPhone,
          email: cleanEmail,
          vehicle,
          plate,
          coverage,
          status: 'Active',
        } as any);
      } else {
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
      const DriverModel = getDriverModel(false);
      const driverDoc = await DriverModel.findOne({ email: cleanEmail });

      return res.json({
        accessToken,
        refreshToken,
        role: 'driver',
        driver: {
          id: driverDoc ? driverDoc._id.toString() : user._id.toString(),
          name: user.name,
          phone: user.phone || '',
          email: user.email,
          vehicle: driverDoc?.vehicle || 'Mahindra Scorpio (SUV)',
          vehicleType: driverDoc?.vehicle?.includes('Sedan') ? 'Sedan' : 'SUV',
          plate: driverDoc?.plate || 'SK-01-A-9999',
          rating: driverDoc?.rating || 5.0,
          area: driverDoc?.coverage || 'Darjeeling • Hill Roads',
          available: driverDoc?.status !== 'Paused',
          active: true,
        },
        isNew,
      });
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
// Trip schedule validation + admin-queue mirror (CabRequest collection)
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
  if (body.isRoundTrip) {
    const returnAt = istDateTime(body.returnDate, body.returnTime);
    if (returnAt === null) return 'Round trips need a return date and time.';
    if (returnAt <= pickupAt) return 'Return must be after the pickup date and time.';
  }
  return null;
}

export const isPayoutEligible = (t: any) =>
  t.status === 'COMPLETED' && t.advancePaid === true && t.commission > 0 && !t.commissionPaid && !t.payoutId;

const newReference = () => `REQ-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
const hashToken = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

// Trip status (owner app) -> CabRequest status (admin queue)
function cabStatusFor(trip: any): string {
  switch (trip.status) {
    case 'QUOTE_RECEIVED': return 'QUOTE_RECEIVED';
    case 'AWAITING_ADVANCE': return 'AWAITING_ADVANCE_PAYMENT';
    case 'CONFIRMED': return trip.advancePaid ? 'CONFIRMED' : 'AWAITING_ADVANCE_PAYMENT';
    case 'DRIVER_ASSIGNED': return 'CONFIRMED'; // owner's own driver, handled by the homestay
    case 'TRIP_STARTED': return 'TRIP_STARTED';
    case 'COMPLETED': return 'COMPLETED';
    case 'CANCELLED': return 'CANCELLED';
    default: return 'FINDING_DRIVER';
  }
}

// Keep the admin-queue copy in step after the owner changes a mirrored trip.
async function syncMirror(tenantKey: string, trip: any) {
  if (!trip?.reference) return;
  try {
    const { getCabRequestModel } = await import('../models/cab-request.model.js');
    await (getCabRequestModel(isDemoKey(tenantKey)) as any).updateOne(
      { reference: trip.reference, propertyId: tenantKey },
      {
        status: cabStatusFor(trip),
        assignedDriverName: trip.driverName || '',
        agreedFare: trip.fare || 0,
        advanceAmount: trip.advanceAmount || 0,
        remainingCashAmount: trip.remainingCashAmount || 0,
        ...(trip.financialSnapshot ? { financialSnapshot: trip.financialSnapshot } : {}),
      }
    );
  } catch (err: any) {
    console.warn('[StayRide] Admin queue sync failed:', err?.message);
  }
}

async function findGuestLink(token: unknown) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
  const { getGuestLinkModel } = await import('../models/guest-link.model.js');
  const tokenHash = hashToken(token);
  for (const isDemo of [false, true]) {
    const link = await getGuestLinkModel(isDemo).findOne({ tokenHash, expiresAt: { $gt: new Date() } }).lean();
    if (link) return link as any;
  }
  return null;
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// ==========================================
// Public Guest Web Cab Requests (secure token link, no login)
// ==========================================
stayrideV1Router.get('/public/guest-links/:token', async (req: Request, res: Response) => {
  const link = await findGuestLink(req.params.token);
  if (!link) return res.status(404).json({ error: { message: 'This link is invalid or has expired.' } });
  const store = await tenantManager.getStoreAsync(link.tenantKey);
  return res.json({
    homestayName: store.homestay.name,
    pickup: store.homestay.location || store.homestay.name,
    guestName: link.guestName,
    guestPhone: link.guestPhone,
    expiresAt: new Date(link.expiresAt).getTime(),
  });
});

stayrideV1Router.post('/public/guest-links/:token/cab-requests', async (req: Request, res: Response) => {
  const link = await findGuestLink(req.params.token);
  if (!link) return res.status(404).json({ error: { message: 'This link is invalid or has expired.' } });

  const b = req.body;
  const guestName = str(b.guestName, 100);
  const guestPhone = str(b.guestPhone, 20);
  const clientRequestId = str(b.clientRequestId, 64);
  const destinations = Array.isArray(b.destinations)
    ? b.destinations.map((d: unknown) => str(typeof d === 'object' && d ? (d as any).address : d, 200)).filter(Boolean)
    : [];
  if (!guestName || !guestPhone) return res.status(400).json({ error: { message: 'Guest name and phone number are required.' } });
  if (!clientRequestId) return res.status(400).json({ error: { message: 'clientRequestId is required.' } });
  if (destinations.length < 1 || destinations.length > 6) return res.status(400).json({ error: { message: 'Add between 1 and 6 destinations.' } });
  const vehicleType = VEHICLE_TYPES.includes(b.vehicleType) ? b.vehicleType : 'SUV';
  const passengers = Math.min(20, Math.max(1, Math.round(Number(b.passengers) || 1)));
  const isRoundTrip = b.isRoundTrip === true;
  const scheduleError = validateSchedule({ ...b, isRoundTrip });
  if (scheduleError) return res.status(400).json({ error: { message: scheduleError } });

  const tenantKey = link.tenantKey as string;
  const isDemo = isDemoKey(tenantKey);
  const { getCabRequestModel } = await import('../models/cab-request.model.js');
  const CabModel = getCabRequestModel(isDemo) as any;

  // Idempotent retries: same clientRequestId returns the original request.
  const existing = await CabModel.findOne({ clientRequestId, propertyId: tenantKey }).lean();
  if (existing) return res.status(201).json({ reference: existing.reference, status: existing.status });

  const store = await tenantManager.getStoreAsync(tenantKey);
  const pickup = str(b.pickup, 200) || store.homestay.location || store.homestay.name || 'Homestay';
  const reference = newReference();
  const trip = store.createTrip(
    {
      guestName,
      phone: guestPhone,
      pickup,
      destination: destinations.join(' ➔ '),
      destinations: destinations.map((address: string, order: number) => ({ address, order })),
      isRoundTrip,
      returnDate: isRoundTrip ? Number(b.returnDate) : undefined,
      returnTime: isRoundTrip ? str(b.returnTime, 10) : undefined,
      date: Number(b.date),
      time: str(b.time, 10),
      passengers,
      vehicleType,
      guestId: link.guestId ?? undefined,
    },
    'GUEST_WEB_LINK'
  );
  trip.reference = reference;

  try {
    await CabModel.create({
      reference,
      propertyId: tenantKey,
      tripId: trip.id,
      clientRequestId,
      homestayName: store.homestay.name || 'Homestay',
      guestId: link.guestId ?? null,
      guestName,
      guestPhone,
      pickupLocation: { address: pickup },
      destinations: trip.destinations,
      isRoundTrip,
      returnDate: trip.returnDate,
      returnTime: trip.returnTime || '',
      date: trip.date,
      time: trip.time,
      passengers,
      vehicleType,
      requestSource: 'GUEST_WEB_LINK',
      status: 'FINDING_DRIVER',
      guestNotes: str(b.notes, 500),
    });
  } catch (err: any) {
    store.trips = store.trips.filter((t) => t !== trip);
    if (err?.code === 11000) {
      const dup = await CabModel.findOne({ clientRequestId, propertyId: tenantKey }).lean();
      if (dup) return res.status(201).json({ reference: dup.reference, status: dup.status });
    }
    throw err;
  }

  await tenantManager.persistTenant(tenantKey);
  return res.status(201).json({ reference, status: 'FINDING_DRIVER' });
});

stayrideV1Router.get('/public/cab-requests/:reference', async (req: Request, res: Response) => {
  const link = await findGuestLink(req.query.t);
  if (!link) return res.status(404).json({ error: { message: 'This link is invalid or has expired.' } });
  const { getCabRequestModel } = await import('../models/cab-request.model.js');
  const doc = await (getCabRequestModel(isDemoKey(link.tenantKey)) as any)
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
  });
});

// Advance payments are recorded only by an admin (audited reconciliation) until a
// payment gateway with signed webhooks is integrated. There is no public pay endpoint.

// Driver app: only trips assigned to this driver (matched by phone), never other tenants' requests.
stayrideV1Router.get('/driver/trips', authenticateStayRide, async (req: Request, res: Response) => {
  const authUser = (req as any).stayrideUser as StayRideAuthPayload;

  if (authUser.isDemo) {
    const store = await tenantManager.getStoreAsync('demo@stayride.in');
    return res.json(store.trips.filter((t) => t.status !== 'CANCELLED'));
  }
  if (authUser.role !== 'driver') {
    return res.status(403).json({ error: { message: 'Driver account required.' } });
  }

  const user = await getUserModel(false).findById(authUser.id).select('phone').lean();
  const digits = String((user as any)?.phone || '').replace(/\D/g, '').slice(-10);
  if (digits.length < 10) return res.json([]);

  const { getCabRequestModel } = await import('../models/cab-request.model.js');
  const trips = await (getCabRequestModel(false) as any)
    .find({ assignedDriverPhone: { $regex: `${digits}$` } })
    .select('reference homestayName pickupLocation destinations isRoundTrip returnDate returnTime date time passengers vehicleType status agreedFare advanceAmount advancePaid remainingCashAmount guestName guestPhone')
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  return res.json(trips);
});

// Raw body is required for the svix signature check (see app.ts).
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
        // Match by Clerk id, or by email only if that account isn't linked to another Clerk user.
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
        await UserModel.deleteOne({ clerkId });
      }
    }

    return res.json({ received: true });
  } catch (err: any) {
    console.error('[StayRide] Webhook handling error:', err?.message);
    return res.status(500).json({ error: { message: 'Webhook processing failed.' } });
  }
});

// Enforce JWT authentication on all data routes
stayrideV1Router.use(authenticateStayRide);

// Owner-only middleware for routes restricted to homestay owners
const ownerOnly = (req: Request, res: Response, next: () => void) => {
  if ((req as any).stayrideUser?.role === 'driver') {
    return res.status(403).json({ error: { message: 'This action is for homestay owners only.' } });
  }
  next();
};

// ==========================================
// Change password for email/password (non-Clerk) accounts.
// Clerk users change their password through Clerk on the client.
// ==========================================
stayrideV1Router.post('/auth/set-password', async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).stayrideUser as StayRideAuthPayload | undefined;
    if (!authUser || !authUser.email) {
      return res.status(401).json({ error: { message: 'Authentication required.' } });
    }
    if (authUser.isDemo) {
      return res.status(403).json({ error: { message: 'The demo account password cannot be changed.' } });
    }

    const { currentPassword, newPassword } = req.body;
    if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 8) {
      return res.status(400).json({ error: { message: 'Password must be at least 8 characters long.' } });
    }

    const UserModel = getUserModel(false);
    const user = mongoose.Types.ObjectId.isValid(authUser.id) ? await UserModel.findById(authUser.id) : null;
    if (!user) {
      return res.status(404).json({ error: { message: 'User account not found.' } });
    }

    if (typeof currentPassword !== 'string' || !(await user.comparePassword(currentPassword.trim()))) {
      return res.status(401).json({ error: { message: 'Current password is incorrect.' } });
    }

    // Plain value: the User pre-save hook hashes it exactly once.
    user.password = newPassword.trim();
    await user.save();

    return res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err: any) {
    console.error('[Set-Password Error]:', err?.message);
    return res.status(500).json({ error: { message: 'Failed to update password.' } });
  }
});

// ==========================================
// Snapshot (Single high-speed aggregator)
// ==========================================
stayrideV1Router.get('/snapshot', async (req: Request, res: Response) => {
  const authUser = (req as any).stayrideUser as StayRideAuthPayload;
  const isDriver = authUser?.role === 'driver';

  if (isDriver) {
    const { getCabRequestModel } = await import('../models/cab-request.model.js');
    const user = mongoose.Types.ObjectId.isValid(authUser.id)
      ? await getUserModel(authUser.isDemo).findById(authUser.id).lean()
      : null;
    const DriverModel = getDriverModel(authUser.isDemo);
    const driverDoc = await DriverModel.findOne({ email: authUser.email }).lean();

    let trips: any[] = [];
    if (authUser.isDemo) {
      const demoStore = await tenantManager.getStoreAsync('demo@stayride.in');
      trips = demoStore.trips.filter((t) => t.status !== 'CANCELLED');
    } else {
      const digits = String((user as any)?.phone || driverDoc?.phone || '').replace(/\D/g, '').slice(-10);
      const cabModel = getCabRequestModel(false);
      const query: any =
        digits.length >= 10
          ? {
              $or: [
                { status: { $in: ['NEW_REQUEST', 'FINDING_DRIVER', 'QUOTE_RECEIVED'] } },
                { assignedDriverPhone: { $regex: `${digits}$` } },
              ],
            }
          : { status: { $in: ['NEW_REQUEST', 'FINDING_DRIVER', 'QUOTE_RECEIVED'] } };

      const dbTrips = await (cabModel as any).find(query).sort({ createdAt: -1 }).limit(50).lean();
      trips = dbTrips.map((doc: any, idx: number) => ({
        id: doc.tripId || 1000 + idx,
        guestName: doc.guestName || 'Mountain Guest',
        phone: doc.guestPhone || '',
        pickup: doc.pickupLocation || 'Homestay',
        destination: doc.destinations?.[0]?.address || 'Sightseeing',
        destinations: doc.destinations || [],
        isRoundTrip: doc.isRoundTrip || false,
        returnDate: doc.returnDate ? new Date(doc.returnDate).getTime() : undefined,
        returnTime: doc.returnTime,
        date: doc.date ? new Date(doc.date).getTime() : Date.now(),
        time: doc.time || '09:00 AM',
        passengers: doc.passengers || 2,
        vehicleType: doc.vehicleType || 'SUV',
        estFare: doc.agreedFare || 3000,
        fare: doc.agreedFare || 0,
        status: doc.status === 'ARRIVED_HOMESTAY' || doc.status === 'EN_ROUTE_PICKUP' ? 'DRIVER_ASSIGNED' : doc.status,
        driverId: doc.assignedDriverPhone ? Number(digits) : null,
        driverName: doc.assignedDriverName || null,
        ownerDriver: false,
        commission: 0,
        commissionPaid: false,
        reference: doc.reference,
        advanceAmount: doc.advanceAmount,
        advancePaid: doc.advancePaid,
        remainingCashAmount: doc.remainingCashAmount,
      }));
    }

    return res.json({
      homestay: {
        name: 'StayRide Driver Portal',
        ownerName: (user as any)?.name || 'Driver',
        location: driverDoc?.coverage || 'Sikkim',
        description: 'Verified Mountain Driver Partner',
        phone: (user as any)?.phone || driverDoc?.phone || '',
        email: authUser.email,
        link: '',
        mapQuery: '',
        amenities: [],
        photos: [],
      },
      rooms: [],
      guests: [],
      bookings: [],
      drivers: [],
      networkDrivers: [],
      trips,
      campaigns: [],
    });
  }

  const { store, tenantKey } = await getStoreForReq(req);
  const { CommissionService } = await import('../services/commission.service.js');
  const { pfPercent, hcPercent, advancePercent } = await CommissionService.getEffectiveRates(tenantKey);

  let poolDrivers = store.networkDrivers;
  if (!authUser.isDemo) {
    try {
      const DriverModel = getDriverModel(false);
      const dbDrivers = await DriverModel.find({ status: { $in: ['Active', 'Invited'] } }).limit(50).lean();
      if (dbDrivers.length > 0) {
        poolDrivers = dbDrivers.map((d: any, idx: number) => ({
          id: 300 + idx,
          name: d.name,
          phone: d.phone,
          vehicle: d.vehicle || 'SUV',
          vehicleType: (d.vehicle?.includes('Sedan') ? 'Sedan' : d.vehicle?.includes('7') ? '7-seater' : d.vehicle?.includes('9') ? '9-seater' : 'SUV') as any,
          seats: d.seats || 6,
          rating: d.rating || 4.9,
          area: d.coverage || 'Hill Stand',
          trips: ['NJP', 'Bagdogra', 'Local', 'Sightseeing'],
          available: d.status === 'Active',
          active: true,
          ownerDriver: false,
        }));
      }
    } catch (err) {
      console.warn('[StayRide] Failed to fetch real network drivers for snapshot:', err);
    }
  }

  res.json({
    commissionRates: { pfPercent, hcPercent, advancePercent },
    homestay: store.homestay,
    rooms: store.rooms,
    guests: store.guests,
    bookings: store.bookings,
    drivers: store.drivers,
    networkDrivers: poolDrivers,
    trips: store.trips,
    campaigns: store.campaigns,
  });
});

// ==========================================
// Homestay Profile
// ==========================================
stayrideV1Router.get('/homestay', async (req: Request, res: Response) => {
  const { store } = await getStoreForReq(req);
  res.json(store.homestay);
});

stayrideV1Router.put('/homestay', ownerOnly, async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  Object.assign(store.homestay, pick(req.body, WRITABLE.homestay));
  await tenantManager.persistTenant(tenantKey);
  res.json(store.homestay);
});

// ==========================================
// Rooms (bare JSON array expected)
// ==========================================
stayrideV1Router.get('/rooms', async (req: Request, res: Response) => {
  const { store } = await getStoreForReq(req);
  res.json(store.rooms);
});

stayrideV1Router.post('/rooms', ownerOnly, async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const created = store.createRoom(req.body);
  await tenantManager.persistTenant(tenantKey);
  res.status(201).json(created);
});

stayrideV1Router.put('/rooms/:id', ownerOnly, async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const updated = store.updateRoom(Number(req.params.id), req.body);
  if (!updated) return res.status(404).json({ error: { message: 'Room not found' } });
  await tenantManager.persistTenant(tenantKey);
  res.json(updated);
});

stayrideV1Router.patch('/rooms/:id/status', ownerOnly, async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const updated = store.updateRoom(Number(req.params.id), { status: req.body.status });
  if (!updated) return res.status(404).json({ error: { message: 'Room not found' } });
  await tenantManager.persistTenant(tenantKey);
  res.json(updated);
});

stayrideV1Router.delete('/rooms/:id', ownerOnly, async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  store.deleteRoom(Number(req.params.id));
  await tenantManager.persistTenant(tenantKey);
  res.json({ success: true });
});

// ==========================================
// Guests (bare JSON array expected)
// ==========================================
stayrideV1Router.get('/guests', async (req: Request, res: Response) => {
  const { store } = await getStoreForReq(req);
  res.json(store.guests);
});

stayrideV1Router.post('/guests', ownerOnly, async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const created = store.createGuest(req.body);
  await tenantManager.persistTenant(tenantKey);
  res.status(201).json(created);
});

stayrideV1Router.put('/guests/:id', ownerOnly, async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const updated = store.updateGuest(Number(req.params.id), req.body);
  if (!updated) return res.status(404).json({ error: { message: 'Guest not found' } });
  await tenantManager.persistTenant(tenantKey);
  res.json(updated);
});

stayrideV1Router.delete('/guests/:id', ownerOnly, async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  store.deleteGuest(Number(req.params.id));
  await tenantManager.persistTenant(tenantKey);
  res.json({ success: true });
});

// ==========================================
// Bookings (bare JSON array expected)
// ==========================================
stayrideV1Router.get('/bookings', async (req: Request, res: Response) => {
  const { store } = await getStoreForReq(req);
  res.json(store.bookings);
});

stayrideV1Router.post('/bookings', ownerOnly, async (req: Request, res: Response) => {
  try {
    const { store, tenantKey } = await getStoreForReq(req);
    const created = store.createBooking(req.body);
    await tenantManager.persistTenant(tenantKey);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ error: { message: err?.message || 'Failed to create booking' } });
  }
});

stayrideV1Router.post('/bookings/:id/check-in', ownerOnly, async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const b = store.checkInBooking(Number(req.params.id));
  if (!b) return res.status(404).json({ error: { message: 'Booking not found' } });
  await tenantManager.persistTenant(tenantKey);
  res.json(b);
});

stayrideV1Router.post('/bookings/:id/check-out', ownerOnly, async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const b = store.checkOutBooking(Number(req.params.id));
  if (!b) return res.status(404).json({ error: { message: 'Booking not found' } });
  await tenantManager.persistTenant(tenantKey);
  res.json(b);
});

stayrideV1Router.post('/bookings/:id/cancel', ownerOnly, async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const b = store.cancelBooking(Number(req.params.id));
  if (!b) return res.status(404).json({ error: { message: 'Booking not found' } });
  await tenantManager.persistTenant(tenantKey);
  res.json(b);
});

stayrideV1Router.patch('/bookings/:id/payment', ownerOnly, async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const b = store.setBookingPaid(Number(req.params.id), Boolean(req.body?.paid));
  if (!b) return res.status(404).json({ error: { message: 'Booking not found' } });
  await tenantManager.persistTenant(tenantKey);
  res.json(b);
});

stayrideV1Router.post('/bookings/:id/room', ownerOnly, async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const b = store.changeBookingRoom(Number(req.params.id), req.body?.roomNumber);
  if (!b) return res.status(404).json({ error: { message: 'Booking not found' } });
  await tenantManager.persistTenant(tenantKey);
  res.json(b);
});

stayrideV1Router.delete('/bookings/:id', ownerOnly, async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  store.deleteBooking(Number(req.params.id));
  await tenantManager.persistTenant(tenantKey);
  res.json({ success: true });
});

// ==========================================
// Drivers (bare JSON array expected)
// ==========================================
stayrideV1Router.get('/drivers', async (req: Request, res: Response) => {
  const { store } = await getStoreForReq(req);
  const scope = req.query.scope;
  if (scope === 'network') {
    const authUser = (req as any).stayrideUser as StayRideAuthPayload;
    if (authUser?.isDemo) {
      return res.json(store.networkDrivers);
    }
    // Query MongoDB for registered active drivers
    try {
      const DriverModel = getDriverModel(false);
      const dbDrivers = await DriverModel.find({ status: { $in: ['Active', 'Invited'] } }).limit(50).lean();
      if (dbDrivers.length > 0) {
        const mapped = dbDrivers.map((d: any, idx: number) => ({
          id: 300 + idx,
          name: d.name,
          phone: d.phone,
          vehicle: d.vehicle || 'SUV',
          vehicleType: (d.vehicle?.includes('Sedan') ? 'Sedan' : d.vehicle?.includes('7') ? '7-seater' : d.vehicle?.includes('9') ? '9-seater' : 'SUV') as any,
          seats: d.seats || 6,
          rating: d.rating || 4.9,
          area: d.coverage || 'Hill Stand',
          trips: ['NJP', 'Bagdogra', 'Local', 'Sightseeing'],
          available: d.status === 'Active',
          active: true,
          ownerDriver: false,
        }));
        return res.json(mapped);
      }
    } catch (err) {
      console.warn('[StayRide] Failed to fetch real network drivers from DB:', err);
    }
    return res.json(store.networkDrivers);
  } else {
    res.json(store.drivers);
  }
});

stayrideV1Router.post('/drivers', ownerOnly, async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const created = store.createDriver(req.body);

  // Determine if this is demo or production database
  const isDemo = isDemoKey(tenantKey);
  const UserModel = getUserModel(isDemo);

  // Automatically create account in MongoDB with role: "driver"
  try {
    const cleanPhone = (req.body.phone || '').trim();
    const cleanName = (req.body.name || 'Driver').trim();
    const driverEmail = cleanPhone
      ? `${cleanPhone.replace(/[^0-9]/g, '')}@driver.stayride.in`
      : `driver-${Date.now()}@stayride.in`;

    const existingUser = cleanPhone ? await UserModel.findOne({ phone: cleanPhone }) : null;
    if (!existingUser) {
      await UserModel.create({
        name: cleanName,
        email: driverEmail,
        password: crypto.randomBytes(32).toString('hex'), // no host-app login for drivers
        phone: cleanPhone,
        role: 'driver',
      });
      console.log(`✅ Driver account created in MongoDB with role: 'driver' for ${cleanName} (${cleanPhone})`);
    }
  } catch (err) {
    console.warn('[StayRide] Driver user sync warning:', err);
  }

  await tenantManager.persistTenant(tenantKey);
  res.status(201).json(created);
});

stayrideV1Router.put('/drivers/:id', ownerOnly, async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const updated = store.updateDriver(Number(req.params.id), req.body);
  if (!updated) return res.status(404).json({ error: { message: 'Driver not found' } });
  await tenantManager.persistTenant(tenantKey);
  res.json(updated);
});

stayrideV1Router.patch('/drivers/:id/availability', ownerOnly, async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const updated = store.updateDriver(Number(req.params.id), { available: Boolean(req.body?.available) });
  if (!updated) return res.status(404).json({ error: { message: 'Driver not found' } });
  await tenantManager.persistTenant(tenantKey);
  res.json(updated);
});

stayrideV1Router.patch('/drivers/:id/active', ownerOnly, async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const updated = store.updateDriver(Number(req.params.id), { active: Boolean(req.body?.active) });
  if (!updated) return res.status(404).json({ error: { message: 'Driver not found' } });
  await tenantManager.persistTenant(tenantKey);
  res.json(updated);
});

stayrideV1Router.delete('/drivers/:id', ownerOnly, async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  store.deleteDriver(Number(req.params.id));
  await tenantManager.persistTenant(tenantKey);
  res.json({ success: true });
});

// ==========================================
// Trips (bare JSON array expected)
// ==========================================
stayrideV1Router.get('/trips', async (req: Request, res: Response) => {
  const authUser = (req as any).stayrideUser as StayRideAuthPayload;
  if (authUser?.role === 'driver') {
    if (authUser.isDemo) {
      const demoStore = await tenantManager.getStoreAsync('demo@stayride.in');
      return res.json(demoStore.trips.filter((t) => t.status !== 'CANCELLED'));
    }
    try {
      const { getCabRequestModel } = await import('../models/cab-request.model.js');
      const user = await getUserModel(false).findById(authUser.id).select('phone').lean();
      const digits = String((user as any)?.phone || '').replace(/\D/g, '').slice(-10);
      const cabModel = getCabRequestModel(false);
      const query: any =
        digits.length >= 10
          ? {
              $or: [
                { status: { $in: ['NEW_REQUEST', 'FINDING_DRIVER', 'QUOTE_RECEIVED'] } },
                { assignedDriverPhone: { $regex: `${digits}$` } },
              ],
            }
          : { status: { $in: ['NEW_REQUEST', 'FINDING_DRIVER', 'QUOTE_RECEIVED'] } };
      const dbTrips = await (cabModel as any).find(query).sort({ createdAt: -1 }).limit(50).lean();
      const mapped = dbTrips.map((doc: any, idx: number) => ({
        id: doc.tripId || 1000 + idx,
        guestName: doc.guestName || 'Mountain Guest',
        phone: doc.guestPhone || '',
        pickup: doc.pickupLocation || 'Homestay',
        destination: doc.destinations?.[0]?.address || 'Sightseeing',
        destinations: doc.destinations || [],
        isRoundTrip: doc.isRoundTrip || false,
        returnDate: doc.returnDate ? new Date(doc.returnDate).getTime() : undefined,
        returnTime: doc.returnTime,
        date: doc.date ? new Date(doc.date).getTime() : Date.now(),
        time: doc.time || '09:00 AM',
        passengers: doc.passengers || 2,
        vehicleType: doc.vehicleType || 'SUV',
        estFare: doc.agreedFare || 3000,
        fare: doc.agreedFare || 0,
        status: doc.status === 'ARRIVED_HOMESTAY' || doc.status === 'EN_ROUTE_PICKUP' ? 'DRIVER_ASSIGNED' : doc.status,
        driverId: doc.assignedDriverPhone ? Number(digits) : null,
        driverName: doc.assignedDriverName || null,
        ownerDriver: false,
        commission: 0,
        commissionPaid: false,
        reference: doc.reference,
        advanceAmount: doc.advanceAmount,
        advancePaid: doc.advancePaid,
        remainingCashAmount: doc.remainingCashAmount,
      }));
      return res.json(mapped);
    } catch (err) {
      console.warn('[StayRide] Driver trips fetch fallback to store:', err);
    }
  }

  const { store } = await getStoreForReq(req);
  res.json(store.trips);
});

stayrideV1Router.post('/trips', ownerOnly, async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const scheduleError = validateSchedule(req.body);
  if (scheduleError) return res.status(400).json({ error: { message: scheduleError } });
  const created = store.createTrip(req.body);
  await tenantManager.persistTenant(tenantKey);
  res.status(201).json(created);
});

stayrideV1Router.post('/trips/:id/assign', ownerOnly, async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const updated = store.assignTrip(Number(req.params.id), Number(req.body?.driverId));
  if (!updated) return res.status(404).json({ error: { message: 'Trip not found' } });
  await tenantManager.persistTenant(tenantKey);
  await syncMirror(tenantKey, updated);
  res.json(updated);
});

stayrideV1Router.post('/trips/:id/accept', async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const updated = store.acceptTrip(Number(req.params.id));
  if (!updated) return res.status(404).json({ error: { message: 'Trip not found' } });
  await tenantManager.persistTenant(tenantKey);
  await syncMirror(tenantKey, updated);
  res.json(updated);
});

stayrideV1Router.post('/trips/:id/reassign', ownerOnly, async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const updated = store.reassignTrip(Number(req.params.id));
  if (!updated) return res.status(404).json({ error: { message: 'Trip not found' } });
  await tenantManager.persistTenant(tenantKey);
  await syncMirror(tenantKey, updated);
  res.json(updated);
});

stayrideV1Router.post('/trips/:id/start', async (req: Request, res: Response) => {
  try {
    const { store, tenantKey } = await getStoreForReq(req);
    const updated = store.startTrip(Number(req.params.id));
    if (!updated) return res.status(404).json({ error: { message: 'Trip not found' } });
    await tenantManager.persistTenant(tenantKey);
    await syncMirror(tenantKey, updated);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: { message: err?.message || 'Cannot start trip' } });
  }
});

stayrideV1Router.post('/trips/:id/quote', async (req: Request, res: Response) => {
  const authUser = (req as any).stayrideUser as StayRideAuthPayload;
  const driverId = Number(req.body?.driverId);
  const quotedFare = Number(req.body?.quotedFare);
  if (!quotedFare || quotedFare <= 0) {
    return res.status(400).json({ error: { message: 'Valid numeric quotedFare is required' } });
  }

  const effectiveDriverId = driverId || 201;
  const { store, tenantKey } = await getStoreForReq(req);
  let updated = store.quoteTrip(Number(req.params.id), effectiveDriverId, quotedFare);

  if (!updated && authUser?.role === 'driver') {
    const demoStore = await tenantManager.getStoreAsync('demo@stayride.in');
    updated = demoStore.quoteTrip(Number(req.params.id), effectiveDriverId, quotedFare);
    if (updated) {
      await tenantManager.persistTenant('demo@stayride.in');
      return res.json(updated);
    }
  }

  if (!updated) return res.status(404).json({ error: { message: 'Trip not found' } });
  await tenantManager.persistTenant(tenantKey);
  res.json(updated);
});

stayrideV1Router.post('/trips/:id/confirm-quote', ownerOnly, async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const driverId = Number(req.body?.driverId);
  const agreedFare = Number(req.body?.agreedFare);
  if (!driverId || !agreedFare || agreedFare <= 0) {
    return res.status(400).json({ error: { message: 'Valid driverId and numeric agreedFare are required' } });
  }

  // Calculate dynamic financial snapshot
  const { CommissionService } = await import('../services/commission.service.js');
  if (store.trip(Number(req.params.id))?.advancePaid) {
    return res.status(409).json({ error: { message: 'Advance already paid; the fare is locked.' } });
  }

  const split = await CommissionService.calculateSplit(agreedFare, tenantKey);

  const snapshot = {
    agreedFare: split.agreedFare,
    advanceAmount: split.advanceAmount,
    advancePaid: false,
    platformFeeRate: split.platformFeeRate,
    platformFeeAmount: split.platformFeeAmount,
    homestayCommissionRate: split.homestayCommissionRate,
    homestayCommissionAmount: split.homestayCommissionAmount,
    driverPayoutAmount: split.driverPayoutAmount,
    remainingCashToDriver: split.remainingCashToDriver,
    calculatedAt: new Date(),
  };

  const updated = store.confirmTripQuote(Number(req.params.id), driverId, agreedFare, snapshot);
  if (!updated) return res.status(404).json({ error: { message: 'Trip not found' } });
  await tenantManager.persistTenant(tenantKey);
  await syncMirror(tenantKey, updated);
  res.json(updated);
});

stayrideV1Router.post('/trips/:id/complete', async (req: Request, res: Response) => {
  try {
    const { store, tenantKey } = await getStoreForReq(req);
    const { CommissionService } = await import('../services/commission.service.js');
    const rates = await CommissionService.getEffectiveRates(tenantKey);
    const hcRate = rates.hcPercent / 100;
    const updated = store.completeTrip(Number(req.params.id), req.body?.finalFare, hcRate);
    if (!updated) return res.status(404).json({ error: { message: 'Trip not found' } });
    await tenantManager.persistTenant(tenantKey);
    await syncMirror(tenantKey, updated);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: { message: err?.message || 'Cannot complete trip' } });
  }
});

stayrideV1Router.post('/trips/:id/cancel', async (req: Request, res: Response) => {
  try {
    const { store, tenantKey } = await getStoreForReq(req);
    const updated = store.cancelTrip(Number(req.params.id));
    if (!updated) return res.status(404).json({ error: { message: 'Trip not found' } });
    await tenantManager.persistTenant(tenantKey);
    await syncMirror(tenantKey, updated);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: { message: err?.message || 'Cannot cancel trip' } });
  }
});

stayrideV1Router.post('/trips/:id/commission/pay', ownerOnly, async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const updated = store.payCommission(Number(req.params.id), Boolean(req.body?.paid));
  if (!updated) return res.status(404).json({ error: { message: 'Trip not found' } });
  await tenantManager.persistTenant(tenantKey);
  res.json(updated);
});

// ==========================================
// Guest "Ask for Cab" secure links
// ==========================================
stayrideV1Router.post('/guest-links', async (req: Request, res: Response) => {
  const { tenantKey } = await getStoreForReq(req);
  const guestName = str(req.body.guestName, 100);
  const guestPhone = str(req.body.guestPhone, 20);
  if (!guestName || !guestPhone) {
    return res.status(400).json({ error: { message: 'Guest name and phone are required.' } });
  }
  const guestId = Number(req.body.guestId);
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 7 * DAY_MS);
  const { getGuestLinkModel } = await import('../models/guest-link.model.js');
  await getGuestLinkModel(isDemoKey(tenantKey)).create({
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
// Campaigns (bare JSON array expected)
// ==========================================
stayrideV1Router.get('/campaigns', ownerOnly, async (req: Request, res: Response) => {
  const { store } = await getStoreForReq(req);
  res.json(store.campaigns);
});

stayrideV1Router.post('/campaigns', ownerOnly, async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const { title, message, audience } = req.body;
  const created = store.createCampaign(title, message, audience);
  await tenantManager.persistTenant(tenantKey);
  res.status(201).json(created);
});

stayrideV1Router.post('/campaigns/:id/send', ownerOnly, async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const sent = store.sendCampaign(Number(req.params.id));
  if (!sent) return res.status(404).json({ error: { message: 'Campaign not found' } });
  await tenantManager.persistTenant(tenantKey);
  res.json(sent);
});

stayrideV1Router.delete('/campaigns/:id', ownerOnly, async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  store.deleteCampaign(Number(req.params.id));
  await tenantManager.persistTenant(tenantKey);
  res.json({ success: true });
});

// ==========================================
// Homestay Owner Commission Payouts / Redemptions
// ==========================================

// 1. Owner requests commission payout (UPI or Bank)
stayrideV1Router.post('/payouts/request', ownerOnly, async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).stayrideUser as StayRideAuthPayload;
    const { amount, payoutMethod, upiId, bankDetails } = req.body;
    const withdrawAmount = Number(amount);

    if (!withdrawAmount || withdrawAmount <= 0) {
      return res.status(400).json({ error: { message: 'A positive payout amount is required.' } });
    }

    if (payoutMethod === 'BANK_TRANSFER') {
      if (!bankDetails?.accountNumber || !bankDetails?.ifscCode) {
        return res.status(400).json({ error: { message: 'Bank account number and IFSC code are required.' } });
      }
    } else {
      if (!upiId || typeof upiId !== 'string' || !upiId.includes('@')) {
        return res.status(400).json({ error: { message: 'A valid UPI ID (e.g. yourname@okhdfcbank) is required.' } });
      }
    }

    const { store, tenantKey } = await getStoreForReq(req);
    // Find already requested pending payouts to lock those trips from double withdrawal
    const PayoutModel = getPayoutRequestModel(authUser.isDemo);
    const pendingPayoutDocs = await (PayoutModel as any).find({
      tenantId: tenantKey,
      status: 'PENDING',
    });
    const alreadyLockedTripIds = new Set<number>(
      pendingPayoutDocs.flatMap((p: any) => p.tripIds || [])
    );

    const eligibleTrips = store.trips.filter(
      (t) => isPayoutEligible(t) && !alreadyLockedTripIds.has(t.id)
    );
    const availablePending = eligibleTrips.reduce((acc, t) => acc + t.commission, 0);

    if (availablePending <= 0) {
      return res.status(400).json({
        error: { message: 'You have no eligible pending commission to withdraw at this time.' },
      });
    }

    if (withdrawAmount > availablePending) {
      return res.status(400).json({
        error: {
          message: `Requested payout (₹${withdrawAmount.toLocaleString()}) exceeds your withdrawable balance of ₹${availablePending.toLocaleString()}.`,
        },
      });
    }

    // Allocate exact trips that correspond to this payout:
    // If withdrawAmount === availablePending, all eligible trips are locked.
    // Otherwise, pick trips greedily (oldest first) up to withdrawAmount
    let selectedTrips: typeof eligibleTrips = [];
    if (withdrawAmount === availablePending) {
      selectedTrips = [...eligibleTrips];
    } else {
      let accum = 0;
      for (const t of [...eligibleTrips].reverse()) {
        if (accum + t.commission <= withdrawAmount) {
          selectedTrips.push(t);
          accum += t.commission;
        }
      }
      if (accum !== withdrawAmount) {
        return res.status(400).json({
          error: {
            message: `Payout amount (₹${withdrawAmount.toLocaleString()}) cannot be split across partial trip commissions. Please redeem exact trip totals (e.g. ₹${accum > 0 ? accum.toLocaleString() : availablePending.toLocaleString()}) or your full balance of ₹${availablePending.toLocaleString()}.`,
          },
        });
      }
    }

    const tripIds = selectedTrips.map((t) => t.id);

    const payoutReq = await PayoutModel.create({
      tenantId: tenantKey,
      homestayName: store.homestay.name || 'My Homestay',
      ownerName: store.homestay.ownerName || authUser.email,
      ownerPhone: store.homestay.phone || '',
      amount: withdrawAmount,
      tripIds,
      payoutMethod: payoutMethod || 'UPI',
      upiId: upiId ? upiId.trim() : undefined,
      bankDetails: bankDetails || undefined,
      status: 'PENDING',
      isDemo: authUser.isDemo,
      requestedAt: new Date(),
    });

    return res.status(201).json({
      success: true,
      message: `Payout request of ₹${withdrawAmount.toLocaleString()} submitted for admin settlement.`,
      payout: payoutReq,
    });
  } catch (err: any) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: { message: 'You already have a payout request pending. Wait until it is settled.' } });
    }
    console.error('[StayRide] Payout request error:', err);
    return res.status(500).json({ error: { message: err?.message || 'Failed to submit payout request.' } });
  }
});

// 2. Owner checks their own payout history
stayrideV1Router.get('/payouts/history', async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).stayrideUser as StayRideAuthPayload;
    const { tenantKey } = await getStoreForReq(req);
    const PayoutModel = getPayoutRequestModel(authUser.isDemo);
    const history = await PayoutModel.find({ tenantId: tenantKey }).sort({ requestedAt: -1 }).limit(50);
    return res.json(history);
  } catch (err: any) {
    return res.status(500).json({ error: { message: 'Failed to fetch payout history.' } });
  }
});

// Admin payout listing/settlement lives only in /api/v1/admin (admin role required).

// ==========================================
// Demo Controls
// ==========================================
const demoOnly = (req: Request, res: Response, next: () => void) =>
  (req as any).stayrideUser?.isDemo ? next() : res.status(403).json({ error: { message: 'Demo accounts only.' } });

stayrideV1Router.post('/demo/reset', demoOnly, (_req: Request, res: Response) => {
  tenantManager.resetDemoStore();
  res.json({ success: true, message: 'Mountain View Homestay demo showcase reseeded' });
});

stayrideV1Router.post('/dev/seed', demoOnly, (_req: Request, res: Response) => {
  tenantManager.resetDemoStore();
  res.json({ success: true, message: 'StayRide demo dataset reseeded' });
});

export default stayrideV1Router;
