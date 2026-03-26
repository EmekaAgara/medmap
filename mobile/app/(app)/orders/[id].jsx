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
import { beginInAppCheckout } from '../../../src/wallet/checkoutSession';
import { ui, spacing } from '../../../theme/tokens';
import { ShimmerBlock, ShimmerText } from '../../components/Shimmer';

function statusLabel(s) {
  if (s === 'pending_payment') return 'Awaiting payment';
  if (s === 'paid') return 'Paid — awaiting fulfillment';
  if (s === 'processing') return 'Processing';
  if (s === 'ready_for_pickup') return 'Ready for pickup';
  if (s === 'out_for_delivery') return 'Out for delivery';
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
      if ((payment?.paymentLink || payment?.paymentHtml) && payment?.reference) {
        await beginInAppCheckout(router, {
          paymentLink: payment.paymentLink,
          paymentHtml: payment.paymentHtml,
          reference: payment.reference,
          returnUrlPrefixes: payment.returnUrlPrefixes,
          intent: 'order_pay',
          orderId: String(id),
        });
      } else if (payment?.paymentLink) {
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

  const trySetStatus = async (status) => {
    if (!id || !token) return;
    try {
      setBusy(true);
      setError('');
      await apiRequest(`/orders/${id}/status`, { method: 'POST', token, body: { status } });
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
        <View style={{ gap: spacing.md }}>
          <ShimmerBlock theme={theme} style={{ height: 22, width: '42%' }} />
          <ShimmerText theme={theme} lines={3} />
          <ShimmerBlock theme={theme} style={{ height: 140, borderRadius: 12 }} />
        </View>
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

        {order.fulfillment?.method ? (
          <View style={[ui.card(theme), { padding: spacing.md, marginTop: spacing.md }]}>
            <Text style={[ui.caption(theme), { fontWeight: '800' }]}>Fulfillment</Text>
            <Text style={[ui.caption(theme), { marginTop: spacing.xs }]}>
              Method: {order.fulfillment.method === 'delivery' ? 'Delivery' : 'Pickup'}
            </Text>
            {order.fulfillment.method === 'delivery' && order.fulfillment.address ? (
              <Text style={[ui.caption(theme), { marginTop: spacing.xs }]}>Address: {order.fulfillment.address}</Text>
            ) : null}
            {order.fulfillment.phone ? (
              <Text style={[ui.caption(theme), { marginTop: spacing.xs }]}>Phone: {order.fulfillment.phone}</Text>
            ) : null}
            {order.fulfillment.notes ? (
              <Text style={[ui.caption(theme), { marginTop: spacing.xs }]}>Notes: {order.fulfillment.notes}</Text>
            ) : null}
          </View>
        ) : null}

        {order.prescription?.required ? (
          <Text style={[ui.caption(theme), { marginTop: spacing.md, color: theme.subtleText }]}>
            Prescription: {order.prescription.url ? 'Attached' : 'Required'}
          </Text>
        ) : null}

        {(order.trackingEvents || []).length ? (
          <View style={{ marginTop: spacing.lg }}>
            <Text style={[ui.caption(theme), { fontWeight: '800', marginBottom: spacing.xs }]}>Tracking</Text>
            {(order.trackingEvents || [])
              .slice()
              .reverse()
              .slice(0, 6)
              .map((ev, idx) => (
                <Text key={idx} style={[ui.caption(theme), { marginBottom: spacing.xs, color: theme.subtleText }]}>
                  {new Date(ev.at || Date.now()).toLocaleString()} · {statusLabel(ev.status)}{ev.note ? ` — ${ev.note}` : ''}
                </Text>
              ))}
          </View>
        ) : null}

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
          <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
            <TouchableOpacity style={ui.buttonPrimary(theme)} onPress={() => trySetStatus('processing')} disabled={busy}>
              <Text style={ui.buttonTextPrimary(theme)}>Start processing</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ui.buttonOutline(theme)} onPress={tryFulfill} disabled={busy}>
              <Text style={ui.buttonText(theme)}>Mark fulfilled</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {isSeller && ['processing', 'ready_for_pickup', 'out_for_delivery'].includes(order.status) ? (
          <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
            {order.fulfillment?.method === 'delivery' ? (
              <TouchableOpacity
                style={ui.buttonPrimary(theme)}
                onPress={() => trySetStatus('out_for_delivery')}
                disabled={busy}
              >
                <Text style={ui.buttonTextPrimary(theme)}>Out for delivery</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={ui.buttonPrimary(theme)}
                onPress={() => trySetStatus('ready_for_pickup')}
                disabled={busy}
              >
                <Text style={ui.buttonTextPrimary(theme)}>Ready for pickup</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={ui.buttonOutline(theme)} onPress={tryFulfill} disabled={busy}>
              <Text style={ui.buttonText(theme)}>Mark fulfilled</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
