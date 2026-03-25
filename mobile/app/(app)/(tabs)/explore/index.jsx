import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Switch, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useAuth, useThemeMode } from '../../../_layout';
import { apiRequest } from '../../../../src/api/client';
import { ui, spacing } from '../../../../theme/tokens';
import { Ionicons } from '@expo/vector-icons';

const providerTypes = [
  { value: '', label: 'All' },
  { value: 'doctor', label: 'Doctors' },
  { value: 'pharmacy', label: 'Pharmacies' },
  { value: 'hospital', label: 'Hospitals' },
];

export default function ExploreScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { theme } = useThemeMode();

  const [type, setType] = useState('');
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userCoords, setUserCoords] = useState(null);
  const [radiusKm] = useState(50000);

  const fetchProviders = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      if (!userCoords) return;

      const params = new URLSearchParams();
      params.set('limit', '300');
      params.set('latitude', String(userCoords.latitude));
      params.set('longitude', String(userCoords.longitude));
      params.set('radiusKm', String(radiusKm));
      if (type) params.set('type', type);
      if (openNowOnly) params.set('openNow', 'true');
      if (searchText.trim()) params.set('search', searchText.trim());

      const res = await apiRequest(`/providers?${params.toString()}`, { method: 'GET', token });
      setProviders(res.data || []);
    } catch (e) {
      setError(e.message || 'Could not load providers');
    } finally {
      setLoading(false);
    }
  }, [token, userCoords, type, openNowOnly, radiusKm, searchText]);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Location', 'Location permission denied.');
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      } catch (e) {
        setError(e.message || 'Location error');
      }
    })();
  }, []);

  useEffect(() => {
    if (userCoords) fetchProviders();
  }, [userCoords, fetchProviders]);

  const initialRegion = useMemo(() => {
    if (userCoords) {
      return {
        latitude: userCoords.latitude,
        longitude: userCoords.longitude,
        latitudeDelta: 0.12,
        longitudeDelta: 0.12,
      };
    }
    return { latitude: 6.5244, longitude: 3.3792, latitudeDelta: 0.4, longitudeDelta: 0.4 };
  }, [userCoords]);

  return (
    <SafeAreaView style={ui.screen(theme)} edges={['top']}>
      <View style={styles.container(theme)}>
        {loading ? <ActivityIndicator color={theme.primary} style={styles.loadingOverlay} /> : null}
        {error ? <Text style={ui.errorText(theme)}>{error}</Text> : null}

        <MapView style={styles.map(theme)} initialRegion={initialRegion}>
          {userCoords ? (
            <Marker coordinate={userCoords} title="You" pinColor={theme.primary} />
          ) : null}
          {providers.map((p) => (
            <Marker
              key={p._id}
              coordinate={{
                latitude: p.location?.coordinates?.[1] ?? 0,
                longitude: p.location?.coordinates?.[0] ?? 0,
              }}
              title={p.name}
              description={`${p.providerType} • ${p.city || ''}`}
              onPress={() => {
                router.push({
                  pathname: '/(app)/provider-details/[id]',
                  params: { id: String(p._id) },
                });
              }}
            />
          ))}
        </MapView>

        <View style={[styles.topOverlay, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.topRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={10}>
              <Ionicons name="chevron-back" size={22} color={theme.text} />
            </TouchableOpacity>
            <View style={styles.brandRow}>
              <View style={[styles.brandIconWrap, { borderColor: theme.border }]}>
                <Ionicons name="medkit-outline" size={18} color={theme.primary} />
              </View>
              <Text style={[ui.h2(theme), { fontSize: 18, fontWeight: '800' }]}>MedMap</Text>
            </View>
          </View>
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search providers"
            placeholderTextColor={theme.subtleText}
            style={[ui.input(theme), styles.searchBar]}
          />
        </View>

        <View style={[styles.controlsOverlay, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.rowBetween}>
            <Text style={{ color: theme.text }}>Open now only</Text>
            <Switch
              value={openNowOnly}
              onValueChange={(v) => setOpenNowOnly(v)}
              trackColor={{ false: theme.border, true: theme.primary + '88' }}
              thumbColor={openNowOnly ? theme.primary : theme.subtleText}
            />
          </View>

          <View style={styles.typeRow}>
            {providerTypes.map((item) => {
              const active = type === item.value;
              return (
                <TouchableOpacity
                  key={item.value || 'all'}
                  onPress={() => setType(item.value)}
                  style={[
                    styles.typeChip,
                    {
                      borderColor: active ? theme.primary : theme.border,
                      backgroundColor: active ? theme.primary + '22' : 'transparent',
                    },
                  ]}
                >
                  <Text style={{ color: active ? theme.text : theme.subtleText }}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = {
  container: (theme) => ({
    flex: 1,
    borderRadius: 0,
  }),
  map: (theme) => ({
    flex: 1,
  }),
  loadingOverlay: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
  },
  controlsOverlay: {
    position: 'absolute',
    top: 120,
    left: spacing.lg,
    right: spacing.lg,
    borderWidth: 1,
    borderRadius: 16,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  typeChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  topOverlay: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 10,
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  topRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginLeft: spacing.sm },
  brandIconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  searchBar: {
    height: 44,
    paddingVertical: 10,
  },
};

