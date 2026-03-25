/**
 * Shared Tailwind class utilities — mirror of the mobile app's token system.
 * All colors resolve via CSS variables defined in index.css, so they
 * switch automatically between light and dark mode.
 */

export const ui = {
  // ── Layout ───────────────────────────────────────────────────────────
  page:    'min-h-screen bg-nm-bg text-nm-text',
  card:    'bg-nm-card border border-nm-border rounded-xl shadow-sm',
  section: 'bg-nm-card border border-nm-border rounded-xl p-5',

  // ── Typography ───────────────────────────────────────────────────────
  h1:      'text-xl font-bold text-nm-text',
  h2:      'text-base font-semibold text-nm-text',
  h3:      'text-xs font-semibold text-nm-muted uppercase tracking-widest',
  body:    'text-sm text-nm-text',
  caption: 'text-xs text-nm-muted',

  // ── Form controls ────────────────────────────────────────────────────
  label:
    'block text-xs font-medium text-nm-muted mb-1.5',
  input:
    'w-full rounded-token border border-nm-border bg-nm-bg px-4 py-3 text-sm text-nm-text placeholder-nm-muted focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/50 transition-colors',
  select:
    'rounded-token border border-nm-border bg-nm-bg px-4 py-3 text-sm text-nm-text focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/50 transition-colors',
  textarea:
    'w-full rounded-token border border-nm-border bg-nm-bg px-4 py-3 text-sm text-nm-text placeholder-nm-muted focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/50 resize-none transition-colors',

  // ── Buttons ──────────────────────────────────────────────────────────
  btnPrimary:
    'inline-flex items-center justify-center h-[55px] px-6 rounded-token bg-nm-primary text-nm-pfg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity',
  btnGold:
    'inline-flex items-center justify-center h-[55px] px-6 rounded-token bg-gold text-black text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity',
  btnOutline:
    'inline-flex items-center justify-center h-[55px] px-6 rounded-token border border-nm-border text-nm-text text-sm font-medium hover:bg-nm-secondary disabled:opacity-50 transition-colors',

  btnSm:
    'inline-flex items-center justify-center px-4 py-2 rounded-token bg-nm-primary text-nm-pfg text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity',
  btnSmOutline:
    'inline-flex items-center justify-center px-4 py-2 rounded-token border border-nm-border text-nm-text text-xs font-medium hover:bg-nm-secondary disabled:opacity-50 transition-colors',
  btnSmDanger:
    'inline-flex items-center justify-center px-4 py-2 rounded-token bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors',
  btnSmSuccess:
    'inline-flex items-center justify-center px-4 py-2 rounded-token bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors',

  // ── Table ─────────────────────────────────────────────────────────────
  tableWrap: 'bg-nm-card border border-nm-border rounded-xl shadow-sm overflow-hidden',
  thead:     'bg-nm-surface border-b border-nm-border',
  th:        'text-left px-4 py-3 text-xs font-semibold text-nm-muted uppercase tracking-wide',
  tbody:     'divide-y divide-nm-border',
  tr:        'hover:bg-nm-surface transition-colors',
  td:        'px-4 py-3',

  // ── Banners ───────────────────────────────────────────────────────────
  errorBanner:
    'bg-red-500/10 border border-red-500/20 text-red-500 text-sm rounded-token px-4 py-3',
  successBanner:
    'bg-green-500/10 border border-green-500/20 text-green-500 text-sm rounded-token px-4 py-3',
  warnBanner:
    'bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-sm rounded-token px-4 py-3',

  // ── Divider ───────────────────────────────────────────────────────────
  divider: 'border-b border-nm-border',
};
