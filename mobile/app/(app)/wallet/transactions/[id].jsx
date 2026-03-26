import { useCallback, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useAuth, useThemeMode } from '../../../_layout';
import ScreenHeader from '../../../components/ScreenHeader';
import { apiRequest } from '../../../../src/api/client';
import { ui, spacing, typography, radii } from '../../../../theme/tokens';

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

function Row({ label, value, theme }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={[ui.caption(theme), { color: theme.subtleText, marginBottom: 4 }]}>{label}</Text>
      <Text style={{ color: theme.text, fontFamily: typography.fontFamilyMedium, fontSize: 14 }}>{value}</Text>
    </View>
  );
}

export default function WalletTransactionDetailScreen() {
  const { id } = useLocalSearchParams();
  const { token } = useAuth();
  const { theme } = useThemeMode();
  const router = useRouter();
  const [tx, setTx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id || !token) return;
    try {
      setLoading(true);
      setError('');
      const res = await apiRequest(`/wallets/me/transactions/${id}`, { method: 'GET', token });
      setTx(res.data || null);
    } catch (e) {
      setError(e.message || 'Could not load transaction');
      setTx(null);
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading && !tx) {
    return (
      <SafeAreaView style={ui.screen(theme)} edges={['top']}>
        <ScreenHeader title="Transaction" onBack={() => router.back()} />
        <ActivityIndicator color={theme.primary} style={{ marginTop: spacing.lg }} />
      </SafeAreaView>
    );
  }

  if (!tx) {
    return (
      <SafeAreaView style={ui.screen(theme)} edges={['top']}>
        <ScreenHeader title="Transaction" onBack={() => router.back()} />
        <Text style={ui.errorText(theme)}>{error || 'Not found'}</Text>
      </SafeAreaView>
    );
  }

  const amt = Number(tx.amount || 0);
  const incoming = ['fund', 'transfer_in', 'refund'].includes(tx.type);
  const metaStr =
    tx.meta && typeof tx.meta === 'object' ? JSON.stringify(tx.meta, null, 2) : '—';

  return (
    <SafeAreaView style={ui.screen(theme)} edges={['top']}>
      <ScreenHeader title="Transaction" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing['2xl'] }}>
        <View
          style={[
            ui.card(theme),
            {
              borderRadius: radii.lg,
              marginBottom: spacing.lg,
              alignItems: 'center',
            },
          ]}
        >
          <Text style={[ui.caption(theme), { color: theme.subtleText }]}>{txLabel(tx.type)}</Text>
          <Text
            style={{
              fontFamily: typography.fontFamilyBold,
              fontSize: 28,
              color: incoming ? theme.success : theme.text,
              marginTop: spacing.sm,
            }}
          >
            {incoming ? '+' : '−'}₦{amt.toLocaleString()}
          </Text>
          <Text style={[ui.caption(theme), { color: theme.subtleText, marginTop: spacing.xs }]}>
            {String(tx.status || '').toUpperCase()} · {String(tx.currency || 'NGN')}
          </Text>
        </View>

        <View style={ui.card(theme)}>
          <Row label="Reference" value={tx.reference || '—'} theme={theme} />
          <Row label="Provider" value={tx.provider || '—'} theme={theme} />
          <Row label="When" value={tx.createdAt ? new Date(tx.createdAt).toLocaleString() : '—'} theme={theme} />
          {tx.updatedAt && String(tx.updatedAt) !== String(tx.createdAt) ? (
            <Row label="Updated" value={new Date(tx.updatedAt).toLocaleString()} theme={theme} />
          ) : null}
        </View>

        <Text style={[ui.h2(theme), { fontSize: 14, marginTop: spacing.lg, marginBottom: spacing.sm }]}>
          Details
        </Text>
        <View style={[ui.card(theme), { backgroundColor: theme.secondary }]}>
          <Text
            style={{
              fontFamily: typography.fontFamilyRegular,
              fontSize: 12,
              color: theme.subtleText,
              lineHeight: 18,
            }}
          >
            {metaStr}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
