import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

export function useThemeMode() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }) {
  // Default to dark; respect stored preference
  const [mode, setMode] = useState(() => {
    const stored = window.localStorage.getItem('medmap_admin_theme');
    return stored === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (mode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    window.localStorage.setItem('medmap_admin_theme', mode);
  }, [mode]);

  const toggleTheme = () => setMode((prev) => (prev === 'light' ? 'dark' : 'light'));

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
