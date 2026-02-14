/**
 * Comprehensive seed script for Booking.go
 *
 * Seeds PostgreSQL with:
 *   - 6 customers, 4 business owners
 *   - 5 businesses (salon, clinic, gym, spa, studio)
 *   - 3–5 services per business
 *   - Business hours for all 7 days per business
 *   - Slots for the next 14 days
 *   - 40+ bookings across statuses
 *   - 20+ reviews on completed bookings
 *
 * Seeds MongoDB with:
 *   - Notifications for customers & owners
 *   - Conversations & messages between customers and businesses
 *
 * Usage:  npx ts-node scripts/seed.ts
 */

import bcrypt from 'bcrypt';
import pg from 'pg';
import mongoose from 'mongoose';

// ─── Config ─────────────────────────────────────────────
const PG_URI = process.env.PG_URI || 'postgresql://booking_admin:booking_pg_secret@localhost:5433/booking_go';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://booking_admin:booking_mongo_secret@localhost:27018/booking_go?authSource=admin';
const SALT_ROUNDS = 12;
const PASSWORD = 'Hello@123';

// ─── Helpers ────────────────────────────────────────────
const uuid = () => crypto.randomUUID();
const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const addDays = (base: Date, days: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
};

const randomItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

const formatDate = (d: Date) => d.toISOString().split('T')[0];

// ─── IDs ────────────────────────────────────────────────
// Existing accounts (keep same email, generate IDs for seed)
const CUSTOMER_1_ID = uuid(); // booking@co.com
const OWNER_1_ID = uuid(); // booking@go.com

// Additional customers
const CUSTOMER_2_ID = uuid();
const CUSTOMER_3_ID = uuid();
const CUSTOMER_4_ID = uuid();
const CUSTOMER_5_ID = uuid();
const CUSTOMER_6_ID = uuid();

// Additional business owners
const OWNER_2_ID = uuid();
const OWNER_3_ID = uuid();
const OWNER_4_ID = uuid();

// Business IDs
const BIZ_1_ID = uuid(); // Glamour Studio (Salon) - Owner 1
const BIZ_2_ID = uuid(); // HealthFirst Clinic - Owner 2
const BIZ_3_ID = uuid(); // FitZone Gym - Owner 3
const BIZ_4_ID = uuid(); // Serenity Spa - Owner 4
const BIZ_5_ID = uuid(); // Creative Arts Studio - Owner 1 (2nd business)

// Service IDs (we need them for slots/bookings)
const SVC: Record<string, string[]> = {
  [BIZ_1_ID]: [uuid(), uuid(), uuid(), uuid(), uuid()],
  [BIZ_2_ID]: [uuid(), uuid(), uuid(), uuid()],
  [BIZ_3_ID]: [uuid(), uuid(), uuid(), uuid()],
  [BIZ_4_ID]: [uuid(), uuid(), uuid(), uuid(), uuid()],
  [BIZ_5_ID]: [uuid(), uuid(), uuid()],
};

