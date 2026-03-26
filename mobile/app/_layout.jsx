import { useEffect, useState, createContext, useContext } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator, StyleSheet, Appearance, DeviceEventEmitter } from 'react-native';
import {
  useFonts,
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
} from '@expo-google-fonts/montserrat';
import { lightTheme, darkTheme, typography, spacing } from '../theme/tokens';
import {
  apiRequest,
  saveAuthSession,
  clearAuthSession,
  MEDMAP_AUTH_REFRESH_EVENT,
} from '../src/api/client';
import { registerPushAndSync } from '../src/notifications/registerPush';

const AuthContext = createContext(null);
const ThemeContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export function useThemeMode() {
  return useContext(ThemeContext);
}

function SplashScreen() {
  return (
    <View style={[styles.splashContainer, { backgroundColor: lightTheme.background }]}>
      <Text style={[styles.splashTitle, { color: lightTheme.text, fontFamily: typography.fontFamilyBold }]}>
        MedMap
      </Text>
      <Text style={[styles.splashSubtitle, { color: lightTheme.subtleText, fontFamily: typography.fontFamilyRegular }]}>
        Find nearby doctors, pharmacies, and hospitals fast.
      </Text>
      <ActivityIndicator size="small" color={lightTheme.primary} style={{ marginTop: spacing.lg }} />
    </View>
  );
}

function ThemeProvider({ children }) {
  const [mode, setMode] = useState('dark');
  const [ready, setReady] = useState(false);
  const [fontsLoaded] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
  });

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('medmap_theme_mode');
        if (stored === 'light' || stored === 'dark') {
          setMode(stored);
        } else {
          // Default to dark mode on first launch
          setMode('dark');
        }
      } catch {
        setMode('dark');
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const toggleTheme = async () => {
    const next = mode === 'light' ? 'dark' : 'light';
    setMode(next);
    await AsyncStorage.setItem('medmap_theme_mode', next);
  };

  const theme = mode === 'light' ? lightTheme : darkTheme;

  const value = {
    mode,
    theme,
    typography,
    toggleTheme,
  };

  if (!fontsLoaded || !ready) {
    return null;
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function AuthProvider({ children }) {
  const [auth, setAuth] = useState({ token: null, refreshToken: null, deviceId: null, user: null });
  const [isLoading, setIsLoading] = useState(true);
  const [hasSentToOnboarding, setHasSentToOnboarding] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('medmap_auth');
        if (stored) {
          const parsed = JSON.parse(stored);
          setAuth({
            token: parsed.token || null,
            refreshToken: parsed.refreshToken || null,
            deviceId: parsed.deviceId || null,
            user: parsed.user || null,
          });
        }
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    const inAppGroup = segments[0] === '(app)';
    const inPublic = segments[0] === '(public)';
    const publicScreen = segments[1];
    if (auth.token && !inAppGroup) {
      router.replace('/(app)/home');
    } else if (!auth.token && inAppGroup) {
      router.replace('/onboarding');
    } else if (!auth.token && inPublic && publicScreen !== 'onboarding' && !hasSentToOnboarding) {
      setHasSentToOnboarding(true);
      router.replace('/onboarding');
    }
  }, [segments, auth.token, isLoading, hasSentToOnboarding, router]);

  useEffect(() => {
    if (!auth.token) return;
    registerPushAndSync(auth.token).catch(() => {});
  }, [auth.token]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(MEDMAP_AUTH_REFRESH_EVENT, (payload) => {
      setAuth((prev) => ({
        ...prev,
        token: payload.accessToken,
        refreshToken: payload.refreshToken ?? prev.refreshToken,
        deviceId: payload.deviceId ?? prev.deviceId,
      }));
    });
    return () => sub.remove();
  }, []);

  const signIn = async (payload) => {
    const next = {
      token: payload.accessToken,
      refreshToken: payload.refreshToken || null,
      deviceId: payload.deviceId || null,
      user: payload.user || null,
    };
    setAuth(next);
    await AsyncStorage.setItem('medmap_auth', JSON.stringify(next));
    await saveAuthSession({
      accessToken: next.token,
      refreshToken: next.refreshToken,
      deviceId: next.deviceId,
    });
  };

  const updateUser = async (updatedUser) => {
    const next = { ...auth, user: { ...auth.user, ...updatedUser } };
    setAuth(next);
    await AsyncStorage.setItem('medmap_auth', JSON.stringify(next));
  };

  const signOut = async () => {
    try {
      if (auth.token) {
        await apiRequest('/auth/logout', { method: 'POST', token: auth.token });
      }
    } catch {
      // ignore logout errors on client
    }
    setAuth({ token: null, refreshToken: null, deviceId: null, user: null });
    await AsyncStorage.removeItem('medmap_auth');
    await clearAuthSession();
    router.replace('/onboarding');
  };

  const value = {
    token: auth.token,
    refreshToken: auth.refreshToken,
    deviceId: auth.deviceId,
    user: auth.user,
    signIn,
    signOut,
    updateUser,
    isLoading,
  };

  if (isLoading) {
    return (
      <AuthContext.Provider value={value}>
        <SplashScreen />
      </AuthContext.Provider>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ThemedRoot />
      </AuthProvider>
    </ThemeProvider>
  );
}

function ThemedRoot() {
  return (
    <>
      <StatusBar hidden />
      <Slot />
    </>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  splashTitle: {
    fontSize: 32,
  },
  splashSubtitle: {
    marginTop: spacing.sm,
    fontSize: 14,
  },
});

