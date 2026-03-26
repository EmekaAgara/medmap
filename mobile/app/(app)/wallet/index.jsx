import { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useThemeMode } from '../../_layout';
import ScreenHeader from '../../components/ScreenHeader';
import { apiRequest } from '../../../src/api/client';
import { beginInAppCheckout } from '../../../src/wallet/checkoutSession';
import { ui, spacing, typography, radii, layout } from '../../../theme/tokens';
import { ShimmerBlock, ShimmerText } from '../../components/Shimmer';

const PRESETS = [5000, 10000, 20000, 50000, 100000];

function txLabel(t) {
  const map = {
    fund: 'Top-up',
    bill_payment: 'Payment',
    transfer_in: 'Money in',
    transfer_out: 'Money out',
    refund: 'Refund',
    withdraw: 'Withdrawal',
  };
  return map[t] || t || 'Transaction';
}

function MoneyField({ theme, value, onChangeText, onSubmit }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: radii.lg,
        backgroundColor: theme.inputBackground || theme.secondary,
        paddingHorizontal: spacing.md,
        minHeight: 52,
      }}
    >
      <Text style={{ color: theme.subtleText, fontFamily: typography.fontFamilySemiBold, marginRight: 6 }}>₦</Text>
      <TextInput
        placeholder="0"
        placeholderTextColor={theme.subtleText}
        keyboardType="number-pad"
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        style={{
          flex: 1,
          fontSize: 22,
          fontFamily: typography.fontFamilySemiBold,
          color: theme.text,
          paddingVertical: spacing.sm,
        }}
      />
    </View>
  );
}

