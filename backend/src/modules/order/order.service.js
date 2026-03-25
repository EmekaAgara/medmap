const Order = require('../../models/Order');
const Provider = require('../../models/Provider');
const walletService = require('../wallet/wallet.service');

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
      out.push({ name, price });
    }
  }
  return out;
}

async function createOrder(buyerUserId, { providerId, lines }) {
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

  for (const line of lines) {
    const name = String(line.name || '').trim();
    if (!name) continue;
    const qty = Math.max(1, parseInt(line.quantity, 10) || 1);
    const found = catalogByName.get(name.toLowerCase());
    if (!found) {
      throw Object.assign(new Error(`Product not listed: ${name}`), { status: 400 });
    }
    const unitPrice = found.price;
    total += unitPrice * qty;
    validatedItems.push({ name: found.name, unitPrice, quantity: qty });
  }

  if (!validatedItems.length) {
    throw Object.assign(new Error('No valid line items'), { status: 400 });
  }

  const order = await Order.create({
    buyerUser: buyerUserId,
    provider: provider._id,
    providerOwnerUser: provider.ownerUser,
    items: validatedItems,
    totalAmount: total,
    currency: 'NGN',
    status: total === 0 ? 'paid' : 'pending_payment',
    paidAt: total === 0 ? new Date() : undefined,
  });

  if (total === 0) {
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
    await order.save();
    return { order: order.toObject(), payment: { method: 'wallet', reference } };
  }

  const shortfall = total - balance;
  const fund = await walletService.initFundWallet(buyerUserId, shortfall);

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
    const fund = await walletService.initFundWallet(buyerUserId, shortfall);
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
  await order.save();

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
  await order.save();
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
  await order.save();
  return order.toObject();
}

module.exports = {
  createOrder,
  completeOrderPayment,
  listAsBuyer,
  listAsSeller,
  getOneForUser,
  cancelByBuyer,
  markFulfilled,
};
