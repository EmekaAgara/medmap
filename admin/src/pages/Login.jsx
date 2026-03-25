import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../lib/auth';
import { useThemeMode } from '../ThemeProvider';
import { FiSun, FiMoon, FiEye, FiEyeOff } from 'react-icons/fi';
import { ui } from '../theme';

export default function LoginPage() {
  const { login, error, setError } = useAdminAuth();
  const { mode, toggleTheme } = useThemeMode();
  const navigate = useNavigate();

  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword]         = useState('');
  const [showPass, setShowPass]         = useState(false);
  const [loading, setLoading]           = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const ok = await login({ emailOrPhone, password });
    setLoading(false);
    if (ok) navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-nm-bg flex flex-col">

      {/* Navbar */}
      <nav className="h-14 border-b border-nm-border px-6 flex items-center justify-between">
        <Link to="/" className="flex items-baseline gap-1.5">
          <span className="text-base font-bold text-nm-text">MedMap</span>
          <span className="text-xs text-nm-muted font-medium">Admin</span>
        </Link>
        <button
          onClick={toggleTheme}
          className="w-8 h-8 flex items-center justify-center rounded-token border border-nm-border text-nm-muted hover:text-nm-text hover:bg-nm-secondary transition-colors"
          aria-label="Toggle theme"
        >
          {mode === 'dark' ? <FiSun size={14} /> : <FiMoon size={14} />}
        </button>
      </nav>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[420px]">

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-nm-text mb-1.5">Sign in</h1>
            <p className="text-sm text-nm-muted">Access your admin dashboard.</p>
          </div>

          {error && (
            <div className={`mb-5 ${ui.errorBanner}`}>{error}</div>
          )}

          <form className="space-y-5" onSubmit={onSubmit}>
            <div>
              <label className={ui.label}>Email or phone</label>
              <input
                type="text"
                required
                autoFocus
                className={ui.input}
                value={emailOrPhone}
                onChange={(e) => setEmailOrPhone(e.target.value)}
                placeholder="admin@medmap.app"
              />
            </div>

            <div>
              <label className={ui.label}>Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  className={`${ui.input} pr-11`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-nm-muted hover:text-nm-text transition-colors"
                >
                  {showPass ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full ${ui.btnPrimary}`}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-nm-muted">
            <Link to="/" className="hover:text-gold transition-colors">
              ← Back to home
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
