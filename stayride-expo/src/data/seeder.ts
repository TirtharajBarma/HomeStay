import { Room, Guest, Booking, Driver, CabTrip, Campaign, Homestay } from '../types';

export const DAY_MS = 86400000;

export function todayMidnight(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function plusDays(days: number): number {
  return todayMidnight() + days * DAY_MS;
}

export function generateSeedData() {
  const today = todayMidnight();

  const rooms: Room[] = [
    { id: 1, number: '101', type: 'Standard', floor: '1st Floor', price: 1800, status: 'AVAILABLE', note: 'Valley side, 1 double bed' },
    { id: 2, number: '102', type: 'Deluxe', floor: '1st Floor', price: 2600, status: 'OCCUPIED', note: 'Balcony, mountain view' },
    { id: 3, number: '103', type: 'Standard', floor: '1st Floor', price: 1800, status: 'AVAILABLE', note: '2 single beds' },
    { id: 4, number: '104', type: 'Deluxe', floor: '1st Floor', price: 2600, status: 'RESERVED', note: 'Heater, attached bathroom' },
    { id: 5, number: '201', type: 'Suite', floor: '2nd Floor', price: 4200, status: 'OCCUPIED', note: 'Living area + bedroom' },
    { id: 6, number: '202', type: 'Deluxe', floor: '2nd Floor', price: 2600, status: 'RESERVED', note: 'Corner room, king bed' },
    { id: 7, number: '203', type: 'Standard', floor: '2nd Floor', price: 1800, status: 'MAINTENANCE', note: 'Bathroom plumbing under repair' },
    { id: 8, number: '204', type: 'Suite', floor: '2nd Floor', price: 4200, status: 'AVAILABLE', note: 'Best view, jacuzzi' },
  ];

  const guests: Guest[] = [
    { id: 1, name: 'Rahul Sharma', phone: '+91 98301 44521', email: 'rahul.sharma@gmail.com', visits: 3, totalSpending: 12400, lastVisit: plusDays(-28), firstVisit: plusDays(-208), marketingConsent: true, notes: 'Prefers a quiet room away from the stairs. Early check-in whenever possible.' },
    { id: 2, name: 'Priya Verma', phone: '+91 99032 77810', email: 'priya.verma@gmail.com', visits: 2, totalSpending: 9800, lastVisit: plusDays(-1), firstVisit: plusDays(-181), marketingConsent: true, notes: 'Vegetarian. Books cabs through the homestay every time.' },
    { id: 3, name: 'Arjun Mehta', phone: '+91 90071 22334', email: 'arjun.mehta@outlook.com', visits: 1, totalSpending: 0, lastVisit: today, firstVisit: today, marketingConsent: true, notes: '' },
    { id: 4, name: 'Sunita Rai', phone: '+91 94198 55210', email: 'sunita.rai@gmail.com', visits: 2, totalSpending: 7800, lastVisit: plusDays(-1), firstVisit: plusDays(-181), marketingConsent: false, notes: 'Travels with an infant, needs a cot.' },
    { id: 5, name: 'Vikram Singh', phone: '+91 98111 90909', email: 'vikram.singh@gmail.com', visits: 1, totalSpending: 0, lastVisit: today, firstVisit: today, marketingConsent: true, notes: '' },
    { id: 6, name: 'Ananya Bose', phone: '+91 98311 66112', email: 'ananya.bose@gmail.com', visits: 1, totalSpending: 0, lastVisit: today, firstVisit: today, marketingConsent: true, notes: '' },
    { id: 7, name: 'Karan Thapa', phone: '+91 97330 40404', email: 'karan.thapa@gmail.com', visits: 1, totalSpending: 0, lastVisit: today, firstVisit: today, marketingConsent: false, notes: '' },
    { id: 8, name: 'Meera Iyer', phone: '+91 99450 78787', email: 'meera.iyer@gmail.com', visits: 1, totalSpending: 0, lastVisit: today, firstVisit: today, marketingConsent: true, notes: '' },
    { id: 9, name: 'Dev Patel', phone: '+91 98200 31313', email: 'dev.patel@gmail.com', visits: 2, totalSpending: 14200, lastVisit: plusDays(-12), firstVisit: plusDays(-192), marketingConsent: true, notes: 'Repeat guest from Mumbai. Likes the corner suite.' },
    { id: 10, name: 'Ritu Chettri', phone: '+91 99340 56565', email: 'ritu.chettri@gmail.com', visits: 2, totalSpending: 8400, lastVisit: plusDays(-6), firstVisit: plusDays(-186), marketingConsent: true, notes: '' },
    { id: 11, name: 'Sandeep Kumar', phone: '+91 90000 12121', email: 'sandeep.kumar@gmail.com', visits: 1, totalSpending: 0, lastVisit: plusDays(-150), firstVisit: plusDays(-150), marketingConsent: false, notes: '' },
    { id: 12, name: 'Neha Gupta', phone: '+91 98765 43210', email: 'neha.gupta@gmail.com', visits: 1, totalSpending: 0, lastVisit: plusDays(-110), firstVisit: plusDays(-110), marketingConsent: true, notes: '' },
    { id: 13, name: 'Imran Khan', phone: '+91 97654 33322', email: 'imran.khan@gmail.com', visits: 1, totalSpending: 0, lastVisit: plusDays(-130), firstVisit: plusDays(-130), marketingConsent: false, notes: '' },
    { id: 14, name: 'Kavya Nair', phone: '+91 91234 56789', email: 'kavya.nair@gmail.com', visits: 1, totalSpending: 0, lastVisit: plusDays(-20), firstVisit: plusDays(-20), marketingConsent: true, notes: '' },
  ];

  const bookings: Booking[] = [
    { id: 1, guestId: 1, guestName: 'Rahul Sharma', phone: '+91 98301 44521', checkIn: today, checkOut: plusDays(2), roomNumber: '102', guests: 2, status: 'CONFIRMED', paid: false, amount: 5200, source: 'StayRide link' },
    { id: 2, guestId: 2, guestName: 'Priya Verma', phone: '+91 99032 77810', checkIn: plusDays(-1), checkOut: plusDays(1), roomNumber: '201', guests: 2, status: 'CHECKED_IN', paid: true, amount: 8400, source: 'Repeat booking' },
    { id: 3, guestId: 4, guestName: 'Sunita Rai', phone: '+91 94198 55210', checkIn: plusDays(-1), checkOut: plusDays(2), roomNumber: '102', guests: 3, status: 'CHECKED_IN', paid: false, amount: 7800, source: 'Phone' },
    { id: 4, guestId: 5, guestName: 'Vikram Singh', phone: '+91 98111 90909', checkIn: plusDays(2), checkOut: plusDays(4), roomNumber: '104', guests: 2, status: 'CONFIRMED', paid: false, amount: 5200, source: 'StayRide link' },
    { id: 5, guestId: 6, guestName: 'Ananya Bose', phone: '+91 98311 66112', checkIn: plusDays(1), checkOut: plusDays(3), roomNumber: '103', guests: 2, status: 'CONFIRMED', paid: true, amount: 3600, source: 'Walk-in' },
    { id: 6, guestId: 7, guestName: 'Karan Thapa', phone: '+91 97330 40404', checkIn: plusDays(3), checkOut: plusDays(5), roomNumber: '202', guests: 2, status: 'CONFIRMED', paid: false, amount: 5200, source: 'StayRide link' },
    { id: 7, guestId: 8, guestName: 'Meera Iyer', phone: '+91 99450 78787', checkIn: today, checkOut: plusDays(1), roomNumber: '101', guests: 1, status: 'CONFIRMED', paid: false, amount: 1800, source: 'Walk-in' },
    { id: 8, guestId: 12, guestName: 'Neha Gupta', phone: '+91 98765 43210', checkIn: today, checkOut: plusDays(2), roomNumber: '202', guests: 2, status: 'CONFIRMED', paid: true, amount: 5200, source: 'WhatsApp' },
    { id: 9, guestId: 9, guestName: 'Dev Patel', phone: '+91 98200 31313', checkIn: plusDays(-12), checkOut: plusDays(-9), roomNumber: '202', guests: 2, status: 'CHECKED_OUT', paid: true, amount: 7800, source: 'StayRide link' },
    { id: 10, guestId: 10, guestName: 'Ritu Chettri', phone: '+91 99340 56565', checkIn: plusDays(-6), checkOut: plusDays(-4), roomNumber: '204', guests: 4, status: 'CHECKED_OUT', paid: true, amount: 8400, source: 'Repeat booking' },
    { id: 11, guestId: 1, guestName: 'Rahul Sharma', phone: '+91 98301 44521', checkIn: plusDays(-30), checkOut: plusDays(-28), roomNumber: '101', guests: 2, status: 'CHECKED_OUT', paid: true, amount: 3600, source: 'StayRide link' },
    { id: 12, guestId: 11, guestName: 'Sandeep Kumar', phone: '+91 90000 12121', checkIn: plusDays(5), checkOut: plusDays(7), roomNumber: '204', guests: 2, status: 'CANCELLED', paid: false, amount: 8400, source: 'StayRide link' },
  ];

  // Deterministic history generator (108 records matching Seeder.java)
  const roomNums = ['101', '102', '103', '104', '201', '202', '203', '204'];
  const sources = ['StayRide link', 'Walk-in', 'Phone', 'WhatsApp', 'Repeat booking'];
  const nightly = [1800, 1800, 2600, 2600, 4200, 1800, 2600];
  let curBkId = 13;
  for (let i = 0; i < 48; i++) {
    const daysAgo = 5 + ((i * 37) % 350);
    const inMs = plusDays(-daysAgo);
    const nights = 1 + (i % 4);
    const g = guests[i % guests.length];
    bookings.push({
      id: curBkId++,
      guestId: g.id,
      guestName: g.name,
      phone: g.phone,
      checkIn: inMs,
      checkOut: inMs + nights * DAY_MS,
      roomNumber: roomNums[i % roomNums.length],
      guests: 1 + (i % 3),
      status: 'CHECKED_OUT',
      paid: i % 2 === 0,
      amount: nightly[i % nightly.length] * nights,
      source: sources[i % sources.length],
    });
  }

  const drivers: Driver[] = [
    { id: 1, name: 'Pemba Sherpa', phone: '+91 98320 45451', vehicle: 'Mahindra Bolero', vehicleType: 'SUV', seats: 7, rating: 4.8, area: 'Gangtok / NJP / Bagdogra', trips: ['NJP', 'Bagdogra', 'Local'], available: true, active: true, ownerDriver: true },
    { id: 2, name: 'Bikash Rai', phone: '+91 99330 12124', vehicle: 'Toyota Innova Crysta', vehicleType: 'SUV', seats: 7, rating: 4.9, area: 'Gangtok / Darjeeling / Bagdogra', trips: ['NJP', 'Bagdogra', 'Sightseeing', 'Local'], available: true, active: true, ownerDriver: true },
    { id: 3, name: 'Dawa Bhutia', phone: '+91 94198 77665', vehicle: 'Maruti Dzire', vehicleType: 'Sedan', seats: 4, rating: 4.5, area: 'Gangtok local', trips: ['Local', 'Sightseeing'], available: false, active: true, ownerDriver: true },
    { id: 4, name: 'Mingma Tamang', phone: '+91 97750 88990', vehicle: 'Maruti Ertiga', vehicleType: '7-seater', seats: 7, rating: 4.6, area: 'Siliguri / NJP', trips: ['NJP', 'Bagdogra'], available: true, active: false, ownerDriver: true },
  ];

  const networkDrivers: Driver[] = [
    { id: 5, name: 'Tenzin Norbu', phone: '+91 98321 00112', vehicle: 'Toyota Innova Crysta', vehicleType: 'SUV', seats: 7, rating: 4.9, area: 'Bagdogra / NJP', trips: ['NJP', 'Bagdogra'], available: true, active: true, ownerDriver: false },
    { id: 6, name: 'Sagar Chettri', phone: '+91 99332 44556', vehicle: 'Maruti Dzire', vehicleType: 'Sedan', seats: 4, rating: 4.7, area: 'Darjeeling local', trips: ['Local', 'Sightseeing'], available: true, active: true, ownerDriver: false },
    { id: 7, name: 'Deepak Sharma', phone: '+91 98112 33445', vehicle: 'Force Traveller', vehicleType: '9-seater', seats: 9, rating: 4.8, area: 'Sikkim circuit', trips: ['Sightseeing', 'NJP'], available: true, active: true, ownerDriver: false },
    { id: 8, name: 'Hari Prasad', phone: '+91 94190 88776', vehicle: 'Maruti Ertiga', vehicleType: '7-seater', seats: 7, rating: 4.6, area: 'Gangtok / Siliguri', trips: ['NJP', 'Bagdogra', 'Local'], available: false, active: true, ownerDriver: false },
  ];

  const trips: CabTrip[] = [
    { id: 1, guestName: 'Dev Patel', phone: '+91 98200 31313', pickup: 'Bagdogra Airport', destination: 'Mountain View Homestay', date: today, time: '12:45 PM', passengers: 3, vehicleType: 'SUV', estFare: 3000, status: 'DRIVER_ASSIGNED', driverId: 2, driverName: 'Bikash Rai', ownerDriver: true, fare: 3000, commission: 0, commissionPaid: false },
    { id: 2, guestName: 'Sunita Rai', phone: '+91 94198 55210', pickup: 'NJP Station', destination: 'Mountain View Homestay', date: today, time: '02:30 PM', passengers: 2, vehicleType: 'Sedan', estFare: 2200, status: 'FINDING_DRIVER', driverId: null, driverName: null, ownerDriver: false, fare: 2200, commission: 0, commissionPaid: false },
    { id: 3, guestName: 'Karan Thapa', phone: '+91 97330 40404', pickup: 'Mountain View Homestay', destination: 'Nathula Pass Sightseeing', date: plusDays(1), time: '08:00 AM', passengers: 4, vehicleType: 'SUV', estFare: 4500, status: 'NEW_REQUEST', driverId: null, driverName: null, ownerDriver: false, fare: 4500, commission: 0, commissionPaid: false },
    { id: 4, guestName: 'Rahul Sharma', phone: '+91 98301 44521', pickup: 'Mountain View Homestay', destination: 'Bagdogra Airport', date: plusDays(2), time: '10:00 AM', passengers: 2, vehicleType: 'Sedan', estFare: 2200, status: 'CONFIRMED', driverId: 1, driverName: 'Pemba Sherpa', ownerDriver: true, fare: 2200, commission: 0, commissionPaid: false },
    { id: 5, guestName: 'Meera Iyer', phone: '+91 99450 78787', pickup: 'Siliguri Junction', destination: 'Mountain View Homestay', date: plusDays(-1), time: '03:15 PM', passengers: 1, vehicleType: 'Sedan', estFare: 2200, status: 'COMPLETED', driverId: 3, driverName: 'Dawa Bhutia', ownerDriver: true, fare: 2200, commission: 0, commissionPaid: false, advancePaid: true, advanceAmount: 330, remainingCashAmount: 1870 },
    { id: 6, guestName: 'Ritu Chettri', phone: '+91 99340 56565', pickup: 'Mountain View Homestay', destination: 'Darjeeling Mall', date: plusDays(-3), time: '09:30 AM', passengers: 4, vehicleType: '7-seater', estFare: 3200, status: 'COMPLETED', driverId: 2, driverName: 'Bikash Rai', ownerDriver: true, fare: 3200, commission: 0, commissionPaid: false, advancePaid: true, advanceAmount: 480, remainingCashAmount: 2720 },
  ];

  const campaigns: Campaign[] = [
    { id: 1, title: '20% off your next Darjeeling stay', message: 'Hi {name}! You are invited back to Mountain View Homestay with 20% off your next Darjeeling trip. Book on StayRide.', audience: 'All guests', status: 'COMPLETED', recipients: 14, sent: 13, failed: 1, createdOn: plusDays(-9) },
    { id: 2, title: 'Winter special: snow trip to Lachung', message: 'Hello {name}! Freeze the season with our Lachung snow package. Cab included, 15% off stays this winter.', audience: 'Repeat guests', status: 'CREATED', recipients: 5, sent: 0, failed: 0, createdOn: plusDays(-1) },
  ];

  const homestay: Homestay = {
    name: 'Mountain View Homestay',
    description: 'A cosy family-run homestay situated right above MG Marg with majestic panoramic views of Mt. Kanchenjunga. Authentic home-cooked Himalayan meals and in-house mountain cabs.',
    location: 'MG Marg, Gangtok, Sikkim 737101',
    phone: '+91 98320 11223',
    email: 'stay@mountainview.in',
    ownerName: 'Tshering Bhutia',
    link: 'https://stayride.in/h/mountain-view-gangtok',
    mapQuery: 'MG Marg, Gangtok, Sikkim',
    amenities: [
      'Free Wi-Fi',
      '24x7 Hot Water',
      'Private Parking',
      'Home Breakfast',
      'Air Conditioning',
      'Power Backup',
      'Luggage Storage',
      'Mountain View',
      'Laundry Service',
      'In-house Cabs (StayRide)',
    ],
    photos: [
      'Front elevation',
      'Deluxe room',
      'Valley view balcony',
      'Dining hall',
      'Rooftop garden',
      'Reception',
    ],
  };

  return {
    rooms,
    guests,
    bookings,
    drivers,
    networkDrivers,
    trips,
    campaigns,
    homestay,
    nextIds: {
      room: 9,
      guest: 15,
      booking: curBkId,
      driver: 9,
      trip: 7,
      campaign: 3,
    },
  };
}
