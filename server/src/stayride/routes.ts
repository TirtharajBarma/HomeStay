import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { tenantManager, StayRideMemoryStore, StayRideTenantModel } from './store.js';
import { User } from '../models/user.model.js';
import { Property } from '../models/property.model.js';

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

import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

interface StayRideAuthPayload {
  id: string;
  email: string;
  role: string;
  tenantKey: string;
  isDemo: boolean;
}

const stayrideV1Router = Router();

// ==========================================
// Tenant Resolution & Auth Middleware
// ==========================================
async function getStoreForReq(req: Request): Promise<{ store: StayRideMemoryStore; tenantKey: string; isDemo: boolean }> {
  // If authenticateStayRide ran, user is in (req as any).stayrideUser
  const authUser = (req as any).stayrideUser as StayRideAuthPayload | undefined;
  if (authUser && authUser.tenantKey) {
    const store = await tenantManager.getStoreAsync(authUser.tenantKey);
    return { store, tenantKey: authUser.tenantKey, isDemo: Boolean(authUser.isDemo) };
  }

  // Fallback: verify header if called directly
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as StayRideAuthPayload;
      if (decoded && decoded.tenantKey) {
        const store = await tenantManager.getStoreAsync(decoded.tenantKey);
        return { store, tenantKey: decoded.tenantKey, isDemo: Boolean(decoded.isDemo) };
      }
    } catch {
      // Invalid token
    }
  }

  // Default demo fallback for unauthenticated development queries
  const store = await tenantManager.getStoreAsync('demo@stayride.in');
  return { store, tenantKey: 'demo@stayride.in', isDemo: true };
}

