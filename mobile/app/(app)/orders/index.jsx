import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth, useThemeMode } from '../../_layout';
import ScreenHeader from '../../components/ScreenHeader';
import { apiRequest } from '../../../src/api/client';
import { ui, spacing } from '../../../theme/tokens';
import { ShimmerBlock, ShimmerText } from '../../components/Shimmer';

function statusLabel(s) {
  if (s === 'pending_payment') return 'Awaiting payment';
  if (s === 'paid') return 'Paid';
  if (s === 'fulfilled') return 'Fulfilled';
  if (s === 'cancelled') return 'Cancelled';
  return s || '—';
}

export default function MyOrdersScreen() {
  const { token } = useAuth();
  const { theme } = useThemeMode();
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError('');
      const res = await apiRequest('/orders/mine/buyer', { method: 'GET', token });
      setItems(res.data || []);
    } catch (e) {
      setError(e.message || 'Could not load orders');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <SafeAreaView style={ui.screen(theme)} edges={['top']}>
      <ScreenHeader title="My orders" />
      {loading ? (
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          {Array.from({ length: 3 }).map((_, idx) => (
            <View key={`orders-shimmer-${idx}`} style={[ui.card(theme), { padding: spacing.md }]}>
              <ShimmerBlock theme={theme} style={{ height: 14, width: '50%', marginBottom: spacing.xs }} />
              <ShimmerText theme={theme} lines={2} />
            </View>
          ))}
        </View>
      ) : null}
      {error ? <Text style={ui.errorText(theme)}>{error}</Text> : null}
      <ScrollView contentContainerStyle={{ paddingBottom: spacing['2xl'] }}>
        {!loading && !items.length ? (
          <Text style={[ui.caption(theme), { marginTop: spacing.md }]}>No purchases yet.</Text>
        ) : null}
        {items.map((o) => (
          <TouchableOpacity
            key={String(o._id)}
            style={[ui.card(theme), { padding: spacing.md, marginBottom: spacing.sm }]}
            onPress={() => router.push({ pathname: '/(app)/orders/[id]', params: { id: String(o._id) } })}
          >
            <Text style={[ui.caption(theme), { fontWeight: '800' }]}>{o.provider?.name || 'Provider'}</Text>
            <Text style={[ui.caption(theme), { marginTop: spacing.xs }]}>
              {statusLabel(o.status)} · ₦{Number(o.totalAmount || 0).toLocaleString()}
            </Text>
            <Text style={[ui.caption(theme), { color: theme.subtleText, marginTop: spacing.xs }]}>
              {new Date(o.createdAt).toLocaleString()}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
