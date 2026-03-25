import { NavLink, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../lib/auth';
import { useThemeMode } from '../ThemeProvider';
import { FiGrid, FiUsers, FiShield, FiActivity, FiMapPin, FiUserCheck, FiSun, FiMoon, FiLogOut } from 'react-icons/fi';

const NAV = [
  { to: '/dashboard', icon: FiGrid,     label: 'Dashboard' },
  { to: '/users',     icon: FiUsers,    label: 'Users' },
  { to: '/account-type-requests', icon: FiUserCheck, label: 'Type Requests' },
  { to: '/kyc',       icon: FiShield,   label: 'KYC Queue' },
  { to: '/providers', icon: FiMapPin,   label: 'Providers' },
  { to: '/activity',  icon: FiActivity, label: 'Activity' },
];

export default function DashboardLayout({ children }) {
  const { admin, logout } = useAdminAuth();
  const { mode, toggleTheme } = useThemeMode();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="min-h-screen flex bg-nm-bg font-sans">

      {/* ── Sidebar ── */}
      <aside className="w-60 bg-nm-card border-r border-nm-border flex flex-col shrink-0">

        {/* Logo */}
        <div className="h-14 px-5 flex items-center border-b border-nm-border">
          <span className="text-base font-bold tracking-tight text-nm-text">MedMap</span>
          <span className="ml-1.5 text-xs text-nm-muted font-medium">Admin</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/dashboard'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-token text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-nm-secondary text-gold border border-gold/20'
                    : 'text-nm-muted hover:bg-nm-secondary hover:text-nm-text'
                }`
              }
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Bottom bar: theme toggle, admin info, sign out */}
        <div className="px-4 py-4 border-t border-nm-border space-y-2">

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-token text-sm text-nm-muted hover:bg-nm-secondary hover:text-nm-text transition-colors"
          >
            {mode === 'dark' ? <FiSun size={14} /> : <FiMoon size={14} />}
            {mode === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>

          {/* Admin user */}
          <div className="flex items-center gap-2.5 px-3 py-2">
            <div className="w-7 h-7 rounded-full bg-nm-secondary border border-nm-border flex items-center justify-center text-xs font-bold text-nm-text shrink-0">
              {admin?.fullName?.[0] ?? 'A'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-nm-text truncate">{admin?.fullName ?? 'Admin'}</p>
              <p className="text-xs text-nm-muted truncate">{admin?.email ?? ''}</p>
            </div>
          </div>

          {/* Sign out */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-token text-xs text-nm-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
          >
            <FiLogOut size={13} />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 min-w-0 overflow-auto bg-nm-bg">
        <div className="max-w-7xl mx-auto px-6 py-6">{children}</div>
      </main>
    </div>
  );
}
