const Order = require('../../models/Order');
const Provider = require('../../models/Provider');
const walletService = require('../wallet/wallet.service');
const cloudinary = require('../../config/cloudinary');
const PrescriptionUpload = require('../../models/PrescriptionUpload');
const { notifyUser } = require('../../utils/notify');

// Catalog normalization (keep in sync with provider.service normalizeProducts)
function normalizeCatalog(raw) {
  if (!raw) return [];
  if (!Array.isArray(raw)) return normalizeCatalog([raw]);
  const out = [];
  for (const item of raw) {
    if (typeof item === 'string') {
      const t = item.trim();
      if (t) out.push({ name: t, price: 0 });
    } else if (item && typeof item === 'object' && item.name != null) {
      const name = String(item.name).trim();
      if (!name) continue;
      const price = Math.max(0, Number(item.price) || 0);
      const stockQtyRaw = item.stockQty ?? item.stock ?? item.quantity;
      const stockQtyParsed = stockQtyRaw == null ? null : Math.floor(Number(stockQtyRaw));
      const stockQty =
        Number.isFinite(stockQtyParsed) && stockQtyParsed >= 0 ? stockQtyParsed : undefined;
      const row = {
        name,
        price,
        stockQty,
        requiresPrescription: item.requiresPrescription != null ? !!item.requiresPrescription : false,
        isRestricted: item.isRestricted != null ? !!item.isRestricted : false,
      };
      if (item.description) row.description = String(item.description).slice(0, 2000);
      if (item.imageUrl) row.imageUrl = String(item.imageUrl).slice(0, 2048);
      out.push(row);
    }
  }
  return out;
}

async function uploadPrescription({ buyerUserId, providerId, file }) {
  if (!file || !file.buffer) {
    throw Object.assign(new Error('File is required'), { status: 400 });
  }
  const provider = await Provider.findOne({
    _id: providerId,
    isActive: true,
    moderationStatus: 'approved',
  }).lean();
  if (!provider) throw Object.assign(new Error('Provider not found'), { status: 404 });

  const mimeType = String(file.mimetype || '').toLowerCase();
  const allowed = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
  ]);
  if (mimeType && !allowed.has(mimeType)) {
    throw Object.assign(new Error('Unsupported file type'), { status: 400 });
  }

  const uploadResult = await new Promise((resolve, reject) => {
    const isPdf = mimeType === 'application/pdf';
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'medmap/prescriptions',
        resource_type: isPdf ? 'raw' : 'image',
        transformation: isPdf
          ? undefined
          : [{ quality: 'auto', fetch_format: 'auto' }],
      },
      (error, result) => {
        if (error) return reject(error);
        return resolve(result);
      },
    );
    stream.end(file.buffer);
  });

  const row = await PrescriptionUpload.create({
    buyerUser: buyerUserId,
    provider: provider._id,
    url: uploadResult.secure_url,
    mimeType: mimeType || undefined,
    originalName: file.originalname ? String(file.originalname).slice(0, 255) : undefined,
  });

  return { prescriptionUploadId: row._id, url: row.url };
}

async function decrementProviderStock({ providerId, items }) {
  const provider = await Provider.findById(providerId);
  if (!provider) return;
  if (!Array.isArray(provider.products)) return;

  const map = new Map();
  for (const it of items || []) {
    const k = String(it.name || '').toLowerCase();
    if (!k) continue;
    map.set(k, (map.get(k) || 0) + (Number(it.quantity) || 0));
  }
  if (!map.size) return;

  provider.products = provider.products.map((p) => {
    if (!p || typeof p !== 'object' || p.name == null) return p;
    const k = String(p.name).toLowerCase();
    if (!map.has(k)) return p;
    const qty = map.get(k);
    const stockQtyParsed = p.stockQty == null ? null : Math.floor(Number(p.stockQty));
    if (!Number.isFinite(stockQtyParsed) || stockQtyParsed < 0) return p;
    return { ...p, stockQty: Math.max(0, stockQtyParsed - qty) };
  });

  await provider.save();
}

