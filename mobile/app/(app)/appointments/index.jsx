import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth, useThemeMode } from '../../_layout';
import ScreenHeader from '../../components/ScreenHeader';
import { apiRequest } from '../../../src/api/client';
import { ui, spacing } from '../../../theme/tokens';
import { ShimmerBlock, ShimmerText } from '../../components/Shimmer';

function statusLabel(s) {
  if (s === 'pending') return 'Awaiting provider';
  if (s === 'confirmed') return 'Confirmed';
  if (s === 'rejected') return 'Declined';
  if (s === 'cancelled') return 'Cancelled';
  return s;
}

export default function MyAppointmentsScreen() {
  const { token } = useAuth();
  const { theme } = useThemeMode();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiRequest('/appointments/mine/patient', { method: 'GET', token });
      setItems(res.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [token])
  );

  return (
    <SafeAreaView style={ui.screen(theme)} edges={['top']}>
      <ScreenHeader title="My appointments" />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing['2xl'] }}>
        {loading ? (
          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            {Array.from({ length: 3 }).map((_, idx) => (
              <View key={`appt-shimmer-${idx}`} style={[ui.card(theme), { padding: spacing.md }]}>
                <ShimmerBlock theme={theme} style={{ height: 14, width: '45%', marginBottom: spacing.xs }} />
                <ShimmerText theme={theme} lines={2} />
              </View>
            ))}
          </View>
        ) : null}
        {error ? <Text style={ui.errorText(theme)}>{error}</Text> : null}
        {!loading && items.length === 0 ? (
          <Text style={[ui.caption(theme), { marginTop: spacing.md }]}>No appointments yet.</Text>
        ) : null}

        {items.map((a) => (
          <TouchableOpacity
            key={a._id}
            onPress={() =>
              router.push({ pathname: '/(app)/appointments/[id]', params: { id: String(a._id) } })
            }
            style={[ui.card(theme), { marginTop: spacing.md }]}
          >
            <Text style={{ color: theme.text, fontWeight: '600' }}>
              {a.provider?.name || 'Provider'}
            </Text>
            <Text style={[ui.caption(theme), { marginTop: spacing.xs }]}>
              {statusLabel(a.status)} ·{' '}
              {a.status === 'confirmed' && a.confirmedStart
                ? new Date(a.confirmedStart).toLocaleString()
                : new Date(a.requestedStart).toLocaleString()}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
