/** Align with API catalog shape: { name, price, description?, imageUrl? } */
export function normalizeCatalogProducts(raw) {
  if (!raw?.length) return [];
  return raw
    .map((p) => {
      if (typeof p === 'string') {
        const t = p.trim();
        return t ? { name: t, price: 0 } : null;
      }
      if (p && typeof p === 'object' && p.name != null) {
        const name = String(p.name).trim();
        if (!name) return null;
        const price = Math.max(0, Number(p.price) || 0);
        const stockQtyRaw = p.stockQty ?? p.stock ?? p.quantity;
        const stockQtyParsed = stockQtyRaw == null ? null : Math.floor(Number(stockQtyRaw));
        const stockQty =
          Number.isFinite(stockQtyParsed) && stockQtyParsed >= 0 ? stockQtyParsed : undefined;
        const description =
          p.description != null && String(p.description).trim()
            ? String(p.description).trim().slice(0, 2000)
            : undefined;
        const imageUrl =
          p.imageUrl != null && String(p.imageUrl).trim()
            ? String(p.imageUrl).trim()
            : undefined;
        return {
          name,
          price,
          stockQty,
          requiresPrescription: p.requiresPrescription != null ? !!p.requiresPrescription : undefined,
          isRestricted: p.isRestricted != null ? !!p.isRestricted : undefined,
          sku: p.sku != null ? String(p.sku).trim() : undefined,
          category: p.category != null ? String(p.category).trim() : undefined,
          description,
          imageUrl,
        };
      }
      return null;
    })
    .filter(Boolean);
}

export function productKey(p) {
  return `p:${encodeURIComponent(p.name)}:${p.price}`;
}
