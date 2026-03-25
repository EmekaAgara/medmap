import { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth, useThemeMode } from '../../_layout';
import ScreenHeader from '../../components/ScreenHeader';
import { apiRequest } from '../../../src/api/client';
import { ui, spacing } from '../../../theme/tokens';

function statusLabel(s) {
  if (s === 'pending_payment') return 'Awaiting payment';
  if (s === 'paid') return 'Paid — awaiting fulfillment';
  if (s === 'fulfilled') return 'Fulfilled';
  if (s === 'cancelled') return 'Cancelled';
  return s || '—';
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams();
  const { token, user } = useAuth();
  const { theme } = useThemeMode();
  const router = useRouter();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id || !token) return;
    try {
      setLoading(true);
      setError('');
      const res = await apiRequest(`/orders/${id}`, { method: 'GET', token });
      setOrder(res.data);
    } catch (e) {
      setError(e.message || 'Could not load order');
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const buyerId =
    order?.buyerUser && typeof order.buyerUser === 'object'
      ? String(order.buyerUser._id)
      : String(order?.buyerUser || '');
  const isBuyer = buyerId === String(user?.id);
  const isSeller = String(order?.providerOwnerUser || '') === String(user?.id);

  const tryPay = async () => {
    if (!id || !token) return;
    try {
      setBusy(true);
      setError('');
      const res = await apiRequest(`/orders/${id}/pay`, { method: 'POST', token, body: {} });
      const payment = res.data?.payment;
      if (payment?.paymentLink) {
        Alert.alert('Add funds', 'Open the payment page to top up your wallet.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', onPress: () => Linking.openURL(payment.paymentLink).catch(() => {}) },
        ]);
      } else {
        await load();
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const tryCancel = async () => {
    if (!id || !token) return;
    Alert.alert('Cancel order', 'Only unpaid orders can be cancelled.', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cancel order',
        style: 'destructive',
        onPress: async () => {
          try {
            setBusy(true);
            await apiRequest(`/orders/${id}/cancel`, { method: 'POST', token, body: {} });
            await load();
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const tryFulfill = async () => {
    if (!id || !token) return;
    try {
      setBusy(true);
      setError('');
      await apiRequest(`/orders/${id}/fulfill`, { method: 'POST', token, body: {} });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading && !order) {
    return (
      <SafeAreaView style={ui.screen(theme)} edges={['top']}>
        <ScreenHeader title="Order" onBack={() => router.back()} />
        <ActivityIndicator color={theme.primary} style={{ marginTop: spacing.lg }} />
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={ui.screen(theme)} edges={['top']}>
        <ScreenHeader title="Order" onBack={() => router.back()} />
        <Text style={ui.errorText(theme)}>{error || 'Not found'}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={ui.screen(theme)} edges={['top']}>
      <ScreenHeader title="Order" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing['2xl'] }}>
        <Text style={[ui.h2(theme), { marginBottom: spacing.sm, fontSize: 18 }]}>
          {order.provider?.name || 'Provider'}
        </Text>
        <Text style={[ui.caption(theme), { marginBottom: spacing.xs }]}>
          Status: <Text style={{ fontWeight: '700' }}>{statusLabel(order.status)}</Text>
        </Text>
        <Text style={[ui.caption(theme), { marginBottom: spacing.md }]}>
          Total: ₦{Number(order.totalAmount || 0).toLocaleString()}
        </Text>

        {(order.items || []).map((line, i) => (
          <Text key={i} style={[ui.caption(theme), { marginBottom: spacing.xs }]}>
            {line.name} × {line.quantity} @ ₦{Number(line.unitPrice || 0).toLocaleString()}
          </Text>
        ))}

        {error ? <Text style={[ui.errorText(theme), { marginTop: spacing.sm }]}>{error}</Text> : null}

        {isBuyer && order.status === 'pending_payment' ? (
          <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
            <TouchableOpacity style={ui.buttonPrimary(theme)} onPress={tryPay} disabled={busy}>
              <Text style={ui.buttonTextPrimary(theme)}>Pay from wallet / get link</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ui.buttonOutline(theme)} onPress={tryCancel} disabled={busy}>
              <Text style={ui.buttonText(theme)}>Cancel order</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {isSeller && order.status === 'paid' ? (
          <TouchableOpacity
            style={[ui.buttonPrimary(theme), { marginTop: spacing.lg }]}
            onPress={tryFulfill}
            disabled={busy}
          >
            <Text style={ui.buttonTextPrimary(theme)}>Mark fulfilled</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