async function main() {
  console.log('🌱 Starting seed...\n');

  // Hash password once
  const passwordHash = await bcrypt.hash(PASSWORD, SALT_ROUNDS);

  // ─── PostgreSQL ─────────────────────────────────────
  const pool = new pg.Pool({ connectionString: PG_URI });

  try {
    // Clean existing data (order matters for FK constraints)
    console.log('🗑️  Cleaning existing data...');
    await pool.query('DELETE FROM reviews');
    await pool.query('DELETE FROM bookings');
    await pool.query('DELETE FROM slots');
    await pool.query('DELETE FROM services');
    await pool.query('DELETE FROM business_holidays');
    await pool.query('DELETE FROM business_hours');
    await pool.query('DELETE FROM businesses');
    await pool.query('DELETE FROM users');

    // ── Users ──
    console.log('👤 Seeding users...');
    const users = [
      // Primary test accounts
      [CUSTOMER_1_ID, 'booking@co.com', passwordHash, 'Shahid', 'Raza', '+919876543210', 'customer', true],
      [OWNER_1_ID, 'booking@go.com', passwordHash, 'Shahid', 'Khan', '+919876543211', 'business_owner', true],
      // Additional customers
      [CUSTOMER_2_ID, 'priya.sharma@example.com', passwordHash, 'Priya', 'Sharma', '+919876543212', 'customer', true],
      [CUSTOMER_3_ID, 'rahul.verma@example.com', passwordHash, 'Rahul', 'Verma', '+919876543213', 'customer', true],
      [CUSTOMER_4_ID, 'anita.patel@example.com', passwordHash, 'Anita', 'Patel', '+919876543214', 'customer', true],
      [CUSTOMER_5_ID, 'vikram.singh@example.com', passwordHash, 'Vikram', 'Singh', '+919876543215', 'customer', true],
      [CUSTOMER_6_ID, 'meera.reddy@example.com', passwordHash, 'Meera', 'Reddy', '+919876543216', 'customer', true],
      // Additional business owners
      [OWNER_2_ID, 'dr.arun.clinic@example.com', passwordHash, 'Dr. Arun', 'Mehta', '+919876543220', 'business_owner', true],
      [OWNER_3_ID, 'fitness.raj@example.com', passwordHash, 'Raj', 'Kapoor', '+919876543221', 'business_owner', true],
      [OWNER_4_ID, 'spa.neha@example.com', passwordHash, 'Neha', 'Gupta', '+919876543222', 'business_owner', true],
    ];

    for (const u of users) {
      await pool.query(
        `INSERT INTO users (id, email, password_hash, first_name, last_name, phone, role, email_verified, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)`,
        u,
      );
    }

    // ── Businesses ──
    console.log('🏢 Seeding businesses...');
    const businesses = [
      {
        id: BIZ_1_ID,
        ownerId: OWNER_1_ID,
        name: 'Glamour Studio',
        category: 'Salon',
        desc: 'Premium unisex salon offering hair styling, coloring, facials, and grooming services. Walk-ins welcome, appointments preferred.',
        address1: '42, MG Road',
        address2: 'Near City Mall',
        city: 'Mumbai',
        state: 'Maharashtra',
        zip: '400001',
        country: 'India',
        phone: '+912234567890',
        email: 'hello@glamourstudio.in',
        website: 'https://glamourstudio.in',
        lat: 19.076,
        lng: 72.8777,
        verified: true,
      },
      {
        id: BIZ_2_ID,
        ownerId: OWNER_2_ID,
        name: 'HealthFirst Clinic',
        category: 'Clinic',
        desc: 'Multi-specialty clinic with experienced doctors. We offer general consultations, dental care, dermatology, and preventive health check-ups.',
        address1: '15, Anna Nagar 2nd Street',
        address2: 'Opposite Central Park',
        city: 'Chennai',
        state: 'Tamil Nadu',
        zip: '600040',
        country: 'India',
        phone: '+914423456789',
        email: 'care@healthfirst.in',
        website: 'https://healthfirst.in',
        lat: 13.0827,
        lng: 80.2707,
        verified: true,
      },
      {
        id: BIZ_3_ID,
        ownerId: OWNER_3_ID,
        name: 'FitZone Gym',
        category: 'Gym',
        desc: 'State-of-the-art fitness center with personal training, group classes, CrossFit, and yoga sessions. Open 5 AM to 11 PM.',
        address1: '78, Banjara Hills Road No. 12',
        address2: '',
        city: 'Hyderabad',
        state: 'Telangana',
        zip: '500034',
        country: 'India',
        phone: '+914045678901',
        email: 'join@fitzone.in',
        website: 'https://fitzone.in',
        lat: 17.385,
        lng: 78.4867,
        verified: true,
      },
      {
        id: BIZ_4_ID,
        ownerId: OWNER_4_ID,
        name: 'Serenity Spa & Wellness',
        category: 'Spa',
        desc: 'Luxury day spa offering Ayurvedic massages, aromatherapy, body wraps, and meditation sessions. Relax, rejuvenate, restore.',
        address1: '101, Koramangala 5th Block',
        address2: 'Above Star Café',
        city: 'Bangalore',
        state: 'Karnataka',
        zip: '560095',
        country: 'India',
        phone: '+918045678902',
        email: 'bliss@serenityspa.in',
        website: 'https://serenityspa.in',
        lat: 12.9352,
        lng: 77.6245,
        verified: true,
      },
      {
        id: BIZ_5_ID,
        ownerId: OWNER_1_ID,
        name: 'Creative Arts Studio',
        category: 'Studio',
        desc: 'Art and pottery studio offering painting classes, ceramics workshops, and creative therapy sessions for all age groups.',
        address1: '29, Linking Road',
        address2: 'Khar West',
        city: 'Mumbai',
        state: 'Maharashtra',
        zip: '400052',
        country: 'India',
        phone: '+912234567899',
        email: 'create@artsstudio.in',
        website: 'https://artsstudio.in',
        lat: 19.0711,
        lng: 72.8328,
        verified: false,
      },
    ];

    for (const b of businesses) {
      await pool.query(
        `INSERT INTO businesses (id, owner_id, name, slug, description, category,
         address_line1, address_line2, city, state, zip_code, country,
         latitude, longitude, phone, email, website, is_active, is_verified)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,true,$18)`,
        [
          b.id, b.ownerId, b.name, slug(b.name), b.desc, b.category,
          b.address1, b.address2, b.city, b.state, b.zip, b.country,
          b.lat, b.lng, b.phone, b.email, b.website, b.verified,
        ],
      );
    }

    // ── Business Hours ──
    console.log('🕐 Seeding business hours...');
    const hourProfiles: Record<string, { open: string; close: string; closedDays: number[] }> = {
      [BIZ_1_ID]: { open: '09:00', close: '21:00', closedDays: [] },           // salon: 7 days
      [BIZ_2_ID]: { open: '08:00', close: '20:00', closedDays: [6] },          // clinic: closed Sunday
      [BIZ_3_ID]: { open: '05:00', close: '23:00', closedDays: [] },           // gym: 7 days
      [BIZ_4_ID]: { open: '10:00', close: '22:00', closedDays: [0] },          // spa: closed Monday
      [BIZ_5_ID]: { open: '10:00', close: '19:00', closedDays: [0, 6] },       // studio: Mon/Sun off
    };

    for (const [bizId, profile] of Object.entries(hourProfiles)) {
      for (let day = 0; day <= 6; day++) {
        const isClosed = profile.closedDays.includes(day);
        await pool.query(
          `INSERT INTO business_hours (id, business_id, day_of_week, open_time, close_time, is_closed)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [uuid(), bizId, day, profile.open, profile.close, isClosed],
        );
      }
    }

    // ── Business Holidays ──
    console.log('📅 Seeding holidays...');
    const now = new Date();
    const holidays = [
      [uuid(), BIZ_1_ID, formatDate(addDays(now, 20)), 'Annual maintenance'],
      [uuid(), BIZ_2_ID, formatDate(addDays(now, 15)), 'Doctor conference'],
      [uuid(), BIZ_4_ID, formatDate(addDays(now, 25)), 'Wellness retreat – staff'],
    ];
    for (const h of holidays) {
      await pool.query(
        `INSERT INTO business_holidays (id, business_id, holiday_date, reason) VALUES ($1,$2,$3,$4)`,
        h,
      );
    }

    // ── Services ──
    console.log('💈 Seeding services...');
    const serviceData: {
      bizId: string;
      services: { name: string; desc: string; dur: number; price: number; capacity: number }[];
    }[] = [
      {
        bizId: BIZ_1_ID,
        services: [
          { name: 'Haircut & Styling', desc: 'Professional haircut with wash, blow-dry, and styling for men and women.', dur: 45, price: 500, capacity: 1 },
          { name: 'Hair Coloring', desc: 'Full hair color or highlights using premium ammonia-free products.', dur: 90, price: 2500, capacity: 1 },
          { name: 'Facial Treatment', desc: 'Deep cleansing facial with exfoliation, mask, and moisturizing.', dur: 60, price: 1200, capacity: 1 },
          { name: 'Beard Grooming', desc: 'Beard trim, shaping, and hot towel treatment.', dur: 30, price: 300, capacity: 1 },
          { name: 'Bridal Makeup Package', desc: 'Complete bridal look with makeup, hair styling, and draping assistance.', dur: 180, price: 15000, capacity: 1 },
        ],
      },
      {
        bizId: BIZ_2_ID,
        services: [
          { name: 'General Consultation', desc: 'Consultation with a general physician for common health issues.', dur: 30, price: 500, capacity: 1 },
          { name: 'Dental Check-up', desc: 'Comprehensive dental examination with cleaning and X-ray if needed.', dur: 45, price: 800, capacity: 1 },
          { name: 'Skin Consultation', desc: 'Dermatology consultation for acne, pigmentation, and skin concerns.', dur: 30, price: 700, capacity: 1 },
          { name: 'Full Body Health Check-up', desc: 'Complete preventive health screening with blood work, ECG, and doctor review.', dur: 120, price: 3500, capacity: 2 },
        ],
      },
      {
        bizId: BIZ_3_ID,
        services: [
          { name: 'Personal Training Session', desc: 'One-on-one session with certified personal trainer tailored to your goals.', dur: 60, price: 1000, capacity: 1 },
          { name: 'Group Fitness Class', desc: 'High-energy group workout — Zumba, aerobics, or HIIT rotation.', dur: 60, price: 300, capacity: 20 },
          { name: 'Yoga Session', desc: 'Guided yoga class for flexibility, strength, and mindfulness.', dur: 75, price: 400, capacity: 15 },
          { name: 'CrossFit WOD', desc: 'Workout of the Day — intense functional fitness training.', dur: 60, price: 500, capacity: 12 },
        ],
      },
      {
        bizId: BIZ_4_ID,
        services: [
          { name: 'Swedish Massage', desc: 'Classic relaxation massage with long, flowing strokes to ease tension.', dur: 60, price: 2000, capacity: 1 },
          { name: 'Ayurvedic Abhyanga', desc: 'Traditional warm oil body massage based on Ayurvedic principles.', dur: 90, price: 3000, capacity: 1 },
          { name: 'Aromatherapy Session', desc: 'Essential oil-based therapy for stress relief, relaxation, and healing.', dur: 60, price: 2500, capacity: 1 },
          { name: 'Body Scrub & Wrap', desc: 'Full body exfoliation followed by a nourishing herbal body wrap.', dur: 75, price: 2800, capacity: 1 },
          { name: 'Meditation & Sound Healing', desc: 'Guided meditation with Tibetan singing bowls for deep relaxation.', dur: 45, price: 800, capacity: 8 },
        ],
      },
      {
        bizId: BIZ_5_ID,
        services: [
          { name: 'Painting Workshop', desc: 'Acrylic painting class for beginners and intermediate artists. All supplies included.', dur: 120, price: 1500, capacity: 10 },
          { name: 'Pottery & Ceramics', desc: 'Hands-on pottery session on the wheel. Take your creation home after firing!', dur: 90, price: 1200, capacity: 6 },
          { name: 'Art Therapy Session', desc: 'Therapeutic art-making session guided by a certified art therapist.', dur: 60, price: 1000, capacity: 4 },
        ],
      },
    ];

    for (const { bizId, services } of serviceData) {
      const svcIds = SVC[bizId];
      for (let i = 0; i < services.length; i++) {
        const s = services[i];
        await pool.query(
          `INSERT INTO services (id, business_id, name, description, duration, price, max_capacity, display_order, is_active)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true)`,
          [svcIds[i], bizId, s.name, s.desc, s.dur, s.price, s.capacity, i + 1],
        );
      }
    }

    // ── Slots ──
    console.log('📆 Seeding slots for next 14 days...');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const slotMap: { id: string; bizId: string; svcId: string; start: Date; end: Date; price: number; capacity: number; booked: number }[] = [];

    for (const { bizId, services } of serviceData) {
      const svcIds = SVC[bizId];
      const profile = hourProfiles[bizId];

      for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
        const date = addDays(today, dayOffset);
        const jsDay = date.getDay(); // 0=Sun
        const ourDay = jsDay === 0 ? 6 : jsDay - 1; // 0=Mon

        if (profile.closedDays.includes(ourDay)) continue;

        const openHour = parseInt(profile.open.split(':')[0]);
        const closeHour = parseInt(profile.close.split(':')[0]);

        for (let si = 0; si < services.length; si++) {
          const svc = services[si];
          const slotsPerDay = Math.min(Math.floor((closeHour - openHour) * 60 / svc.dur), 6); // cap at 6 slots/day

          for (let s = 0; s < slotsPerDay; s++) {
            const startMin = openHour * 60 + s * (svc.dur + 15); // 15 min buffer
            if (startMin + svc.dur > closeHour * 60) break;

            const start = new Date(date);
            start.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);
            const end = new Date(start);
            end.setMinutes(end.getMinutes() + svc.dur);

            const slotId = uuid();
            slotMap.push({
              id: slotId,
              bizId,
              svcId: svcIds[si],
              start,
              end,
              price: svc.price,
              capacity: svc.capacity,
              booked: 0,
            });
          }
        }
      }
    }

    // Insert slots in batches
    const BATCH = 50;
    for (let i = 0; i < slotMap.length; i += BATCH) {
      const batch = slotMap.slice(i, i + BATCH);
      const values: unknown[] = [];
      const placeholders: string[] = [];
      batch.forEach((sl, idx) => {
        const base = idx * 8;
        placeholders.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8})`);
        values.push(sl.id, sl.bizId, sl.svcId, sl.start.toISOString(), sl.end.toISOString(), sl.capacity, sl.price, true);
      });
      await pool.query(
        `INSERT INTO slots (id, business_id, service_id, start_time, end_time, capacity, price, is_available)
         VALUES ${placeholders.join(',')}`,
        values,
      );
    }
    console.log(`   ✓ ${slotMap.length} slots created`);

    // ── Bookings ──
    console.log('📋 Seeding bookings...');
    const allCustomers = [CUSTOMER_1_ID, CUSTOMER_2_ID, CUSTOMER_3_ID, CUSTOMER_4_ID, CUSTOMER_5_ID, CUSTOMER_6_ID];
    const customerNames: Record<string, { first: string; last: string; email: string; phone: string }> = {
      [CUSTOMER_1_ID]: { first: 'Shahid', last: 'Raza', email: 'booking@co.com', phone: '+919876543210' },
      [CUSTOMER_2_ID]: { first: 'Priya', last: 'Sharma', email: 'priya.sharma@example.com', phone: '+919876543212' },
      [CUSTOMER_3_ID]: { first: 'Rahul', last: 'Verma', email: 'rahul.verma@example.com', phone: '+919876543213' },
      [CUSTOMER_4_ID]: { first: 'Anita', last: 'Patel', email: 'anita.patel@example.com', phone: '+919876543214' },
      [CUSTOMER_5_ID]: { first: 'Vikram', last: 'Singh', email: 'vikram.singh@example.com', phone: '+919876543215' },
      [CUSTOMER_6_ID]: { first: 'Meera', last: 'Reddy', email: 'meera.reddy@example.com', phone: '+919876543216' },
    };

    const bookingNotes = [
      'First time visiting, excited!',
      'Please prepare the room in advance.',
      'I might be 5 minutes late.',
      'Anniversary treat!',
      'Referred by a friend.',
      'Need extra care — sensitive skin.',
      'Looking forward to this!',
      null,
      null,
      null,
    ];

    const bookings: {
      id: string; slotId: string; bizId: string; custId: string; svcId: string;
      status: string; date: string; start: Date; end: Date; price: number;
      people: number; name: string; email: string; phone: string; notes: string | null;
    }[] = [];

    // Past bookings (completed & cancelled)
    const pastSlots = slotMap.filter((s) => s.start < now);
    const shuffledPast = pastSlots.sort(() => Math.random() - 0.5);

    // Generate 25 completed bookings
    const usedPastSlots = new Set<string>();
    for (let i = 0; i < Math.min(25, shuffledPast.length); i++) {
      const sl = shuffledPast[i];
      if (usedPastSlots.has(sl.id)) continue;
      usedPastSlots.add(sl.id);
      const cust = randomItem(allCustomers);
      const cn = customerNames[cust];
      bookings.push({
        id: uuid(),
        slotId: sl.id,
        bizId: sl.bizId,
        custId: cust,
        svcId: sl.svcId,
        status: 'completed',
        date: formatDate(sl.start),
        start: sl.start,
        end: sl.end,
        price: sl.price,
        people: 1,
        name: `${cn.first} ${cn.last}`,
        email: cn.email,
        phone: cn.phone,
        notes: randomItem(bookingNotes),
      });
      sl.booked++;
    }

    // 5 cancelled past bookings
    for (let i = 25; i < Math.min(30, shuffledPast.length); i++) {
      const sl = shuffledPast[i];
      if (usedPastSlots.has(sl.id)) continue;
      usedPastSlots.add(sl.id);
      const cust = randomItem(allCustomers);
      const cn = customerNames[cust];
      bookings.push({
        id: uuid(),
        slotId: sl.id,
        bizId: sl.bizId,
        custId: cust,
        svcId: sl.svcId,
        status: 'cancelled',
        date: formatDate(sl.start),
        start: sl.start,
        end: sl.end,
        price: sl.price,
        people: 1,
        name: `${cn.first} ${cn.last}`,
        email: cn.email,
        phone: cn.phone,
        notes: null,
      });
    }

    // Future bookings: some pending, some confirmed
    const futureSlots = slotMap.filter((s) => s.start >= now);
    const shuffledFuture = futureSlots.sort(() => Math.random() - 0.5);
    const usedFutureSlots = new Set<string>();

    // 8 confirmed future
    for (let i = 0; i < Math.min(8, shuffledFuture.length); i++) {
      const sl = shuffledFuture[i];
      if (usedFutureSlots.has(sl.id)) continue;
      usedFutureSlots.add(sl.id);
      const cust = randomItem(allCustomers);
      const cn = customerNames[cust];
      bookings.push({
        id: uuid(),
        slotId: sl.id,
        bizId: sl.bizId,
        custId: cust,
        svcId: sl.svcId,
        status: 'confirmed',
        date: formatDate(sl.start),
        start: sl.start,
        end: sl.end,
        price: sl.price,
        people: sl.capacity > 1 ? randomInt(1, Math.min(3, sl.capacity)) : 1,
        name: `${cn.first} ${cn.last}`,
        email: cn.email,
        phone: cn.phone,
        notes: randomItem(bookingNotes),
      });
      sl.booked++;
    }

    // 7 pending future
    for (let i = 8; i < Math.min(15, shuffledFuture.length); i++) {
      const sl = shuffledFuture[i];
      if (usedFutureSlots.has(sl.id)) continue;
      usedFutureSlots.add(sl.id);
      const cust = randomItem(allCustomers);
      const cn = customerNames[cust];
      bookings.push({
        id: uuid(),
        slotId: sl.id,
        bizId: sl.bizId,
        custId: cust,
        svcId: sl.svcId,
        status: 'pending',
        date: formatDate(sl.start),
        start: sl.start,
        end: sl.end,
        price: sl.price,
        people: 1,
        name: `${cn.first} ${cn.last}`,
        email: cn.email,
        phone: cn.phone,
        notes: randomItem(bookingNotes),
      });
      sl.booked++;
    }

    // Ensure the primary customer (Shahid Raza) has bookings across different businesses
    const shahidBizTargets = [BIZ_1_ID, BIZ_2_ID, BIZ_3_ID, BIZ_4_ID];
    for (const targetBiz of shahidBizTargets) {
      const avail = futureSlots.find((s) => s.bizId === targetBiz && !usedFutureSlots.has(s.id));
      if (avail) {
        usedFutureSlots.add(avail.id);
        const cn = customerNames[CUSTOMER_1_ID];
        bookings.push({
          id: uuid(),
          slotId: avail.id,
          bizId: avail.bizId,
          custId: CUSTOMER_1_ID,
          svcId: avail.svcId,
          status: randomItem(['pending', 'confirmed']),
          date: formatDate(avail.start),
          start: avail.start,
          end: avail.end,
          price: avail.price,
          people: 1,
          name: `${cn.first} ${cn.last}`,
          email: cn.email,
          phone: cn.phone,
          notes: 'Booking from test account.',
        });
        avail.booked++;
      }
    }

    // Insert bookings
    for (const b of bookings) {
      await pool.query(
        `INSERT INTO bookings (id, slot_id, business_id, customer_id, service_id, status,
         booking_date, start_time, end_time, number_of_people, total_price,
         customer_name, customer_email, customer_phone, notes,
         confirmed_at, completed_at, cancelled_at, cancellation_reason, cancelled_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
        [
          b.id, b.slotId, b.bizId, b.custId, b.svcId, b.status,
          b.date, b.start.toISOString(), b.end.toISOString(), b.people, b.price * b.people,
          b.name, b.email, b.phone, b.notes,
          b.status === 'confirmed' || b.status === 'completed' ? new Date().toISOString() : null,
          b.status === 'completed' ? b.end.toISOString() : null,
          b.status === 'cancelled' ? new Date().toISOString() : null,
          b.status === 'cancelled' ? 'Plans changed' : null,
          b.status === 'cancelled' ? 'customer' : null,
        ],
      );
    }

    // Update booked_count on slots
    for (const sl of slotMap) {
      if (sl.booked > 0) {
        await pool.query(
          'UPDATE slots SET booked_count = $1 WHERE id = $2',
          [sl.booked, sl.id],
        );
      }
    }
    console.log(`   ✓ ${bookings.length} bookings created`);

    // ── Reviews ──
    console.log('⭐ Seeding reviews...');
    const completedBookings = bookings.filter((b) => b.status === 'completed');
    const reviewComments = [
      'Absolutely fantastic experience! The staff was incredibly professional and friendly.',
      'Very good service overall. Would definitely recommend to friends and family.',
      'Amazing place! Clean environment and skilled professionals. Will be back.',
      'Good service but the wait time was longer than expected.',
      'Decent experience. Nothing extraordinary but got the job done.',
      'Loved it! The attention to detail was impressive.',
      'Great value for money. Very satisfied with the results.',
      'The staff went above and beyond to make sure I was comfortable.',
      'Wonderful atmosphere and excellent service. A hidden gem!',
      'Pretty average. The service was okay, room for improvement.',
      'Exceeded my expectations! Booking was seamless and the service was top-notch.',
      'Not bad but could improve on punctuality. Service quality was good though.',
      'Five stars! One of the best experiences I have had. Highly recommend!',
      'Professional and courteous staff. The facility is well-maintained.',
      'Satisfactory experience. Will consider trying other services next time.',
    ];

    const reviewIds: string[] = [];
    for (let i = 0; i < Math.min(20, completedBookings.length); i++) {
      const b = completedBookings[i];
      const rating = randomItem([3, 4, 4, 4, 5, 5, 5, 5]); // weighted toward 4-5
      const rId = uuid();
      reviewIds.push(rId);
      await pool.query(
        `INSERT INTO reviews (id, booking_id, business_id, customer_id, rating, comment, is_published)
         VALUES ($1,$2,$3,$4,$5,$6,true)`,
        [rId, b.id, b.bizId, b.custId, rating, reviewComments[i % reviewComments.length]],
      );
    }
    console.log(`   ✓ ${Math.min(20, completedBookings.length)} reviews created`);

    console.log('\n✅ PostgreSQL seeded!\n');
    await pool.end();

    // ─── MongoDB ──────────────────────────────────────
    console.log('🍃 Seeding MongoDB...');
    await mongoose.connect(MONGO_URI);

    const notifColl = mongoose.connection.collection('notifications');
    const convColl = mongoose.connection.collection('conversations');
    const msgColl = mongoose.connection.collection('messages');

    // Clean
    await notifColl.deleteMany({});
    await convColl.deleteMany({});
    await msgColl.deleteMany({});

    // ── Notifications ──
    console.log('🔔 Seeding notifications...');
    const notifs: Record<string, unknown>[] = [];

    // Notifications for the primary customer
    notifs.push(
      {
        userId: CUSTOMER_1_ID,
        type: 'booking_confirmed',
        title: 'Booking Confirmed',
        message: 'Your booking at Glamour Studio has been confirmed. See you soon!',
        data: { businessId: BIZ_1_ID, businessName: 'Glamour Studio' },
        channels: { email: { sent: true, sentAt: new Date() } },
        isRead: false,
        createdAt: addDays(now, -1),
      },
      {
        userId: CUSTOMER_1_ID,
        type: 'booking_reminder',
        title: 'Upcoming Appointment',
        message: 'Reminder: You have an appointment at HealthFirst Clinic tomorrow at 10:00 AM.',
        data: { businessId: BIZ_2_ID, businessName: 'HealthFirst Clinic' },
        channels: { email: { sent: true, sentAt: new Date() } },
        isRead: false,
        createdAt: addDays(now, -0.5),
      },
      {
        userId: CUSTOMER_1_ID,
        type: 'booking_completed',
        title: 'Visit Completed',
        message: 'Your visit to FitZone Gym is complete. We would love your feedback — leave a review!',
        data: { businessId: BIZ_3_ID, businessName: 'FitZone Gym' },
        channels: { email: { sent: true, sentAt: new Date() } },
        isRead: true,
        readAt: addDays(now, -0.2),
        createdAt: addDays(now, -2),
      },
      {
        userId: CUSTOMER_1_ID,
        type: 'business_update',
        title: 'New Service Available',
        message: 'Serenity Spa now offers Meditation & Sound Healing sessions. Book yours today!',
        data: { businessId: BIZ_4_ID, businessName: 'Serenity Spa & Wellness' },
        channels: {},
        isRead: false,
        createdAt: addDays(now, -3),
      },
    );

    // Notifications for business owners
    notifs.push(
      {
        userId: OWNER_1_ID,
        type: 'booking_created',
        title: 'New Booking Received',
        message: 'Priya Sharma booked a Haircut & Styling at Glamour Studio for Feb 13.',
        data: { businessId: BIZ_1_ID, customerName: 'Priya Sharma' },
        channels: { email: { sent: true, sentAt: new Date() } },
        isRead: false,
        createdAt: addDays(now, -0.3),
      },
      {
        userId: OWNER_1_ID,
        type: 'review_received',
        title: 'New Review',
        message: 'Rahul Verma left a 5-star review on Glamour Studio. Check it out!',
        data: { businessId: BIZ_1_ID, rating: 5 },
        channels: {},
        isRead: false,
        createdAt: addDays(now, -1),
      },
      {
        userId: OWNER_1_ID,
        type: 'booking_cancelled',
        title: 'Booking Cancelled',
        message: 'Vikram Singh cancelled their booking at Creative Arts Studio.',
        data: { businessId: BIZ_5_ID, customerName: 'Vikram Singh' },
        channels: {},
        isRead: true,
        readAt: addDays(now, -1.5),
        createdAt: addDays(now, -2),
      },
    );

    // Notifications for other customers
    const otherNotifs = [
      { userId: CUSTOMER_2_ID, type: 'booking_confirmed', title: 'Booking Confirmed', message: 'Your appointment at Serenity Spa is confirmed for a Swedish Massage.' },
      { userId: CUSTOMER_3_ID, type: 'booking_reminder', title: 'Appointment Tomorrow', message: 'Reminder: CrossFit WOD at FitZone Gym tomorrow at 7:00 AM.' },
      { userId: CUSTOMER_4_ID, type: 'booking_completed', title: 'Thank You for Visiting', message: 'Your dental check-up at HealthFirst Clinic is complete. Hope you had a good experience!' },
      { userId: CUSTOMER_5_ID, type: 'booking_confirmed', title: 'Booking Confirmed', message: 'Your Painting Workshop at Creative Arts Studio is confirmed!' },
      { userId: CUSTOMER_6_ID, type: 'booking_created', title: 'Booking Received', message: 'Your booking for Ayurvedic Abhyanga at Serenity Spa is being processed.' },
      { userId: OWNER_2_ID, type: 'booking_created', title: 'New Patient Booking', message: 'Meera Reddy booked a General Consultation at HealthFirst Clinic.' },
      { userId: OWNER_3_ID, type: 'review_received', title: 'New Review', message: 'Anita Patel gave FitZone Gym a 4-star review.' },
      { userId: OWNER_4_ID, type: 'booking_created', title: 'New Booking', message: 'Shahid Raza booked Aromatherapy Session at Serenity Spa.' },
    ];

    for (const n of otherNotifs) {
      notifs.push({
        userId: n.userId,
        type: n.type,
        title: n.title,
        message: n.message,
        data: {},
        channels: {},
        isRead: Math.random() > 0.5,
        createdAt: addDays(now, -randomInt(0, 5)),
      });
    }

    await notifColl.insertMany(notifs);
    console.log(`   ✓ ${notifs.length} notifications created`);

    // ── Conversations & Messages ──
    console.log('💬 Seeding conversations & messages...');
    const convos = [
      {
        bizId: BIZ_1_ID,
        custId: CUSTOMER_1_ID,
        ownerId: OWNER_1_ID,
        bizName: 'Glamour Studio',
        messages: [
          { sender: CUSTOMER_1_ID, role: 'customer', text: 'Hi! Do you do hair coloring for men?' },
          { sender: OWNER_1_ID, role: 'business_owner', text: 'Hello Shahid! Yes, we offer hair coloring for men too. We use premium products.' },
          { sender: CUSTOMER_1_ID, role: 'customer', text: 'Great! How long does it take and what shades are available?' },
          { sender: OWNER_1_ID, role: 'business_owner', text: 'It takes about 60-90 minutes. We have natural blacks, browns, and trendy colors like ash grey, burgundy. You can check shades when you visit!' },
          { sender: CUSTOMER_1_ID, role: 'customer', text: 'Sounds good, I will book a session. Thanks!' },
        ],
      },
      {
        bizId: BIZ_2_ID,
        custId: CUSTOMER_2_ID,
        ownerId: OWNER_2_ID,
        bizName: 'HealthFirst Clinic',
        messages: [
          { sender: CUSTOMER_2_ID, role: 'customer', text: 'Hello, I wanted to ask about the full body check-up. What tests are included?' },
          { sender: OWNER_2_ID, role: 'business_owner', text: 'Hi Priya! The package includes CBC, lipid profile, blood sugar, thyroid, liver & kidney function, ECG, and doctor consultation.' },
          { sender: CUSTOMER_2_ID, role: 'customer', text: 'Do I need to fast before the test?' },
          { sender: OWNER_2_ID, role: 'business_owner', text: 'Yes, please fast for 10-12 hours before. You can drink water. Best to book a morning slot.' },
          { sender: CUSTOMER_2_ID, role: 'customer', text: 'Perfect, booking a morning slot now. Thank you doctor!' },
          { sender: OWNER_2_ID, role: 'business_owner', text: 'You are welcome! See you at the clinic.' },
        ],
      },
      {
        bizId: BIZ_3_ID,
        custId: CUSTOMER_3_ID,
        ownerId: OWNER_3_ID,
        bizName: 'FitZone Gym',
        messages: [
          { sender: CUSTOMER_3_ID, role: 'customer', text: 'Hey, is the personal training suitable for complete beginners?' },
          { sender: OWNER_3_ID, role: 'business_owner', text: 'Absolutely! Our trainers customize the workout based on your fitness level. We have helped many beginners get started.' },
          { sender: CUSTOMER_3_ID, role: 'customer', text: 'Awesome. What should I bring for the first session?' },
          { sender: OWNER_3_ID, role: 'business_owner', text: 'Just comfortable workout clothes and shoes. We provide towels and water. Bring your energy!' },
        ],
      },
      {
        bizId: BIZ_4_ID,
        custId: CUSTOMER_1_ID,
        ownerId: OWNER_4_ID,
        bizName: 'Serenity Spa & Wellness',
        messages: [
          { sender: CUSTOMER_1_ID, role: 'customer', text: 'Hi, I am interested in the Ayurvedic massage. Is it suitable for someone with back pain?' },
          { sender: OWNER_4_ID, role: 'business_owner', text: 'Hello! Yes, Abhyanga massage is very beneficial for back pain. Our therapist will adjust pressure and focus on problem areas.' },
          { sender: CUSTOMER_1_ID, role: 'customer', text: 'That is perfect. Can I also do the meditation session on the same day?' },
          { sender: OWNER_4_ID, role: 'business_owner', text: 'Of course! We recommend doing the massage first, then the sound healing. It makes for a deeply relaxing experience.' },
          { sender: CUSTOMER_1_ID, role: 'customer', text: 'Will book both. Thanks for the suggestion!' },
          { sender: OWNER_4_ID, role: 'business_owner', text: 'Looking forward to hosting you! Namaste 🙏' },
        ],
      },
      {
        bizId: BIZ_5_ID,
        custId: CUSTOMER_5_ID,
        ownerId: OWNER_1_ID,
        bizName: 'Creative Arts Studio',
        messages: [
          { sender: CUSTOMER_5_ID, role: 'customer', text: 'Hello! Are the painting workshops beginner-friendly? I have never painted before.' },
          { sender: OWNER_1_ID, role: 'business_owner', text: 'Hi Vikram! Absolutely. Our workshops are designed for all levels. The instructor guides you step by step.' },
          { sender: CUSTOMER_5_ID, role: 'customer', text: 'Can I bring my 10-year-old daughter along?' },
          { sender: OWNER_1_ID, role: 'business_owner', text: 'Yes! Kids love our workshops. We have child-friendly materials and themes. She will have a blast.' },
          { sender: CUSTOMER_5_ID, role: 'customer', text: 'Amazing, booking for this weekend then!' },
        ],
      },
      {
        bizId: BIZ_1_ID,
        custId: CUSTOMER_4_ID,
        ownerId: OWNER_1_ID,
        bizName: 'Glamour Studio',
        messages: [
          { sender: CUSTOMER_4_ID, role: 'customer', text: 'Hi, I need bridal makeup for my wedding on March 15. Are you available?' },
          { sender: OWNER_1_ID, role: 'business_owner', text: 'Congratulations Anita! Let me check our calendar. Yes, March 15 is available. Would you like a trial session first?' },
          { sender: CUSTOMER_4_ID, role: 'customer', text: 'Yes please! When can I come for the trial?' },
        ],
      },
    ];

    for (const conv of convos) {
      const lastMsg = conv.messages[conv.messages.length - 1];
      const convDoc = await convColl.insertOne({
        businessId: conv.bizId,
        customerId: conv.custId,
        businessOwnerId: conv.ownerId,
        lastMessageAt: addDays(now, -randomInt(0, 3)),
        lastMessageText: lastMsg.text,
        customerUnreadCount: lastMsg.role === 'business_owner' ? randomInt(0, 2) : 0,
        ownerUnreadCount: lastMsg.role === 'customer' ? randomInt(0, 1) : 0,
        isActive: true,
        createdAt: addDays(now, -randomInt(3, 7)),
        updatedAt: new Date(),
      });

      const convId = convDoc.insertedId.toString();
      const msgs = conv.messages.map((m, i) => ({
        conversationId: convId,
        senderId: m.sender,
        senderRole: m.role,
        content: m.text,
        isRead: i < conv.messages.length - 1,
        readAt: i < conv.messages.length - 1 ? addDays(now, -randomInt(0, 2)) : undefined,
        createdAt: addDays(now, -randomInt(0, 5) + i * 0.01), // sequential order
        updatedAt: new Date(),
      }));

      await msgColl.insertMany(msgs);
    }
    console.log(`   ✓ ${convos.length} conversations with messages created`);

    await mongoose.disconnect();

    console.log('\n🎉 Seed complete! All databases populated.\n');
    console.log('─────────────────────────────────────────────');
    console.log('Test Accounts:');
    console.log('  Customer:       booking@co.com / Hello@123');
    console.log('  Business Owner: booking@go.com / Hello@123');
    console.log('─────────────────────────────────────────────\n');
  } catch (err) {
    console.error('❌ Seed failed:', err);
    await pool.end();
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

main();
