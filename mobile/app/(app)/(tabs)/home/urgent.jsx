import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useThemeMode, useAuth } from '../../../_layout';
import { apiRequest } from '../../../../src/api/client';
import { ui, spacing } from '../../../../theme/tokens';
import ScreenHeader from '../../../components/ScreenHeader';
import { ShimmerBlock, ShimmerText } from '../../../components/Shimmer';

/**
 * Urgent care: open-now providers first, distance when location on, oversized call actions.
 */
export default function UrgentCareScreen() {
  const { theme } = useThemeMode();
  const { token } = useAuth();
  const router = useRouter();
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userCoords, setUserCoords] = useState(null);
  const radiusKmRef = useRef(25);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams();
      params.set('limit', '30');
      params.set('openNow', 'true');
      if (userCoords) {
        params.set('latitude', String(userCoords.latitude));
        params.set('longitude', String(userCoords.longitude));
        params.set('radiusKm', String(radiusKmRef.current));
      }
      const res = await apiRequest(`/providers?${params.toString()}`, {
        method: 'GET',
        token,
      });
      const list = res.data || [];
      const openFirst = [...list].sort((a, b) => {
        if (a.isOpenNow === b.isOpenNow) {
          const da = a.distanceKm ?? 9999;
          const db = b.distanceKm ?? 9999;
          return da - db;
        }
        return b.isOpenNow ? 1 : -1;
      });
      setProviders(openFirst);
    } catch (e) {
      setError(e.message || 'Could not load');
    } finally {
      setLoading(false);
    }
  }, [token, userCoords]);

  useEffect(() => {
    load();
  }, [load]);

  const ensureLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location', 'Enable location to sort by nearest open providers.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setUserCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    } catch (e) {
      setError(e.message || 'Location error');
    }
  };

  useEffect(() => {
    ensureLocation();
  }, []);

  const call = async (phone) => {
    if (!phone) return;
    const url = `tel:${phone}`;
    if (await Linking.canOpenURL(url)) await Linking.openURL(url);
  };

  const callEmergency = async (num, label) => {
    const url = `tel:${num}`;
    Alert.alert(
      'Emergency',
      `Call ${label} (${num})? For life-threatening emergencies use your local emergency number.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Call', onPress: () => Linking.openURL(url) },
      ]
    );
  };

  return (
    <ScrollView style={ui.screen(theme)} contentContainerStyle={{ paddingBottom: spacing['2xl'] }}>
      <ScreenHeader title="Urgent care" onBack={() => router.back()} />
      <Text style={[ui.caption(theme), { marginBottom: spacing.md, marginTop: -6 }]}>
        Open providers first. This is not a substitute for emergency services — use the buttons below
        if you need an ambulance or police.
      </Text>

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
        <TouchableOpacity
          style={[styles.emergencyBtn, { backgroundColor: theme.error, flex: 1 }]}
          onPress={() => callEmergency('112', 'Emergency 112')}
        >
          <Text style={styles.emergencyBtnText}>112 · Emergency</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.emergencyBtn, { backgroundColor: theme.text, flex: 1 }]}
          onPress={() => callEmergency('199', 'Nigeria FRSC')}
        >
          <Text style={[styles.emergencyBtnText, { color: theme.card }]}>199 · FRSC</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[ui.buttonOutline(theme), { marginBottom: spacing.md }]} onPress={ensureLocation}>
        <Text style={ui.buttonText(theme)}>
          {userCoords ? 'Refresh location' : 'Enable location for nearest'}
        </Text>
      </TouchableOpacity>

      {loading ? (
        <View style={{ gap: spacing.sm }}>
          {Array.from({ length: 3 }).map((_, idx) => (
            <View key={`urgent-shimmer-${idx}`} style={[ui.card(theme), { padding: spacing.md }]}>
              <ShimmerBlock theme={theme} style={{ height: 14, width: '48%', marginBottom: spacing.xs }} />
              <ShimmerText theme={theme} lines={2} />
            </View>
          ))}
        </View>
      ) : null}
      {error ? <Text style={ui.errorText(theme)}>{error}</Text> : null}

      {!loading && providers.length === 0 ? (
        <Text style={ui.caption(theme)}>No open providers match. Try widening search from Home.</Text>
      ) : null}

      {providers.map((p) => (
        <View
          key={p._id}
          style={[
            ui.card(theme),
            {
              marginBottom: spacing.md,
              borderWidth: 2,
              borderColor: p.isOpenNow ? theme.success + '66' : theme.border,
            },
          ]}
        >
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>{p.name}</Text>
          <Text style={[ui.caption(theme), { marginTop: spacing.xs }]}>
            {p.isOpenNow ? 'Open now' : 'Closed'} · {p.providerType}
            {p.distanceKm != null ? ` · ${p.distanceKm} km` : ''}
          </Text>
          <TouchableOpacity
            style={[styles.bigCall, { backgroundColor: theme.primary, marginTop: spacing.md }]}
            onPress={() => call(p.phone)}
          >
            <Text style={[styles.bigCallText, { color: theme.primaryForeground }]}>Call {p.phone}</Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = {
  emergencyBtn: {
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyBtnText: { color: '#fff', fontWeight: '700', fontSize: 13, textAlign: 'center' },
  bigCall: {
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  bigCallText: { fontSize: 17, fontWeight: '700' },
};
