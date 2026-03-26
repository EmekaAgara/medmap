import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'medmap_cart_v1';

async function readRaw() {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return { items: [] };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.items)) return parsed;
  } catch {
    /* ignore */
  }
  return { items: [] };
}

async function writeRaw(data) {
  await AsyncStorage.setItem(KEY, JSON.stringify(data));
}

export async function getCart() {
  return readRaw();
}

export async function clearCart() {
  await writeRaw({ items: [] });
}

export async function addToCart({ providerId, name, unitPrice, quantity = 1 }) {
  const cart = await readRaw();
  const pid = String(providerId || '').trim();
  const n = String(name || '').trim();
  if (!pid || !n) return cart;
  const qty = Math.max(1, parseInt(quantity, 10) || 1);
  const price = Math.max(0, Number(unitPrice) || 0);

  const items = [...(cart.items || [])];
  const idx = items.findIndex((it) => String(it.providerId) === pid && String(it.name).toLowerCase() === n.toLowerCase());
  if (idx >= 0) {
    items[idx] = { ...items[idx], quantity: Math.min(99, (Number(items[idx].quantity) || 1) + qty) };
  } else {
    items.push({ providerId: pid, name: n, unitPrice: price, quantity: qty });
  }
  const next = { items, updatedAt: Date.now() };
  await writeRaw(next);
  return next;
}

export async function updateCartItem({ providerId, name, quantity }) {
  const cart = await readRaw();
  const pid = String(providerId || '').trim();
  const n = String(name || '').trim();
  const qty = Math.max(0, parseInt(quantity, 10) || 0);

  const items = (cart.items || [])
    .map((it) => ({ ...it }))
    .filter((it) => !(String(it.providerId) === pid && String(it.name).toLowerCase() === n.toLowerCase() && qty === 0))
    .map((it) => {
      if (String(it.providerId) === pid && String(it.name).toLowerCase() === n.toLowerCase()) {
        return { ...it, quantity: Math.min(99, qty) };
      }
      return it;
    });

  const next = { items, updatedAt: Date.now() };
  await writeRaw(next);
  return next;
}

