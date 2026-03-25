const Provider = require('../../models/Provider');

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  return String(value)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

/** Normalize catalog: legacy strings become { name, price: 0 } */
function normalizeProducts(value) {
  if (!value) return [];
  if (!Array.isArray(value)) return normalizeProducts([value]);
  const out = [];
  for (const item of value) {
    if (typeof item === 'string') {
      const t = item.trim();
      if (t) out.push({ name: t, price: 0 });
    } else if (item && typeof item === 'object' && item.name != null) {
      const name = String(item.name).trim();
      if (!name) continue;
      const price = Math.max(0, Number(item.price) || 0);
      out.push({ name, price });
    }
  }
  return out;
}

function coerceProductsForApi(raw) {
  return normalizeProducts(raw);
}

/** Strip internal fields; expose chat/book flags (owner required). */
function toPublicProvider(doc) {
  if (!doc) return doc;
  const hasOwner = !!doc.ownerUser;
  const canChat = !!(hasOwner && doc.chatEnabled !== false);
  const canBook = hasOwner;
  const {
    ownerUser,
    claimRequestedBy,
    claimRequestedAt,
    moderatedBy,
    distanceMeters,
    ...rest
  } = doc;
  const products = coerceProductsForApi(doc.products);
  return { ...rest, products, canChat, canBook };
}

async function listProviders(query = {}) {
  const {
    type,
    city,
    openNow,
    search,
    latitude,
    longitude,
    page = 1,
    radiusKm = 10,
    limit = 20,
  } = query;

  const parsedLat = toNumber(latitude);
  const parsedLng = toNumber(longitude);
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  // Allow listing across larger distances (e.g. demo providers across Nigeria).
  // We still keep an upper bound to avoid extreme geoNear queries.
  const parsedRadiusKm = Math.max(1, Math.min(50000, toNumber(radiusKm) || 10));
  const parsedLimit = Math.max(1, Math.min(500, parseInt(limit, 10) || 20));
  const skip = (parsedPage - 1) * parsedLimit;

  const match = { isActive: true, moderationStatus: 'approved' };
  if (type) match.providerType = type;
  if (city) match.city = new RegExp(`^${city.trim()}$`, 'i');
  if (openNow === 'true') match.isOpenNow = true;
  if (search) {
    const escaped = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(escaped, 'i');
    match.$or = [
      { name: rx },
      { workingHours: rx },
      { availabilityText: rx },
      { services: { $elemMatch: { $regex: search, $options: 'i' } } },
      { products: { $elemMatch: { name: { $regex: search, $options: 'i' } } } },
      { products: { $elemMatch: { $regex: search, $options: 'i' } } },
    ];
  }

  if (parsedLat !== null && parsedLng !== null) {
    const providers = await Provider.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [parsedLng, parsedLat] },
          distanceField: 'distanceMeters',
          spherical: true,
          maxDistance: parsedRadiusKm * 1000,
          query: match,
        },
      },
      { $sort: { isVerified: -1, isOpenNow: -1, distanceMeters: 1 } },
      { $skip: skip },
      { $limit: parsedLimit },
    ]);

    return providers.map((provider) =>
      toPublicProvider({
        ...provider,
        distanceKm: Number((provider.distanceMeters / 1000).toFixed(2)),
      })
    );
  }

  const rows = await Provider.find(match)
    .sort({ isVerified: -1, isOpenNow: -1, updatedAt: -1 })
    .skip(skip)
    .limit(parsedLimit)
    .lean();
  return rows.map((p) => toPublicProvider(p));
}

async function getProvider(providerId, { publicOnly = true } = {}) {
  const match = { _id: providerId, isActive: true };
  if (publicOnly) match.moderationStatus = 'approved';
  const doc = await Provider.findOne(match).lean();
  return publicOnly ? toPublicProvider(doc) : doc;
}

async function getMine(userId) {
  const doc = await Provider.findOne({ ownerUser: userId, isActive: true }).lean();
  if (!doc) return null;
  return { ...doc, products: coerceProductsForApi(doc.products) };
}

