/**
 * Seed ~200 demo providers across Lagos + Nigeria.
 *
 * Run:
 *   cd backend
 *   npm run seed:nigeria:500
 *
 * Notes:
 * - This creates BOTH provider users (doctor/pharmacy_admin/hospital_admin)
 *   and their owned provider listings, so patients can book appointments.
 * - Images are placeholder URLs (picsum) to populate Home cards.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const { hashPassword } = require('../src/utils/crypto');

const User = require('../src/models/User');
const Provider = require('../src/models/Provider');
const Appointment = require('../src/models/Appointment');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/medmap';

const passwordHashPromise = hashPassword('MedMapPass123!');

const FIRST_NAMES = ['Amina', 'Tobi', 'Zainab', 'Chinedu', 'Ngozi', 'Bolanle', 'Mustapha', 'Ifeoma', 'Yusuf', 'Sarah'];
const LAST_NAMES = ['Okafor', 'Adeyemi', 'Abubakar', 'Oluwafemi', 'Eze', 'Musa', 'Nwankwo', 'Balogun', 'Bello', 'Anya'];

const SERVICES = [
  'General consultation',
  'Pediatrics consult',
  'Vaccinations',
  'Blood tests',
  'Family planning',
  'Emergency walk-in',
  'Pharmacy counselling',
  'Outpatient care',
  'Prenatal checks',
  'Free consultation',
  'Free blood pressure check',
];

const PRODUCTS = [
  'Antibiotics',
  'Vitamins',
  'Cough syrup',
  'First aid kit',
  'Blood pressure monitor',
  'Hand sanitizers',
  'Thermometer',
  'Bandages',
  'Oral rehydration salts',
  'Free medicine pack',
  'Free malaria test',
];

const WORKING_HOURS = ['Mon–Fri 8am–6pm', 'Mon–Sat 9am–9pm', '24/7', 'Weekdays 9am–5pm', 'Sun–Thu 8am–7pm'];
const AVAILABILITY_TEXT = ['Open daily', 'Open weekdays', 'Open 24/7 for urgent cases', 'Walk-ins welcome', 'Emergency-ready'];

/** Land-only bounding boxes (mostly inland / metro cores) — ~65% Lagos, rest spread across Nigeria */
const CITY_LAND_BOXES = [
  { name: 'Lagos', weight: 0.65, minLat: 6.48, maxLat: 6.72, minLng: 3.25, maxLng: 3.58 },
  { name: 'Abuja', weight: 0.08, minLat: 8.98, maxLat: 9.18, minLng: 7.35, maxLng: 7.52 },
  { name: 'Ibadan', weight: 0.06, minLat: 7.32, maxLat: 7.45, minLng: 3.85, maxLng: 4.05 },
  { name: 'Port Harcourt', weight: 0.06, minLat: 4.76, maxLat: 4.88, minLng: 6.98, maxLng: 7.12 },
  { name: 'Kano', weight: 0.05, minLat: 11.95, maxLat: 12.05, minLng: 8.48, maxLng: 8.58 },
  { name: 'Enugu', weight: 0.03, minLat: 6.42, maxLat: 6.48, minLng: 7.48, maxLng: 7.56 },
  { name: 'Benin City', weight: 0.03, minLat: 6.28, maxLat: 6.38, minLng: 5.58, maxLng: 5.68 },
  { name: 'Kaduna', weight: 0.03, minLat: 10.48, maxLat: 10.58, minLng: 7.38, maxLng: 7.48 },
  { name: 'Jos', weight: 0.02, minLat: 9.88, maxLat: 9.98, minLng: 8.84, maxLng: 8.96 },
  { name: 'Owerri', weight: 0.02, minLat: 5.46, maxLat: 5.52, minLng: 7.02, maxLng: 7.08 },
  { name: 'Calabar', weight: 0.02, minLat: 4.94, maxLat: 5.02, minLng: 8.28, maxLng: 8.38 },
  { name: 'Maiduguri', weight: 0.02, minLat: 11.78, maxLat: 11.88, minLng: 13.05, maxLng: 13.18 },
];

function weightedPick(arr) {
  const total = arr.reduce((s, x) => s + (x.weight || 0), 0);
  let r = Math.random() * total;
  for (const x of arr) {
    r -= (x.weight || 0);
    if (r <= 0) return x;
  }
  return arr[arr.length - 1];
}

function randomPointInLandBox(box) {
  const lat = box.minLat + Math.random() * (box.maxLat - box.minLat);
  const lng = box.minLng + Math.random() * (box.maxLng - box.minLng);
  return { lat, lng, name: box.name };
}

function weightedLandPoint() {
  const box = weightedPick(CITY_LAND_BOXES);
  return randomPointInLandBox(box);
}

function pickN(list, n) {
  const copy = [...list];
  copy.sort(() => Math.random() - 0.5);
  return copy.slice(0, n);
}

/** Priced catalog: images + short copy for storefront; some items free. */
function buildProductCatalog(i) {
  const numProducts = 2 + (i % 5);
  const names = pickN(PRODUCTS, numProducts);
  return names.map((name, idx) => {
    const lower = String(name).toLowerCase();
    const isFree = lower.includes('free') || (i + idx) % 6 === 0;
    const price = isFree ? 0 : 800 + ((i * 3 + idx * 7) % 120) * 500;
    return {
      name,
      price,
      description: `${name} — stocked for patient care. Sold by Mpd providers; verify suitability with your clinician.`,
      imageUrl: `https://picsum.photos/seed/mpd-p${i}-${idx}/480/480`,
    };
  });
}

function providerTypeFromAccountType(accountType) {
  if (accountType === 'doctor') return 'doctor';
  if (accountType === 'hospital_admin') return 'hospital';
  if (accountType === 'pharmacy_admin') return 'pharmacy';
  return 'doctor';
}

