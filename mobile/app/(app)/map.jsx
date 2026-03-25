import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Switch, Linking, ScrollView } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useAuth, useThemeMode } from '../_layout';
import ScreenHeader from '../components/ScreenHeader';
import { apiRequest } from '../../src/api/client';
import { ui, spacing } from '../../theme/tokens';

const RADIUS_OPTIONS = [5, 10, 25, 50];

export default function MapScreen() {
  const { token } = useAuth();
  const { theme } = useThemeMode();
  const router = useRouter();

  const [type, setType] = useState('');
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [radiusKm, setRadiusKm] = useState(10);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userCoords, setUserCoords] = useState(null);

  const providerTypes = useMemo(
    () => [
      { value: '', label: 'All' },
      { value: 'doctor', label: 'Doctors' },
      { value: 'pharmacy', label: 'Pharmacies' },
      { value: 'hospital', label: 'Hospitals' },
    ],
    []
  );

  const fetchProviders = useCallback(
    async () => {
      try {
        setLoading(true);
        setError('');
        const params = new URLSearchParams();
        params.set('limit', '35');
        if (type) params.set('type', type);
        if (openNowOnly) params.set('openNow', 'true');
        if (userCoords) {
          params.set('latitude', String(userCoords.latitude));
          params.set('longitude', String(userCoords.longitude));
          params.set('radiusKm', String(radiusKm));
        }
        const res = await apiRequest(`/providers?${params.toString()}`, { method: 'GET', token });
        setProviders(res.data || []);
      } catch (e) {
        setError(e.message || 'Could not load providers');
      } finally {
        setLoading(false);
      }
    },
    [token, type, openNowOnly, userCoords, radiusKm]
  );

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setUserCoords(null);
          setError('Location permission denied');
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

  useEffect(() => {
    // When toggling filters without changing coords.
    if (userCoords) fetchProviders();
  }, [type, openNowOnly, radiusKm]);

  const initialRegion = userCoords
    ? { latitude: userCoords.latitude, longitude: userCoords.longitude, latitudeDelta: 0.12, longitudeDelta: 0.12 }
    : { latitude: 6.5244, longitude: 3.3792, latitudeDelta: 0.4, longitudeDelta: 0.4 };

  return (
    <View style={ui.screen(theme)} >
      <ScreenHeader title="Map" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ paddingBottom: spacing['2xl'] }}>
        <View style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
            <Text style={{ color: theme.text }}>Open now only</Text>
            <Switch
              value={openNowOnly}
              onValueChange={setOpenNowOnly}
              trackColor={{ false: theme.border, true: theme.primary + '88' }}
              thumbColor={openNowOnly ? theme.primary : theme.subtleText}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {providerTypes.map((item) => {
              const active = type === item.value;
              return (
                <TouchableOpacity
                  key={item.value || 'all'}
                  onPress={() => setType(item.value)}
                  style={{
                    borderWidth: 1,
                    borderRadius: 999,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.xs,
                    borderColor: active ? theme.primary : theme.border,
                    backgroundColor: active ? theme.primary + '22' : 'transparent',
                  }}
                >
                  <Text style={{ color: active ? theme.text : theme.subtleText }}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, marginTop: spacing.sm }}>
            {RADIUS_OPTIONS.map((km) => {
              const active = radiusKm === km;
              return (
                <TouchableOpacity
                  key={km}
                  onPress={() => setRadiusKm(km)}
                  style={{
                    borderWidth: 1,
                    borderRadius: 999,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.xs,
                    borderColor: active ? theme.primary : theme.border,
                    backgroundColor: active ? theme.primary + '22' : 'transparent',
                  }}
                >
                  <Text style={{ color: active ? theme.text : theme.subtleText }}>{km} km</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {loading ? <ActivityIndicator color={theme.primary} style={{ marginTop: spacing.md }} /> : null}
        {error ? <Text style={ui.errorText(theme)}>{error}</Text> : null}

        <View style={{ height: 420, borderRadius: 12, overflow: 'hidden', marginBottom: spacing.md, borderWidth: 1, borderColor: theme.border }}>
          <MapView style={{ flex: 1 }} initialRegion={initialRegion}>
            {userCoords ? <Marker coordinate={userCoords} title="You" pinColor={theme.primary} /> : null}
            {providers.map((p) => (
              <Marker
                key={p._id}
                coordinate={{
                  latitude: p.location?.coordinates?.[1] ?? 0,
                  longitude: p.location?.coordinates?.[0] ?? 0,
                }}
                title={p.name}
                description={`${p.providerType} • ${p.city || ''}`}
              />
            ))}
          </MapView>
        </View>

        <TouchableOpacity style={[ui.buttonOutline(theme), { marginBottom: spacing['2xl'] }]} onPress={() => router.push('/(tabs)/home')}>
          <Text style={ui.buttonText(theme)}>Back to Home</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