export default function WalletHomeScreen() {
  const { token } = useAuth();
  const { theme } = useThemeMode();
  const router = useRouter();
  const autoVerifyInProgressRef = useRef(false);
  const [wallet, setWallet] = useState(null);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [amountText, setAmountText] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError('');
      const [wRes, tRes] = await Promise.all([
        apiRequest('/wallets/me', { method: 'GET', token }),
        apiRequest('/wallets/me/transactions?page=1&limit=30', { method: 'GET', token }),
      ]);

      const nextItems = tRes.data?.items || [];
      const pendingFundRefs = nextItems
        .filter((x) => x?.status === 'pending' && x?.type === 'fund' && x?.reference)
        .slice(0, 3)
        .map((x) => x.reference);

      setWallet(wRes.data || null);
      setItems(nextItems);
      setTotal(tRes.data?.total || 0);

      // Best-effort requery for pending top-ups. Must not fail the screen: verify can 404/500
      // while the main wallet + list requests already succeeded.
      if (pendingFundRefs.length && !autoVerifyInProgressRef.current) {
        autoVerifyInProgressRef.current = true;
        (async () => {
          try {
            for (const reference of pendingFundRefs) {
              try {
                await apiRequest('/wallets/me/fund/verify', {
                  method: 'POST',
                  token,
                  body: { reference },
                });
              } catch (e) {
                if (__DEV__) {
                  // eslint-disable-next-line no-console
                  console.warn('[Wallet] fund/verify', reference, e?.message || e);
                }
              }
            }
            try {
              const [w2Res, t2Res] = await Promise.all([
                apiRequest('/wallets/me', { method: 'GET', token }),
                apiRequest('/wallets/me/transactions?page=1&limit=30', { method: 'GET', token }),
              ]);
              setWallet(w2Res.data || null);
              setItems(t2Res.data?.items || []);
              setTotal(t2Res.data?.total || 0);
            } catch (e) {
              if (__DEV__) {
                // eslint-disable-next-line no-console
                console.warn('[Wallet] refresh after verify', e?.message || e);
              }
            }
          } finally {
            autoVerifyInProgressRef.current = false;
          }
        })();
      }
    } catch (e) {
      setError(e.message || 'Could not load wallet');
      setWallet(null);
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const bal = Number(wallet?.availableBalance ?? 0);
  const recent = useMemo(() => (items || []).slice(0, 5), [items]);

  const startTopUp = async () => {
    const raw = String(amountText || '').replace(/,/g, '').trim();
    const amount = Number(raw);
    if (!token || !Number.isFinite(amount) || amount < 100) {
      Alert.alert('Amount', 'Enter at least ₦100.');
      return;
    }
    try {
      setBusy(true);
      const res = await apiRequest('/wallets/me/fund', {
        method: 'POST',
        token,
        body: { amount, meta: { intent: 'manual_topup' } },
      });
      const pay = res.data;
      if ((pay?.paymentLink || pay?.paymentHtml) && pay?.reference) {
        await beginInAppCheckout(router, {
          paymentLink: pay.paymentLink,
          paymentHtml: pay.paymentHtml,
          reference: pay.reference,
          returnUrlPrefixes: pay.returnUrlPrefixes,
          intent: 'wallet',
        });
      } else {
        Alert.alert('Wallet', 'Could not start payment. Configure Interswitch on the server.');
      }
    } catch (e) {
      Alert.alert('Wallet', e.message || 'Could not start top-up');
    } finally {
      setBusy(false);
    }
  };

  if (loading && !wallet) {
    return (
      <SafeAreaView style={ui.screen(theme)} edges={['top']}>
        <ScreenHeader title="Wallet" onBack={() => router.back()} />
        <View style={{ gap: spacing.md }}>
          <ShimmerBlock theme={theme} style={{ height: 150, borderRadius: radii.xl }} />
          <ShimmerBlock theme={theme} style={{ height: 56, borderRadius: radii.lg }} />
          <View style={[ui.card(theme), { gap: spacing.sm }]}>
            <ShimmerText theme={theme} lines={2} />
            <ShimmerText theme={theme} lines={2} />
            <ShimmerText theme={theme} lines={2} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <ScreenHeader title="Wallet" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: layout.screenPaddingHorizontal,
          paddingBottom: spacing['3xl'],
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            borderRadius: radii.xl,
            padding: spacing.xl,
            backgroundColor: theme.primary,
            marginBottom: spacing.lg,
          }}
        >
          <Text
            style={{
              color: theme.primaryForeground,
              opacity: 0.85,
              fontFamily: typography.fontFamilyMedium,
              fontSize: 12,
            }}
          >
            Available balance
          </Text>
          <Text
            style={{
              color: theme.primaryForeground,
              fontFamily: typography.fontFamilyBold,
              fontSize: 32,
              marginTop: spacing.xs,
            }}
          >
            ₦{bal.toLocaleString()}
          </Text>
          <Text
            style={{
              color: theme.primaryForeground,
              opacity: 0.8,
              fontFamily: typography.fontFamilyRegular,
              fontSize: 12,
              marginTop: spacing.md,
              lineHeight: 18,
            }}
          >
            Top up via Interswitch Web Checkout (hosted payment page). We confirm payment server-side with
            gettransaction — never only the redirect parameters.
          </Text>
        </View>

        {error ? <Text style={[ui.errorText(theme), { marginBottom: spacing.sm }]}>{error}</Text> : null}

        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
          <TouchableOpacity
            style={[ui.buttonSecondary(theme), { flex: 1, opacity: 0.6 }]}
            disabled
            activeOpacity={0.9}
          >
            <Ionicons name="arrow-up-outline" size={18} color={theme.text} style={{ marginRight: 6 }} />
            <Text style={ui.buttonText(theme)}>Send</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[ui.buttonOutline(theme), { flex: 1 }]}
            onPress={() => router.push('/(app)/wallet/transactions')}
          >
            <Ionicons name="receipt-outline" size={18} color={theme.text} style={{ marginRight: 6 }} />
            <Text style={ui.buttonText(theme)}>History</Text>
          </TouchableOpacity>
        </View>

        <Text style={[ui.h2(theme), { fontSize: 16, marginBottom: spacing.sm }]}>Add money</Text>
        <View style={[ui.card(theme), { marginBottom: spacing.md }]}>
          <MoneyField
            theme={theme}
            value={amountText}
            onChangeText={setAmountText}
            onSubmit={startTopUp}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }}>
            {PRESETS.map((n) => (
              <Pressable
                key={n}
                onPress={() => setAmountText(String(n))}
                style={({ pressed }) => [
                  {
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    borderRadius: radii.pill,
                    borderWidth: 1,
                    borderColor: theme.border,
                    backgroundColor: pressed ? theme.secondary : theme.background,
                  },
                ]}
              >
                <Text style={[ui.caption(theme), { fontFamily: typography.fontFamilySemiBold }]}>
                  ₦{(n / 1000).toLocaleString()}k
                </Text>
              </Pressable>
            ))}
          </View>
          <TouchableOpacity
            style={[ui.buttonPrimary(theme), { marginTop: spacing.lg }, busy ? { opacity: 0.75 } : null]}
            onPress={startTopUp}
            disabled={busy}
          >
            <Text style={ui.buttonTextPrimary(theme)}>
              {busy ? 'Starting…' : 'Continue with Interswitch'}
            </Text>
          </TouchableOpacity>
          <Text style={[ui.caption(theme), { color: theme.subtleText, marginTop: spacing.md, lineHeight: 18 }]}>
            You&apos;ll complete payment on Interswitch&apos;s page; the app polls until the server verifies via
            gettransaction (see Web Checkout docs).
          </Text>
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: spacing.sm,
            marginTop: spacing.sm,
          }}
        >
          <Text style={[ui.h2(theme), { fontSize: 16 }]}>Recent activity</Text>
          {(total || 0) > 5 ? (
            <TouchableOpacity onPress={() => router.push('/(app)/wallet/transactions')}>
              <Text style={{ color: theme.primary, fontFamily: typography.fontFamilySemiBold, fontSize: 13 }}>
                See all
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {recent.length === 0 ? (
          <View style={[ui.card(theme), { alignItems: 'center', paddingVertical: spacing.xl }]}>
            <Ionicons name="wallet-outline" size={36} color={theme.subtleText} />
            <Text style={[ui.caption(theme), { marginTop: spacing.sm, textAlign: 'center' }]}>
              No transactions yet. Top up to get started.
            </Text>
          </View>
        ) : (
          recent.map((row) => {
            const amt = Number(row.amount || 0);
            const incoming = ['fund', 'transfer_in', 'refund'].includes(row.type);
            const pending = row.status === 'pending';
            return (
              <TouchableOpacity
                key={row._id || row.reference}
                style={[ui.card(theme), { marginBottom: spacing.sm, paddingVertical: spacing.md }]}
                activeOpacity={0.85}
                onPress={() =>
                  router.push({
                    pathname: '/(app)/wallet/transactions/[id]',
                    params: { id: String(row._id) },
                  })
                }
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1, paddingRight: spacing.sm }}>
                    <Text style={[ui.caption(theme), { fontFamily: typography.fontFamilySemiBold }]}>
                      {txLabel(row.type)}
                      {pending ? ' · Pending' : ''}
                    </Text>
                    <Text style={[ui.caption(theme), { color: theme.subtleText, marginTop: 4, fontSize: 11 }]}>
                      {new Date(row.createdAt).toLocaleString()} · {row.reference}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontFamily: typography.fontFamilySemiBold,
                      color: incoming ? theme.success : theme.text,
                      fontSize: 15,
                    }}
                  >
                    {incoming ? '+' : '−'}₦{amt.toLocaleString()}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
