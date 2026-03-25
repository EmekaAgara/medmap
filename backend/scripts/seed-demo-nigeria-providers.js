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

const CITY_CENTERS = [
  { name: 'Lagos', lat: 6.5244, lng: 3.3792, weight: 0.65 },
  { name: 'Abuja', lat: 9.0765, lng: 7.3986, weight: 0.08 },
  { name: 'Ibadan', lat: 7.3775, lng: 3.947, weight: 0.06 },
  { name: 'Port Harcourt', lat: 4.8156, lng: 7.0498, weight: 0.06 },
  { name: 'Kano', lat: 12.0, lng: 8.5, weight: 0.05 },
  { name: 'Enugu', lat: 6.4478, lng: 7.5046, weight: 0.03 },
  { name: 'Benin City', lat: 6.3383, lng: 5.6147, weight: 0.03 },
  { name: 'Kaduna', lat: 10.5222, lng: 7.4189, weight: 0.03 },
  { name: 'Jos', lat: 9.9249, lng: 8.8917, weight: 0.02 },
  { name: 'Owerri', lat: 5.485, lng: 7.033, weight: 0.02 },
  { name: 'Calabar', lat: 4.95, lng: 8.33, weight: 0.02 },
  { name: 'Maiduguri', lat: 11.8333, lng: 13.15, weight: 0.02 },
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

function jitter(value, maxAbsDelta) {
  return value + (Math.random() * 2 - 1) * maxAbsDelta;
}

function pickN(list, n) {
  const copy = [...list];
  copy.sort(() => Math.random() - 0.5);
  return copy.slice(0, n);
}

/** Priced catalog: some items free (price 0), some paid (NGN). */
function buildProductCatalog(i) {
  const numProducts = 2 + (i % 5);
  const names = pickN(PRODUCTS, numProducts);
  return names.map((name, idx) => {
    const lower = String(name).toLowerCase();
    const isFree = lower.includes('free') || (i + idx) % 6 === 0;
    return {
      name,
      price: isFree ? 0 : 800 + ((i * 3 + idx * 7) % 120) * 500,
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
  await Provider.deleteMany({ name: { $regex: '^MedMap Demo' } });
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

    const city = weightedPick(CITY_CENTERS);
    const latDelta = city.name === 'Lagos' ? 0.06 : 0.1;
    const lngDelta = city.name === 'Lagos' ? 0.08 : 0.12;

    const lat = jitter(city.lat, latDelta);
    const lng = jitter(city.lng, lngDelta);

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
      name: `MedMap Demo ${providerType} ${i}`,
      description: 'Demo provider listing seeded for Phase 1–2 discovery.',
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

    const city = weightedPick(CITY_CENTERS);
    const latDelta = city.name === 'Lagos' ? 0.04 : 0.08;
    const lngDelta = city.name === 'Lagos' ? 0.06 : 0.1;
    const lat = jitter(city.lat, latDelta);
    const lng = jitter(city.lng, lngDelta);

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

