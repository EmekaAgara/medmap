/**
 * Seeds approved demo providers for Phase 1 discovery (list/map/call).
 * From backend/: node scripts/seed-phase1-providers.js
 * Requires MONGO_URI (see .env).
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Provider = require('../src/models/Provider');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/medmap';

/** Lagos area — lng, lat for GeoJSON Point */
const samples = [
  {
    providerType: 'doctor',
    name: 'MedMap Demo Family Clinic',
    description: 'Seed listing for testing discovery.',
    services: ['General practice', 'Consultation', 'Pediatrics'],
    hourlyRate: 15000,
    phone: '+2348000000001',
    email: 'demo.clinic@example.com',
    address: '12 Health Avenue, Victoria Island',
    city: 'Lagos',
    country: 'NG',
    workingHours: 'Mon–Fri 8am–6pm',
    availabilityText: 'Open weekdays',
    isOpenNow: true,
    chatEnabled: true,
    isVerified: true,
    isActive: true,
    moderationStatus: 'approved',
    location: { type: 'Point', coordinates: [3.4216, 6.4281] },
  },
  {
    providerType: 'pharmacy',
    name: 'MedMap Demo Pharmacy',
    description: 'Prescriptions and OTC.',
    services: ['Prescriptions', 'Delivery', 'OTC'],
    hourlyRate: 12000,
    products: ['Vitamins', 'First aid'],
    phone: '+2348000000002',
    email: 'demo.pharmacy@example.com',
    address: '45 Pharmacy Road, Ikeja',
    city: 'Lagos',
    country: 'NG',
    workingHours: 'Mon–Sat 9am–9pm',
    availabilityText: 'Open daily',
    isOpenNow: true,
    chatEnabled: true,
    isVerified: true,
    isActive: true,
    moderationStatus: 'approved',
    location: { type: 'Point', coordinates: [3.35, 6.6] },
  },
  {
    providerType: 'hospital',
    name: 'MedMap Demo Hospital',
    description: 'Emergency and inpatient.',
    services: ['Emergency', 'Surgery', 'Laboratory'],
    hourlyRate: 20000,
    phone: '+2348000000003',
    email: 'demo.hospital@example.com',
    address: '1 Hospital Way, Surulere',
    city: 'Lagos',
    country: 'NG',
    workingHours: '24/7',
    availabilityText: 'Always open',
    isOpenNow: true,
    chatEnabled: true,
    isVerified: true,
    isActive: true,
    moderationStatus: 'approved',
    location: { type: 'Point', coordinates: [3.35, 6.5] },
  },
];

async function run() {
  await mongoose.connect(MONGO_URI);
  const names = samples.map((s) => s.name);
  await Provider.deleteMany({ name: { $in: names } });
  await Provider.insertMany(samples);
  console.log(`Seeded ${samples.length} approved providers:`, names.join(', '));
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