function buildFulfillment(payload) {
  const method = payload?.fulfillment?.method || payload?.fulfillmentMethod || 'pickup';
  const normalized = method === 'delivery' ? 'delivery' : 'pickup';
  const address = payload?.fulfillment?.address ?? payload?.deliveryAddress;
  const phone = payload?.fulfillment?.phone ?? payload?.deliveryPhone;
  const notes = payload?.fulfillment?.notes ?? payload?.fulfillmentNotes;

  return {
    method: normalized,
    address: address != null ? String(address).trim().slice(0, 500) : undefined,
    phone: phone != null ? String(phone).trim().slice(0, 64) : undefined,
    notes: notes != null ? String(notes).trim().slice(0, 500) : undefined,
  };
}

async function createOrder(buyerUserId, payload) {
  const { providerId, lines } = payload || {};
  if (!providerId) throw Object.assign(new Error('providerId is required'), { status: 400 });
  if (!Array.isArray(lines) || !lines.length) {
    throw Object.assign(new Error('lines array is required'), { status: 400 });
  }

  const provider = await Provider.findOne({
    _id: providerId,
    isActive: true,
    moderationStatus: 'approved',
  }).lean();

  if (!provider) throw Object.assign(new Error('Provider not found'), { status: 404 });
  if (!provider.ownerUser) {
    throw Object.assign(new Error('This provider is not accepting orders yet'), { status: 400 });
  }

  const catalog = normalizeCatalog(provider.products);
  const catalogByName = new Map(catalog.map((p) => [p.name.toLowerCase(), p]));

  const validatedItems = [];
  let total = 0;
  let prescriptionRequired = false;

  for (const line of lines) {
    const name = String(line.name || '').trim();
    if (!name) continue;
    const qty = Math.max(1, parseInt(line.quantity, 10) || 1);
    const found = catalogByName.get(name.toLowerCase());
    if (!found) {
      throw Object.assign(new Error(`Product not listed: ${name}`), { status: 400 });
    }
    if (found.stockQty != null && Number.isFinite(Number(found.stockQty))) {
      if (Number(found.stockQty) < qty) {
        throw Object.assign(new Error(`Out of stock: ${found.name}`), { status: 400 });
      }
    }
    if (found.requiresPrescription || found.isRestricted) {
      prescriptionRequired = true;
    }
    const unitPrice = found.price;
    total += unitPrice * qty;
    validatedItems.push({ name: found.name, unitPrice, quantity: qty });
  }

  if (!validatedItems.length) {
    throw Object.assign(new Error('No valid line items'), { status: 400 });
  }

  const fulfillment = buildFulfillment(payload);

  if (
    prescriptionRequired &&
    !(payload?.prescriptionUploadId || payload?.prescriptionId || payload?.prescriptionUrl)
  ) {
    throw Object.assign(new Error('Prescription is required for one or more items'), {
      status: 400,
      details: { requiresPrescription: true },
    });
  }

  let prescriptionMeta = { required: prescriptionRequired };
  const providedUploadId = payload?.prescriptionUploadId || payload?.prescriptionId;
  const providedUrl = payload?.prescriptionUrl;
  if (providedUploadId) {
    const upload = await PrescriptionUpload.findById(providedUploadId).lean();
    if (!upload) {
      throw Object.assign(new Error('Prescription upload not found'), { status: 400 });
    }
    if (String(upload.buyerUser) !== String(buyerUserId)) {
      throw Object.assign(new Error('Invalid prescription upload'), { status: 403 });
    }
    if (String(upload.provider) !== String(provider._id)) {
      throw Object.assign(new Error('Prescription upload must match provider'), { status: 400 });
    }
    prescriptionMeta = { ...prescriptionMeta, uploadId: upload._id, url: upload.url };
  } else if (providedUrl) {
    prescriptionMeta = { ...prescriptionMeta, url: String(providedUrl).trim().slice(0, 2048) };
  }

  const order = await Order.create({
    buyerUser: buyerUserId,
    provider: provider._id,
    providerOwnerUser: provider.ownerUser,
    items: validatedItems,
    totalAmount: total,
    currency: 'NGN',
    fulfillment,
    prescription: prescriptionMeta,
    status: total === 0 ? 'paid' : 'pending_payment',
    paidAt: total === 0 ? new Date() : undefined,
    trackingEvents: [
      { status: 'created', note: 'Order created' },
      ...(total === 0 ? [{ status: 'paid', note: 'Free order' }] : []),
    ],
  });

  if (total === 0) {
    await decrementProviderStock({ providerId: provider._id, items: validatedItems });
    await notifyUser({
      userId: provider.ownerUser,
      type: 'order',
      title: 'New order',
      body: `You received a new order (${validatedItems.length} item${validatedItems.length === 1 ? '' : 's'}).`,
      data: { type: 'order', orderId: String(order._id) },
      push: true,
      email: true,
      emailSubject: 'New MedMap order',
    });
    return { order: order.toObject(), payment: null };
  }

  const wallet = await walletService.getWalletSummary(buyerUserId);
  const balance = Number(wallet.availableBalance) || 0;

  if (balance >= total) {
    const { reference } = await walletService.debitWallet(buyerUserId, total, {
      meta: { orderId: String(order._id), type: 'product_order' },
    });
    order.status = 'paid';
    order.paymentReference = reference;
    order.paidAt = new Date();
    order.trackingEvents = [
      ...(order.trackingEvents || []),
      { status: 'paid', note: 'Paid from wallet' },
    ];
    await order.save();
    await decrementProviderStock({ providerId: provider._id, items: validatedItems });
    await notifyUser({
      userId: provider.ownerUser,
      type: 'order',
      title: 'New paid order',
      body: `A customer paid for an order of ₦${Number(total).toLocaleString()}.`,
      data: { type: 'order', orderId: String(order._id) },
      push: true,
      email: true,
      emailSubject: 'New paid MedMap order',
    });
    return { order: order.toObject(), payment: { method: 'wallet', reference } };
  }

  const shortfall = total - balance;
  const fund = await walletService.initFundWallet(buyerUserId, shortfall, {
    intent: 'order_topup',
    orderId: String(order._id),
  });

  return {
    order: order.toObject(),
    payment: {
      method: 'interswitch',
      shortfall,
      walletBalance: balance,
      requiredTotal: total,
      ...fund,
    },
  };
}