function accountTypeFromIndex(i) {
  const m = i % 3;
  if (m === 0) return 'doctor';
  if (m === 1) return 'hospital_admin';
  return 'pharmacy_admin';
}

async function run() {
  await mongoose.connect(MONGO_URI);

  const passwordHash = await passwordHashPromise;
  const count = 500;
  const patientCount = 35;

  // Idempotency: remove previous seeded users/providers
  // based on a consistent email prefix.
  const emailPrefix = 'seed_nigeria_provider_';
  await User.deleteMany({ email: { $regex: `^${emailPrefix}` } });
  await Provider.deleteMany({ name: { $regex: '^(MedMap Demo|Mpd) ' } });
  await User.deleteMany({ email: { $regex: '^seed_patient_' } });
  await Appointment.deleteMany({ patientNote: 'Demo appointment for MedMap' });

  const createdProviders = [];
  const createdPatients = [];

  for (let i = 1; i <= count; i++) {
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const last = LAST_NAMES[(i * 7) % LAST_NAMES.length];
    const fullName = `${first} ${last}`;

    const accountType = accountTypeFromIndex(i);
    const providerType = providerTypeFromAccountType(accountType);

    const pt = weightedLandPoint();
    const lat = pt.lat;
    const lng = pt.lng;
    const city = { name: pt.name };

    const email = `${emailPrefix}${i}@example.com`;
    const phone = `+234800${String(100000 + i).slice(-6)}`; // simple deterministic phone

    const user = await User.create({
      email,
      phone,
      passwordHash,
      fullName,
      accountType,
      roles: ['user'],
      isBanned: false,
      isDeactivated: false,
      location: { type: 'Point', coordinates: [lng, lat] },
    });

    const numServices = 3 + (i % 3);

    createdProviders.push({
      ownerUser: user._id,
      providerType,
      name: `Mpd ${providerType} ${i}`,
      description: 'Mpd provider listing — primary care, pharmacy, or hospital services.',
      hourlyRate: Math.random() < 0.12 ? 0 : 7000 + (i % 30) * 250,
      imageUrl: `https://picsum.photos/seed/medmap-${i}/128/128`,
      services: pickN(SERVICES, numServices),
      products: buildProductCatalog(i),
      phone,
      email,
      city: city.name,
      country: 'NG',
      address: `${10 + (i % 200)} Health Street, ${city.name}`,
      isOpenNow: Math.random() > 0.25,
      workingHours: WORKING_HOURS[i % WORKING_HOURS.length],
      availabilityText: AVAILABILITY_TEXT[i % AVAILABILITY_TEXT.length],
      chatEnabled: true,
      moderationStatus: 'approved',
      isVerified: true,
      isActive: true,
      location: { type: 'Point', coordinates: [lng, lat] },
    });
  }

  await Provider.insertMany(createdProviders);

  // Seed patient users + demo appointment requests so they appear in "My appointments".
  // This does not implement payment flow; it only provides demo appointments that can be confirmed later.
  for (let j = 1; j <= patientCount; j++) {
    const first = FIRST_NAMES[(j + 3) % FIRST_NAMES.length];
    const last = LAST_NAMES[(j * 5 + 1) % LAST_NAMES.length];
    const fullName = `${first} ${last}`;

    const patientEmail = `seed_patient_${j}@example.com`;
    const patientPhone = `+234801${String(200000 + j).slice(-6)}`;

    const pt = weightedLandPoint();
    const lat = pt.lat;
    const lng = pt.lng;
    const city = { name: pt.name };

    const patient = await User.create({
      email: patientEmail,
      phone: patientPhone,
      passwordHash,
      fullName,
      accountType: 'patient',
      roles: ['user'],
      isBanned: false,
      isDeactivated: false,
      location: { type: 'Point', coordinates: [lng, lat] },
    });

    createdPatients.push(patient._id);
  }

  const providerDocs = await Provider.find({ moderationStatus: 'approved', isActive: true }).select('_id ownerUser').lean();
  const providerCount = providerDocs.length;

  const now = Date.now();
  const ONE_HOUR_MS = 60 * 60 * 1000;

  const appointmentsToCreate = [];
  for (let j = 0; j < createdPatients.length; j++) {
    const patientUserId = createdPatients[j];

    const numAppointments = 2 + (j % 3); // 2..4
    for (let k = 0; k < numAppointments; k++) {
      const p = providerDocs[Math.floor(Math.random() * providerCount)];
      if (!p) continue;

      const dayOffset = 1 + Math.floor(Math.random() * 12);
      const startHour = 8 + Math.floor(Math.random() * 9); // 8..16
      const start = new Date(now + dayOffset * 24 * 60 * 60 * 1000);
      start.setHours(startHour, 0, 0, 0);

      // Some demo appointments are "confirmed" so both flows are visible.
      const isConfirmed = Math.random() < 0.25;
      const status = isConfirmed ? 'confirmed' : 'pending';
      const end = new Date(start.getTime() + ONE_HOUR_MS);

      appointmentsToCreate.push({
        patientUser: patientUserId,
        provider: p._id,
        providerOwnerUser: p.ownerUser,
        status,
        requestedStart: start,
        requestedEnd: end,
        confirmedStart: isConfirmed ? start : undefined,
        confirmedEnd: isConfirmed ? end : undefined,
        patientNote: 'Demo appointment for MedMap',
      });
    }
  }

  await Appointment.insertMany(appointmentsToCreate);
  console.log(`Seeded ${count} provider users + ${count} providers + ${patientCount} patient users + ${appointmentsToCreate.length} appointments`);

  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