async function upsertMine(userId, payload) {
  const location = payload?.location;
  const longitude = toNumber(location?.longitude);
  const latitude = toNumber(location?.latitude);

  if (longitude === null || latitude === null) {
    throw Object.assign(new Error('Valid location longitude/latitude is required'), { status: 400 });
  }

  const update = {
    ownerUser: userId,
    providerType: payload.providerType,
    name: payload.name,
    description: payload.description,
    hourlyRate: toNumber(payload.hourlyRate) ?? 0,
    imageUrl: payload.imageUrl != null ? String(payload.imageUrl).trim() : undefined,
    services: normalizeList(payload.services),
    products: normalizeProducts(payload.products),
    phone: payload.phone,
    email: payload.email,
    address: payload.address,
    city: payload.city,
    country: payload.country,
    isOpenNow: payload.isOpenNow !== undefined ? !!payload.isOpenNow : true,
    workingHours: String(payload.workingHours || '').trim(),
    availabilityText: payload.availabilityText || 'Open daily',
    chatEnabled: payload.chatEnabled !== undefined ? !!payload.chatEnabled : true,
    moderationStatus: 'pending',
    moderationReason: undefined,
    isVerified: false,
    location: { type: 'Point', coordinates: [longitude, latitude] },
  };

  if (!update.providerType || !update.name || !update.phone) {
    throw Object.assign(new Error('providerType, name, and phone are required'), { status: 400 });
  }

  return Provider.findOneAndUpdate(
    { ownerUser: userId },
    update,
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  ).lean();
}

async function updateMineAvatar(userId, imageUrl) {
  const provider = await Provider.findOne({ ownerUser: userId, isActive: true });
  if (!provider) {
    throw Object.assign(new Error('Provider listing not found'), { status: 404 });
  }

  provider.imageUrl = imageUrl;
  // If a provider updates their image, re-send for moderation.
  provider.moderationStatus = 'pending';
  provider.moderationReason = undefined;
  provider.isVerified = false;
  await provider.save();

  return provider.toObject();
}

async function claimProvider({ userId, providerId }) {
  const provider = await Provider.findOne({ _id: providerId, isActive: true });
  if (!provider) throw Object.assign(new Error('Provider not found'), { status: 404 });
  if (provider.ownerUser && String(provider.ownerUser) === String(userId)) {
    throw Object.assign(new Error('You already own this provider listing'), { status: 400 });
  }

  provider.claimRequestedBy = userId;
  provider.claimRequestedAt = new Date();
  provider.moderationStatus = 'pending';
  provider.moderationReason = undefined;
  provider.isVerified = false;
  await provider.save();
  return provider.toObject();
}

async function listPendingModeration({ page = 1, limit = 20 }) {
  const skip = (Number(page) - 1) * Number(limit);
  const query = {
    isActive: true,
    $or: [{ moderationStatus: 'pending' }, { claimRequestedBy: { $exists: true, $ne: null } }],
  };
  const [items, total] = await Promise.all([
    Provider.find(query)
      .populate('ownerUser', 'fullName email phone')
      .populate('claimRequestedBy', 'fullName email phone')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Provider.countDocuments(query),
  ]);
  return { items, total, page: Number(page), pages: Math.ceil(total / Number(limit)) };
}

async function moderateProvider({ providerId, adminId, action, reason }) {
  const provider = await Provider.findById(providerId);
  if (!provider) throw Object.assign(new Error('Provider not found'), { status: 404 });

  if (!['approve', 'reject'].includes(action)) {
    throw Object.assign(new Error("Action must be 'approve' or 'reject'"), { status: 400 });
  }
  if (action === 'reject' && !String(reason || '').trim()) {
    throw Object.assign(new Error('Rejection reason is required'), { status: 400 });
  }

  provider.moderationStatus = action === 'approve' ? 'approved' : 'rejected';
  provider.moderationReason = action === 'reject' ? String(reason).trim() : undefined;
  provider.moderatedBy = adminId;
  provider.moderatedAt = new Date();
  provider.isVerified = action === 'approve';
  if (action === 'approve' && provider.claimRequestedBy) {
    provider.ownerUser = provider.claimRequestedBy;
  }
  provider.claimRequestedBy = undefined;
  provider.claimRequestedAt = undefined;

  await provider.save();
  return provider.toObject();
}

module.exports = {
  listProviders,
  getProvider,
  getMine,
  upsertMine,
  updateMineAvatar,
  claimProvider,
  listPendingModeration,
  moderateProvider,
};
