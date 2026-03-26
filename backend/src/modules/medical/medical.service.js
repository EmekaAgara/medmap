const MedicalProfile = require('../../models/MedicalProfile');
const Appointment = require('../../models/Appointment');

function normalizeList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  return String(value)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function toNumberOrNull(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function getOrCreateProfile(userId) {
  let profile = await MedicalProfile.findOne({ user: userId }).lean();
  if (!profile) {
    profile = await MedicalProfile.create({ user: userId });
    profile = profile.toObject();
  }
  return profile;
}

async function upsertProfile(userId, payload) {
  const allergies = normalizeList(payload.allergies);
  const conditions = normalizeList(payload.conditions);
  const medications = normalizeList(payload.medications);

  const heightCm = toNumberOrNull(payload?.vitals?.heightCm ?? payload.heightCm);
  const weightKg = toNumberOrNull(payload?.vitals?.weightKg ?? payload.weightKg);
  const bloodGroupRaw = payload?.vitals?.bloodGroup ?? payload.bloodGroup;
  const bloodGroup = bloodGroupRaw != null ? String(bloodGroupRaw).trim().toUpperCase() : undefined;

  const aiAssistant = payload?.consent?.aiAssistant ?? payload?.aiAssistant;
  const setConsent = aiAssistant !== undefined ? !!aiAssistant : undefined;

  const update = {
    allergies,
    conditions,
    medications,
    vitals: {
      heightCm: heightCm ?? undefined,
      weightKg: weightKg ?? undefined,
      bloodGroup: bloodGroup || undefined,
    },
  };

  if (setConsent !== undefined) {
    update.consent = {
      aiAssistant: setConsent,
      aiConsentAt: setConsent ? new Date() : null,
    };
  }

  const doc = await MedicalProfile.findOneAndUpdate(
    { user: userId },
    { $set: update, $setOnInsert: { user: userId } },
    { upsert: true, new: true }
  ).lean();

  return doc;
}

async function getTimeline(userId, { limit = 30 } = {}) {
  const profile = await getOrCreateProfile(userId);
  const cap = Math.max(1, Math.min(200, parseInt(limit, 10) || 30));

  const appointments = await Appointment.find({ patientUser: userId })
    .sort({ createdAt: -1 })
    .limit(cap)
    .populate('provider', 'name providerType city')
    .lean();

  const items = [];
  for (const appt of appointments) {
    items.push({
      kind: 'appointment',
      at: appt.confirmedStart || appt.requestedStart || appt.createdAt,
      id: appt._id,
      status: appt.status,
      provider: appt.provider,
      consultationFee: appt.consultationFee || 0,
      providerNote: appt.providerNote || '',
      patientNote: appt.patientNote || '',
    });
  }

  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return {
    profile,
    timeline: items,
  };
}

module.exports = {
  getOrCreateProfile,
  upsertProfile,
  getTimeline,
};

