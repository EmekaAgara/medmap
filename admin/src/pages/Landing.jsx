import { Link } from 'react-router-dom';
import { useAdminAuth } from '../lib/auth';
import { useThemeMode } from '../ThemeProvider';
import {
  FiSun, FiMoon, FiGrid, FiUsers, FiShield,
  FiActivity, FiArrowRight, FiLock,
} from 'react-icons/fi';

const FEATURES = [
  {
    icon: FiGrid,
    title: 'Dashboard Overview',
    desc: 'Real-time platform metrics — user growth, KYC status, wallet balances, and loan data at a glance.',
  },
  {
    icon: FiUsers,
    title: 'User Management',
    desc: 'Search, filter, and view every user. Review profiles, ban or unban accounts with a single action.',
  },
  {
    icon: FiShield,
    title: 'KYC Verification',
    desc: 'Review identity documents, BVN, selfies, and bank accounts. Approve or reject with a reason.',
  },
  {
    icon: FiActivity,
    title: 'Activity Monitoring',
    desc: 'Audit login events across the platform. Track IPs, devices, and flag suspicious activity.',
  },
];

export default function LandingPage() {
  const { admin } = useAdminAuth();
  const { mode, toggleTheme } = useThemeMode();

  return (
    <div className="min-h-screen bg-nm-bg text-nm-text font-sans flex flex-col">

      {/* ── Navbar ── */}
      <nav className="h-14 border-b border-nm-border px-6 flex items-center justify-between sticky top-0 z-10 bg-nm-bg/90 backdrop-blur-sm">
        <div className="flex items-baseline gap-1.5">
          <span className="text-base font-bold tracking-tight text-nm-text">MedMap</span>
          <span className="text-xs text-nm-muted font-medium">Admin</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="w-8 h-8 flex items-center justify-center rounded-token border border-nm-border text-nm-muted hover:text-nm-text hover:bg-nm-secondary transition-colors"
            aria-label="Toggle theme"
          >
            {mode === 'dark' ? <FiSun size={14} /> : <FiMoon size={14} />}
          </button>

          {/* CTA */}
          {admin ? (
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 h-8 px-4 rounded-token bg-nm-primary text-nm-pfg text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              Dashboard <FiArrowRight size={12} />
            </Link>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 h-8 px-4 rounded-token bg-nm-primary text-nm-pfg text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              Sign in <FiArrowRight size={12} />
            </Link>
          )}
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="flex flex-col items-center justify-center px-6 pt-24 pb-20 text-center">
        {/* Security badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gold/30 bg-gold/10 text-gold text-xs font-medium mb-8">
          <FiLock size={11} />
          Secure Admin Portal
        </div>

        {/* Main heading */}
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-5 max-w-2xl leading-tight">
          MedMap <span className="text-gold">Admin</span> Portal
        </h1>

        {/* Subheading */}
        <p className="text-nm-muted text-lg max-w-xl mb-10 leading-relaxed">
          Manage users, review KYC submissions, monitor platform activity,
          and keep your fintech app running smoothly — all in one place.
        </p>

        {/* CTA button */}
        {admin ? (
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 h-12 px-8 rounded-token bg-nm-primary text-nm-pfg text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Go to Dashboard <FiArrowRight size={15} />
          </Link>
        ) : (
          <Link
            to="/login"
            className="inline-flex items-center gap-2 h-12 px-8 rounded-token bg-nm-primary text-nm-pfg text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Sign in to Admin <FiArrowRight size={15} />
          </Link>
        )}
      </section>

      {/* ── Divider ── */}
      <div className="max-w-5xl mx-auto w-full px-6">
        <div className="border-t border-nm-border" />
      </div>

      {/* ── Features ── */}
      <section className="px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-semibold text-nm-muted uppercase tracking-widest text-center mb-10">
            What you can do
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="bg-nm-card border border-nm-border rounded-xl p-5 hover:border-gold/40 transition-colors group"
              >
                <div className="w-9 h-9 rounded-token bg-gold/10 border border-gold/20 flex items-center justify-center mb-4 group-hover:bg-gold/20 transition-colors">
                  <Icon size={16} className="text-gold" />
                </div>
                <h3 className="text-sm font-semibold text-nm-text mb-2">{title}</h3>
                <p className="text-xs text-nm-muted leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats strip ── */}
      <section className="px-6 pb-20">
        <div className="max-w-5xl mx-auto">
          <div className="bg-nm-card border border-nm-border rounded-xl p-8 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { label: 'Users managed',      value: 'All' },
              { label: 'KYC reviewed',        value: 'Real-time' },
              { label: 'Activity logged',     value: '90 days' },
              { label: 'Role-protected',      value: 'Admin only' },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-2xl font-bold text-gold mb-1">{value}</p>
                <p className="text-xs text-nm-muted">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="mt-auto h-14 border-t border-nm-border px-6 flex items-center justify-between">
        <span className="text-xs text-nm-muted">
          © {new Date().getFullYear()} MedMap. All rights reserved.
        </span>
        <span className="text-xs text-nm-muted">Admin Portal v1.0</span>
      </footer>
    </div>
  );
}
