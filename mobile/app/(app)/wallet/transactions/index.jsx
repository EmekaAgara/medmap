import { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth, useThemeMode } from '../../../_layout';
import ScreenHeader from '../../../components/ScreenHeader';
import { apiRequest } from '../../../../src/api/client';
import { ui, spacing, typography } from '../../../../theme/tokens';
import { ShimmerBlock, ShimmerText } from '../../../components/Shimmer';

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

export default function WalletTransactionsScreen() {
  const { token } = useAuth();
  const { theme } = useThemeMode();
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (nextPage, append) => {
      if (!token) return;
      try {
        setError('');
        const res = await apiRequest(`/wallets/me/transactions?page=${nextPage}&limit=25`, {
          method: 'GET',
          token,
        });
        const chunk = res.data?.items || [];
        const t = res.data?.total || 0;
        setTotal(t);
        setPage(nextPage);
        if (append) setItems((prev) => [...prev, ...chunk]);
        else setItems(chunk);
      } catch (e) {
        setError(e.message || 'Could not load');
        if (!append) setItems([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [token]
  );

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      setLoading(true);
      load(1, false);
    }, [token, load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load(1, false);
  };

  if (loading && items.length === 0) {
    return (
      <SafeAreaView style={ui.screen(theme)} edges={['top']}>
        <ScreenHeader title="History" onBack={() => router.back()} />
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          {Array.from({ length: 4 }).map((_, idx) => (
            <View key={`wallet-history-shimmer-${idx}`} style={[ui.card(theme), { padding: spacing.md }]}>
              <ShimmerBlock theme={theme} style={{ height: 14, width: '42%', marginBottom: spacing.xs }} />
              <ShimmerText theme={theme} lines={2} />
            </View>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  const hasMore = items.length < total;

  return (
    <SafeAreaView style={ui.screen(theme)} edges={['top']}>
      <ScreenHeader title="Transaction history" onBack={() => router.back()} />
      {error ? <Text style={ui.errorText(theme)}>{error}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(row) => String(row._id || row.reference)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        onEndReached={() => {
          if (!hasMore || loadingMore || loading) return;
          setLoadingMore(true);
          load(page + 1, true);
        }}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          loadingMore ? <ActivityIndicator color={theme.primary} style={{ marginVertical: spacing.lg }} /> : null
        }
        ListEmptyComponent={
          <Text style={[ui.caption(theme), { marginTop: spacing.lg }]}>No transactions yet.</Text>
        }
        renderItem={({ item: row }) => {
          const amt = Number(row.amount || 0);
          const incoming = ['fund', 'transfer_in', 'refund'].includes(row.type);
          const pending = row.status === 'pending';
          return (
            <TouchableOpacity
              style={[ui.card(theme), { marginBottom: spacing.sm }]}
              onPress={() =>
                router.push({
                  pathname: '/(app)/wallet/transactions/[id]',
                  params: { id: String(row._id) },
                })
              }
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, paddingRight: spacing.sm }}>
                  <Text style={[ui.caption(theme), { fontFamily: typography.fontFamilySemiBold }]}>
                    {txLabel(row.type)}
                    {pending ? ' · Pending' : ''}
                  </Text>
                  <Text style={[ui.caption(theme), { color: theme.subtleText, marginTop: 4, fontSize: 11 }]}>
                    {new Date(row.createdAt).toLocaleString()}
                  </Text>
                </View>
                <Text
                  style={{
                    fontFamily: typography.fontFamilySemiBold,
                    color: incoming ? theme.success : theme.text,
                  }}
                >
                  {incoming ? '+' : '−'}₦{amt.toLocaleString()}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}