// Middleware that enforces valid JWT on protected routes
function authenticateStayRide(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: { message: 'Authentication required. Missing Bearer token.' } });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as StayRideAuthPayload;
    if (!decoded || !decoded.tenantKey) {
      return res.status(401).json({ error: { message: 'Invalid token payload.' } });
    }
    (req as any).stayrideUser = decoded;
    next();
  } catch (err: any) {
    return res.status(401).json({ error: { message: 'Invalid or expired token. Please sign in again.' } });
  }
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

  const isDemoAccount =
    cleanEmail === 'demo@stayride.in' && (cleanPass === 'demo123' || cleanPass === 'demo');

  // 1. DEMO ACCOUNT LOGIN
  if (isDemoAccount) {
    const tenantKey = 'demo@stayride.in';
    const store = await tenantManager.getStoreAsync(tenantKey);

    const tokenPayload: StayRideAuthPayload = {
      id: 'demo-owner-1',
      email: 'demo@stayride.in',
      role: 'owner',
      tenantKey: 'demo@stayride.in',
      isDemo: true,
    };

    const accessToken = jwt.sign(tokenPayload, config.jwtSecret, { expiresIn: '30d' });
    const refreshToken = jwt.sign({ ...tokenPayload, type: 'refresh' }, config.jwtSecret, { expiresIn: '60d' });

    return res.json({
      accessToken,
      refreshToken,
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
      role: user.role || 'owner',
      tenantKey,
      isDemo: false,
    };

    const accessToken = jwt.sign(tokenPayload, config.jwtSecret, { expiresIn: '30d' });
    const refreshToken = jwt.sign({ ...tokenPayload, type: 'refresh' }, config.jwtSecret, { expiresIn: '60d' });

    return res.json({
      accessToken,
      refreshToken,
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
  const { name, phone, email, password, homestayName, location } = req.body;
  const cleanEmail = (email || '').toLowerCase().trim();
  const cleanPhone = (phone || '').trim();
  const cleanName = (name || 'Host').trim();
  const cleanHomestay = (homestayName || 'My Homestay').trim();
  const cleanLocation = (location || '').trim();
  const cleanPass = (password || '').trim();

  if (!cleanEmail) {
    return res.status(400).json({ error: { message: 'Email address is required.' } });
  }
  if (!cleanPass) {
    return res.status(400).json({ error: { message: 'Password is required.' } });
  }

  // Prevent duplicate signup wiping existing account! (P0 #2)
  try {
    const UserModel = getUserModel(false);
    const existingUser = await UserModel.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(409).json({
        error: { message: 'An account with this email already exists. Please sign in instead.' },
      });
    }

    const tenantKey = cleanEmail;
    const store = tenantManager.createFreshTenant(tenantKey, {
      name: cleanHomestay,
      ownerName: cleanName,
      phone: cleanPhone,
      email: cleanEmail,
      location: cleanLocation,
      link: `https://stayride.in/h/${cleanHomestay.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      mapQuery: cleanLocation,
    });

    const userDoc = await UserModel.create({
      name: cleanName,
      email: cleanEmail,
      password: cleanPass,
      phone: cleanPhone,
      role: 'owner',
    });

    const PropertyModel = getPropertyModel(false);
    let propDoc = await PropertyModel.findOne({ email: cleanEmail });
    if (!propDoc && userDoc) {
      propDoc = await PropertyModel.create({
        ownerId: (userDoc as any)._id,
        name: cleanHomestay,
        email: cleanEmail,
        phone: cleanPhone,
        address: cleanLocation || 'Gangtok, Sikkim',
        town: cleanLocation || 'Gangtok',
        region: 'Sikkim',
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

    const accessToken = jwt.sign(tokenPayload, config.jwtSecret, { expiresIn: '30d' });
    const refreshToken = jwt.sign({ ...tokenPayload, type: 'refresh' }, config.jwtSecret, { expiresIn: '60d' });

    res.status(201).json({
      accessToken,
      refreshToken,
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
    const decoded = jwt.verify(token, config.jwtSecret) as StayRideAuthPayload & { type?: string };
    if (!decoded || !decoded.tenantKey) {
      return res.status(401).json({ error: { message: 'Invalid refresh token.' } });
    }

    const tokenPayload: StayRideAuthPayload = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role || 'owner',
      tenantKey: decoded.tenantKey,
      isDemo: Boolean(decoded.isDemo),
    };

    const newAccessToken = jwt.sign(tokenPayload, config.jwtSecret, { expiresIn: '30d' });
    const newRefreshToken = jwt.sign({ ...tokenPayload, type: 'refresh' }, config.jwtSecret, { expiresIn: '60d' });

    const store = await tenantManager.getStoreAsync(decoded.tenantKey);

    return res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
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

// Enforce JWT authentication on all data routes
stayrideV1Router.use(authenticateStayRide);

// ==========================================
// Snapshot (Single high-speed aggregator)
// ==========================================
stayrideV1Router.get('/snapshot', async (req: Request, res: Response) => {
  const { store } = await getStoreForReq(req);
  res.json({
    homestay: store.homestay,
    rooms: store.rooms,
    guests: store.guests,
    bookings: store.bookings,
    drivers: store.drivers,
    networkDrivers: store.networkDrivers,
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

stayrideV1Router.put('/homestay', async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  Object.assign(store.homestay, req.body);
  tenantManager.persistTenant(tenantKey).catch(() => {});
  res.json(store.homestay);
});

// ==========================================
// Rooms (bare JSON array expected)
// ==========================================
stayrideV1Router.get('/rooms', async (req: Request, res: Response) => {
  const { store } = await getStoreForReq(req);
  res.json(store.rooms);
});

stayrideV1Router.post('/rooms', async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const created = store.createRoom(req.body);
  tenantManager.persistTenant(tenantKey).catch(() => {});
  res.status(201).json(created);
});

stayrideV1Router.put('/rooms/:id', async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const updated = store.updateRoom(Number(req.params.id), req.body);
  if (!updated) return res.status(404).json({ error: { message: 'Room not found' } });
  tenantManager.persistTenant(tenantKey).catch(() => {});
  res.json(updated);
});

stayrideV1Router.patch('/rooms/:id/status', async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const updated = store.updateRoom(Number(req.params.id), { status: req.body.status });
  if (!updated) return res.status(404).json({ error: { message: 'Room not found' } });
  tenantManager.persistTenant(tenantKey).catch(() => {});
  res.json(updated);
});

stayrideV1Router.delete('/rooms/:id', async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  store.deleteRoom(Number(req.params.id));
  tenantManager.persistTenant(tenantKey).catch(() => {});
  res.json({ success: true });
});

// ==========================================
// Guests (bare JSON array expected)
// ==========================================
stayrideV1Router.get('/guests', async (req: Request, res: Response) => {
  const { store } = await getStoreForReq(req);
  res.json(store.guests);
});

stayrideV1Router.post('/guests', async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const created = store.createGuest(req.body);
  tenantManager.persistTenant(tenantKey).catch(() => {});
  res.status(201).json(created);
});

stayrideV1Router.put('/guests/:id', async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const updated = store.updateGuest(Number(req.params.id), req.body);
  if (!updated) return res.status(404).json({ error: { message: 'Guest not found' } });
  tenantManager.persistTenant(tenantKey).catch(() => {});
  res.json(updated);
});

// ==========================================
// Bookings (bare JSON array expected)
// ==========================================
stayrideV1Router.get('/bookings', async (req: Request, res: Response) => {
  const { store } = await getStoreForReq(req);
  res.json(store.bookings);
});

stayrideV1Router.post('/bookings', async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const created = store.createBooking(req.body);
  tenantManager.persistTenant(tenantKey).catch(() => {});
  res.status(201).json(created);
});

stayrideV1Router.post('/bookings/:id/check-in', async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const b = store.checkInBooking(Number(req.params.id));
  if (!b) return res.status(404).json({ error: { message: 'Booking not found' } });
  tenantManager.persistTenant(tenantKey).catch(() => {});
  res.json(b);
});

stayrideV1Router.post('/bookings/:id/check-out', async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const b = store.checkOutBooking(Number(req.params.id));
  if (!b) return res.status(404).json({ error: { message: 'Booking not found' } });
  tenantManager.persistTenant(tenantKey).catch(() => {});
  res.json(b);
});

stayrideV1Router.post('/bookings/:id/cancel', async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const b = store.cancelBooking(Number(req.params.id));
  if (!b) return res.status(404).json({ error: { message: 'Booking not found' } });
  tenantManager.persistTenant(tenantKey).catch(() => {});
  res.json(b);
});

stayrideV1Router.patch('/bookings/:id/payment', async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const b = store.setBookingPaid(Number(req.params.id), Boolean(req.body?.paid));
  if (!b) return res.status(404).json({ error: { message: 'Booking not found' } });
  tenantManager.persistTenant(tenantKey).catch(() => {});
  res.json(b);
});

stayrideV1Router.post('/bookings/:id/room', async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const b = store.changeBookingRoom(Number(req.params.id), req.body?.roomNumber);
  if (!b) return res.status(404).json({ error: { message: 'Booking not found' } });
  tenantManager.persistTenant(tenantKey).catch(() => {});
  res.json(b);
});

stayrideV1Router.delete('/bookings/:id', async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  store.deleteBooking(Number(req.params.id));
  tenantManager.persistTenant(tenantKey).catch(() => {});
  res.json({ success: true });
});

// ==========================================
// Drivers (bare JSON array expected)
// ==========================================
stayrideV1Router.get('/drivers', async (req: Request, res: Response) => {
  const { store } = await getStoreForReq(req);
  const scope = req.query.scope;
  if (scope === 'network') {
    res.json(store.networkDrivers);
  } else {
    res.json(store.drivers);
  }
});

stayrideV1Router.post('/drivers', async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const created = store.createDriver(req.body);

  // Determine if this is demo or production database
  const isDemo = tenantKey.includes('demo') || tenantKey.includes('mountainview');
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
        password: 'driver-default-pass',
        phone: cleanPhone,
        role: 'driver',
      });
      console.log(`✅ Driver account created in MongoDB with role: 'driver' for ${cleanName} (${cleanPhone})`);
    }
  } catch (err) {
    console.warn('[StayRide] Driver user sync warning:', err);
  }

  tenantManager.persistTenant(tenantKey).catch(() => {});
  res.status(201).json(created);
});

stayrideV1Router.put('/drivers/:id', async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const updated = store.updateDriver(Number(req.params.id), req.body);
  if (!updated) return res.status(404).json({ error: { message: 'Driver not found' } });
  tenantManager.persistTenant(tenantKey).catch(() => {});
  res.json(updated);
});

stayrideV1Router.patch('/drivers/:id/availability', async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const updated = store.updateDriver(Number(req.params.id), { available: Boolean(req.body?.available) });
  if (!updated) return res.status(404).json({ error: { message: 'Driver not found' } });
  tenantManager.persistTenant(tenantKey).catch(() => {});
  res.json(updated);
});

stayrideV1Router.patch('/drivers/:id/active', async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const updated = store.updateDriver(Number(req.params.id), { active: Boolean(req.body?.active) });
  if (!updated) return res.status(404).json({ error: { message: 'Driver not found' } });
  tenantManager.persistTenant(tenantKey).catch(() => {});
  res.json(updated);
});

stayrideV1Router.delete('/drivers/:id', async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  store.deleteDriver(Number(req.params.id));
  tenantManager.persistTenant(tenantKey).catch(() => {});
  res.json({ success: true });
});

// ==========================================
// Trips (bare JSON array expected)
// ==========================================
stayrideV1Router.get('/trips', async (req: Request, res: Response) => {
  const { store } = await getStoreForReq(req);
  res.json(store.trips);
});

stayrideV1Router.post('/trips', async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const created = store.createTrip(req.body);
  tenantManager.persistTenant(tenantKey).catch(() => {});
  res.status(201).json(created);
});

stayrideV1Router.post('/trips/:id/assign', async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const updated = store.assignTrip(Number(req.params.id), Number(req.body?.driverId));
  if (!updated) return res.status(404).json({ error: { message: 'Trip not found' } });
  tenantManager.persistTenant(tenantKey).catch(() => {});
  res.json(updated);
});

stayrideV1Router.post('/trips/:id/accept', async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const updated = store.acceptTrip(Number(req.params.id));
  if (!updated) return res.status(404).json({ error: { message: 'Trip not found' } });
  tenantManager.persistTenant(tenantKey).catch(() => {});
  res.json(updated);
});

stayrideV1Router.post('/trips/:id/reassign', async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const updated = store.reassignTrip(Number(req.params.id));
  if (!updated) return res.status(404).json({ error: { message: 'Trip not found' } });
  tenantManager.persistTenant(tenantKey).catch(() => {});
  res.json(updated);
});

stayrideV1Router.post('/trips/:id/start', async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const updated = store.startTrip(Number(req.params.id));
  if (!updated) return res.status(404).json({ error: { message: 'Trip not found' } });
  tenantManager.persistTenant(tenantKey).catch(() => {});
  res.json(updated);
});

stayrideV1Router.post('/trips/:id/complete', async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const updated = store.completeTrip(Number(req.params.id), req.body?.finalFare);
  if (!updated) return res.status(404).json({ error: { message: 'Trip not found' } });
  tenantManager.persistTenant(tenantKey).catch(() => {});
  res.json(updated);
});

stayrideV1Router.post('/trips/:id/cancel', async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const updated = store.cancelTrip(Number(req.params.id));
  if (!updated) return res.status(404).json({ error: { message: 'Trip not found' } });
  tenantManager.persistTenant(tenantKey).catch(() => {});
  res.json(updated);
});

stayrideV1Router.post('/trips/:id/commission/pay', async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const updated = store.payCommission(Number(req.params.id), Boolean(req.body?.paid));
  if (!updated) return res.status(404).json({ error: { message: 'Trip not found' } });
  tenantManager.persistTenant(tenantKey).catch(() => {});
  res.json(updated);
});

// ==========================================
// Campaigns (bare JSON array expected)
// ==========================================
stayrideV1Router.get('/campaigns', async (req: Request, res: Response) => {
  const { store } = await getStoreForReq(req);
  res.json(store.campaigns);
});

stayrideV1Router.post('/campaigns', async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const { title, message, audience } = req.body;
  const created = store.createCampaign(title, message, audience);
  tenantManager.persistTenant(tenantKey).catch(() => {});
  res.status(201).json(created);
});

stayrideV1Router.post('/campaigns/:id/send', async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  const sent = store.sendCampaign(Number(req.params.id));
  if (!sent) return res.status(404).json({ error: { message: 'Campaign not found' } });
  tenantManager.persistTenant(tenantKey).catch(() => {});
  res.json(sent);
});

stayrideV1Router.delete('/campaigns/:id', async (req: Request, res: Response) => {
  const { store, tenantKey } = await getStoreForReq(req);
  store.deleteCampaign(Number(req.params.id));
  tenantManager.persistTenant(tenantKey).catch(() => {});
  res.json({ success: true });
});

// ==========================================
// Demo Controls
// ==========================================
stayrideV1Router.post('/demo/reset', (_req: Request, res: Response) => {
  tenantManager.resetDemoStore();
  res.json({ success: true, message: 'Mountain View Homestay demo showcase reseeded' });
});

stayrideV1Router.post('/dev/seed', (_req: Request, res: Response) => {
  tenantManager.resetDemoStore();
  res.json({ success: true, message: 'StayRide demo dataset reseeded' });
});

export default stayrideV1Router;