async function completeOrderPayment(buyerUserId, orderId) {
  const order = await Order.findById(orderId);
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
  if (String(order.buyerUser) !== String(buyerUserId)) {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }
  if (order.status !== 'pending_payment') {
    throw Object.assign(new Error('Order is not awaiting payment'), { status: 400 });
  }

  const total = Number(order.totalAmount) || 0;
  const wallet = await walletService.getWalletSummary(buyerUserId);
  const balance = Number(wallet.availableBalance) || 0;

  if (balance < total) {
    const shortfall = total - balance;
    const fund = await walletService.initFundWallet(buyerUserId, shortfall, {
      intent: 'order_topup',
      orderId: String(order._id),
    });
    return {
      order: order.toObject(),
      payment: {
        method: 'interswitch',
        shortfall,
        walletBalance: balance,
        requiredTotal: total,
        ...fund,
      },
    };
  }

  const { reference } = await walletService.debitWallet(buyerUserId, total, {
    meta: { orderId: String(order._id), type: 'product_order' },
  });
  order.status = 'paid';
  order.paymentReference = reference;
  order.paidAt = new Date();
  order.trackingEvents = [
    ...(order.trackingEvents || []),
    { status: 'paid', note: 'Paid from wallet' },
  ];
  await order.save();
  await decrementProviderStock({ providerId: order.provider, items: order.items });

  await notifyUser({
    userId: order.providerOwnerUser,
    type: 'order',
    title: 'Order paid',
    body: `An order was paid: ₦${Number(order.totalAmount || 0).toLocaleString()}.`,
    data: { type: 'order', orderId: String(order._id) },
    push: true,
    email: true,
    emailSubject: 'MedMap order paid',
  });

  return { order: order.toObject(), payment: { method: 'wallet', reference } };
}

async function listAsBuyer(userId) {
  return Order.find({ buyerUser: userId })
    .sort({ createdAt: -1 })
    .populate('provider', 'name providerType city phone')
    .lean();
}

async function listAsSeller(ownerUserId) {
  return Order.find({ providerOwnerUser: ownerUserId })
    .sort({ createdAt: -1 })
    .populate('buyerUser', 'fullName phone')
    .populate('provider', 'name providerType')
    .lean();
}

async function getOneForUser(orderId, userId) {
  const order = await Order.findById(orderId)
    .populate('provider', 'name providerType city phone')
    .populate('buyerUser', 'fullName phone email')
    .lean();

  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
  const uid = String(userId);
  const buyerId =
    order.buyerUser && typeof order.buyerUser === 'object' && order.buyerUser._id
      ? String(order.buyerUser._id)
      : String(order.buyerUser);
  if (buyerId !== uid && String(order.providerOwnerUser) !== uid) {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }
  return order;
}

