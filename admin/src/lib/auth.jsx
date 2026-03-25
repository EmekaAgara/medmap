import { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest } from './api';

const AuthContext = createContext(null);

export function useAdminAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [admin, setAdmin]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('medmap_admin_token');
    const storedUser = localStorage.getItem('medmap_admin_user');
    if (stored && storedUser) {
      try { setAdmin(JSON.parse(storedUser)); } catch { /* ignore */ }
    }
    setLoading(false);
  }, []);

  const login = async ({ emailOrPhone, password }) => {
    setError('');
    try {
      const res = await apiRequest('/auth/login', {
        method: 'POST',
        body: { emailOrPhone, password },
      });
      const { accessToken, refreshToken, deviceId, user } = res.data;
      if (!user?.roles?.includes('admin')) {
        setError('Access denied. Admin account required.');
        return false;
      }
      localStorage.setItem('medmap_admin_token', accessToken);
      localStorage.setItem('medmap_admin_refresh_token', refreshToken);
      localStorage.setItem('medmap_admin_device_id', deviceId);
      localStorage.setItem('medmap_admin_user', JSON.stringify(user));
      setAdmin(user);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('medmap_admin_token');
    localStorage.removeItem('medmap_admin_refresh_token');
    localStorage.removeItem('medmap_admin_device_id');
    localStorage.removeItem('medmap_admin_user');
    setAdmin(null);
  };

  return (
    <AuthContext.Provider value={{ admin, loading, error, setError, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
