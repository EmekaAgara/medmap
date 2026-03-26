import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { View, Text, TouchableOpacity, ActivityIndicator, Switch, Alert, TextInput } from 'react-native';
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useAuth, useThemeMode } from '../../../_layout';
import { apiRequest } from '../../../../src/api/client';
import { ui, spacing, radii } from '../../../../theme/tokens';
import { Ionicons } from '@expo/vector-icons';
import { hapticTap, hapticToggle } from '../../../../src/utils/haptics';

const providerTypes = [
  { value: '', label: 'All' },
  { value: 'doctor', label: 'Doctors' },
  { value: 'pharmacy', label: 'Pharmacies' },
  { value: 'hospital', label: 'Hospitals' },
];

const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1f2937' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#d1d5db' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#111827' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#374151' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1f2937' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#e5e7eb' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
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
  const [filterOpen, setFilterOpen] = useState(false);

  const etaFromKm = (km) => {
    const n = Number(km);
    if (!Number.isFinite(n)) return null;
    return Math.max(1, Math.round(n * 2));
  };

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
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={styles.container(theme)}>
        {loading ? <ActivityIndicator color={theme.primary} style={styles.loadingOverlay} /> : null}
        {error ? <Text style={ui.errorText(theme)}>{error}</Text> : null}

        <MapView
          style={styles.map(theme)}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={initialRegion}
          customMapStyle={theme.mode === 'dark' ? DARK_MAP_STYLE : []}
          userInterfaceStyle={theme.mode === 'dark' ? 'dark' : 'light'}
        >
          {userCoords ? (
            <Marker coordinate={userCoords} title="You" pinColor={theme.primary} />
          ) : null}
          {providers.map((p) => {
            const km = p.distanceKm != null ? Number(p.distanceKm) : null;
            const eta = etaFromKm(km);
            const metaLine = [
              p.providerType || '',
              p.city || '',
              Number.isFinite(km) ? `${km}km` : '',
              Number.isFinite(eta) ? `ETA ${eta}m` : '',
            ]
              .filter(Boolean)
              .join(' • ');
            return (
              <Marker
                key={p._id}
                coordinate={{
                  latitude: p.location?.coordinates?.[1] ?? 0,
                  longitude: p.location?.coordinates?.[0] ?? 0,
                }}
                onPress={() => {
                  hapticTap();
                }}
              >
                <Callout
                  tooltip
                  onPress={() => {
                    hapticTap();
                    router.push({
                      pathname: '/(app)/provider-details/[id]',
                      params: { id: String(p._id) },
                    });
                  }}
                >
                  <View style={[styles.calloutCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <Text style={[styles.calloutTitle, { color: theme.text }]}>{p.name}</Text>
                    <Text style={[styles.calloutMeta, { color: theme.subtleText }]}>{metaLine || 'Provider'}</Text>
                  </View>
                </Callout>
              </Marker>
            );
          })}
        </MapView>

        <View style={[styles.topOverlay, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.topRow}>
            <TouchableOpacity
              style={[styles.backBtn, { borderColor: theme.border, backgroundColor: theme.secondary }]}
              onPress={() => {
                hapticTap();
                router.back();
              }}
              hitSlop={10}
            >
              <Ionicons name="chevron-back" size={22} color={theme.text} />
            </TouchableOpacity>
            <View style={styles.brandRow}>
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
          <View style={styles.rowBetween}>
            <Text style={{ color: theme.text }}>Open now only</Text>
            <View style={styles.filterWrap}>
              <TouchableOpacity
                style={[styles.filterDropdownBtn, { borderColor: theme.border, backgroundColor: theme.secondary }]}
                onPress={() => {
                  hapticTap();
                  setFilterOpen((v) => !v);
                }}
                activeOpacity={0.9}
              >
                <Text style={{ color: theme.text, fontSize: 12 }}>
                  {providerTypes.find((p) => p.value === type)?.label || 'All'}
                </Text>
                <Ionicons
                  name={filterOpen ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={theme.subtleText}
                />
              </TouchableOpacity>
              {filterOpen ? (
                <View style={[styles.filterMenu, { borderColor: theme.border, backgroundColor: theme.card }]}>
                  {providerTypes.map((item) => {
                    const active = type === item.value;
                    return (
                      <TouchableOpacity
                        key={item.value || 'all'}
                        onPress={() => {
                          hapticTap();
                          setType(item.value);
                          setFilterOpen(false);
                        }}
                        style={[styles.filterMenuItem, active ? { backgroundColor: theme.primary + '12' } : null]}
                      >
                        <Text style={{ color: active ? theme.text : theme.subtleText, fontWeight: active ? '700' : '500' }}>
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}
            </View>
            <Switch
              value={openNowOnly}
              onValueChange={(v) => {
                hapticToggle();
                setOpenNowOnly(v);
              }}
              trackColor={{ false: theme.border, true: theme.primary + '88' }}
              thumbColor={openNowOnly ? theme.primary : theme.subtleText}
            />
          </View>

        </View>
      </View>
    </View>
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
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  topOverlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? spacing['3xl'] + spacing.md : spacing['3xl'],
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 10,
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  topRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginLeft: spacing.sm, justifyContent: 'center' },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderRadius: radii.pill,
  },
  searchBar: {
    height: 48,
    paddingVertical: 10,
  },
  filterDropdownBtn: {
    marginLeft: 'auto',
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minWidth: 108,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  filterWrap: {
    marginLeft: 'auto',
    position: 'relative',
  },
  filterMenu: {
    position: 'absolute',
    top: 44,
    right: 0,
    width: 160,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.xs,
    zIndex: 30,
  },
  filterMenuItem: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
  },
  calloutCard: {
    minWidth: 200,
    maxWidth: 260,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  calloutTitle: { fontWeight: '700', fontSize: 13 },
  calloutMeta: { fontSize: 11 },
};