async function cancelByBuyer(userId, orderId) {
  const order = await Order.findById(orderId);
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
  if (String(order.buyerUser) !== String(userId)) throw Object.assign(new Error('Forbidden'), { status: 403 });
  if (order.status !== 'pending_payment') {
    throw Object.assign(new Error('Only unpaid orders can be cancelled'), { status: 400 });
  }
  order.status = 'cancelled';
  order.trackingEvents = [
    ...(order.trackingEvents || []),
    { status: 'cancelled', note: 'Cancelled by buyer' },
  ];
  await order.save();

  await notifyUser({
    userId: order.providerOwnerUser,
    type: 'order',
    title: 'Order cancelled',
    body: 'A buyer cancelled an unpaid order.',
    data: { type: 'order', orderId: String(order._id) },
    push: true,
    email: false,
  });
  return order.toObject();
}

async function markFulfilled(ownerUserId, orderId) {
  const order = await Order.findById(orderId);
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
  if (String(order.providerOwnerUser) !== String(ownerUserId)) {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }
  if (order.status !== 'paid') {
    throw Object.assign(new Error('Only paid orders can be marked fulfilled'), { status: 400 });
  }
  order.status = 'fulfilled';
  order.trackingEvents = [
    ...(order.trackingEvents || []),
    { status: 'fulfilled', note: 'Marked fulfilled by seller' },
  ];
  await order.save();

  const total = Number(order.totalAmount) || 0;
  if (order.paymentReference && total > 0) {
    await walletService.settleProviderEarnings({
      providerUserId: order.providerOwnerUser,
      grossAmount: total,
      patientPaymentReference: order.paymentReference,
      meta: { kind: 'order', orderId: String(order._id) },
    });
  }

  await notifyUser({
    userId: order.buyerUser,
    type: 'order',
    title: 'Order fulfilled',
    body: 'Your order has been fulfilled.',
    data: { type: 'order', orderId: String(order._id) },
    push: true,
    email: true,
    emailSubject: 'Your MedMap order is fulfilled',
  });

  return order.toObject();
}

async function updateStatusBySeller(ownerUserId, orderId, { status, note } = {}) {
  const order = await Order.findById(orderId);
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
  if (String(order.providerOwnerUser) !== String(ownerUserId)) {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }
  const next = String(status || '').trim();
  const allowed = new Set(['processing', 'ready_for_pickup', 'out_for_delivery', 'fulfilled']);
  if (!allowed.has(next)) {
    throw Object.assign(new Error('Invalid status'), {
      status: 400,
      details: { allowed: Array.from(allowed) },
    });
  }
  if (order.status === 'cancelled') {
    throw Object.assign(new Error('Cancelled orders cannot be updated'), { status: 400 });
  }
  if (order.status === 'pending_payment') {
    throw Object.assign(new Error('Unpaid orders cannot be updated'), { status: 400 });
  }
  // Basic forward-only progression.
  const rank = {
    paid: 1,
    processing: 2,
    ready_for_pickup: 3,
    out_for_delivery: 3,
    fulfilled: 4,
  };
  const cur = rank[order.status] || 0;
  const nxt = rank[next] || 0;
  if (nxt < cur) {
    throw Object.assign(new Error('Status cannot move backwards'), { status: 400 });
  }

  if (next === 'fulfilled') {
    return markFulfilled(ownerUserId, orderId);
  }

  order.status = next;
  order.trackingEvents = [
    ...(order.trackingEvents || []),
    { status: next, note: note ? String(note).slice(0, 500) : undefined },
  ];
  await order.save();

  await notifyUser({
    userId: order.buyerUser,
    type: 'order',
    title: 'Order update',
    body:
      next === 'out_for_delivery'
        ? 'Your order is out for delivery.'
        : next === 'ready_for_pickup'
          ? 'Your order is ready for pickup.'
          : 'Your order is being processed.',
    data: { type: 'order', orderId: String(order._id), status: next },
    push: true,
    email: false,
  });

  return order.toObject();
}

module.exports = {
  uploadPrescription,
  createOrder,
  completeOrderPayment,
  listAsBuyer,
  listAsSeller,
  getOneForUser,
  cancelByBuyer,
  markFulfilled,
  updateStatusBySeller,
};
