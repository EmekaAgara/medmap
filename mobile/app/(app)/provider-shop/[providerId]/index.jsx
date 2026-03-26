import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useThemeMode } from '../../../_layout';
import ScreenHeader from '../../../components/ScreenHeader';
import { apiRequest } from '../../../../src/api/client';
import { normalizeCatalogProducts } from '../../../../src/utils/catalog';
import { ui, spacing, radii } from '../../../../theme/tokens';
import { getCart } from '../../../../src/cart/cartStore';
import { ShimmerAvatar, ShimmerBlock, ShimmerText } from '../../../components/Shimmer';

export default function ProviderShopScreen() {
  const { providerId } = useLocalSearchParams();
  const router = useRouter();
  const { token } = useAuth();
  const { theme } = useThemeMode();
  const [provider, setProvider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cartCount, setCartCount] = useState(0);

  const load = useCallback(async () => {
    if (!providerId) return;
    try {
      setLoading(true);
      setError('');
      const res = await apiRequest(`/providers/${providerId}`, { method: 'GET', token });
      setProvider(res.data || null);
    } catch (e) {
      setError(e.message || 'Could not load shop');
      setProvider(null);
    } finally {
      setLoading(false);
    }
  }, [providerId, token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const c = await getCart();
        if (mounted) setCartCount((c.items || []).length);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      mounted = false;
    };
  }, [providerId]);

  const catalog = useMemo(() => normalizeCatalogProducts(provider?.products || []), [provider?.products]);

  if (loading && !provider) {
    return (
      <SafeAreaView style={[ui.screen(theme), { flex: 1 }]} edges={['top']}>
        <ScreenHeader title="Shop" onBack={() => router.back()} />
        <View style={{ gap: spacing.md }}>
          <View style={[ui.card(theme), { padding: spacing.md, flexDirection: 'row', gap: spacing.md, alignItems: 'center' }]}>
            <ShimmerAvatar theme={theme} size={56} />
            <View style={{ flex: 1 }}>
              <ShimmerBlock theme={theme} style={{ height: 14, width: '55%', marginBottom: spacing.xs }} />
              <ShimmerText theme={theme} lines={2} />
            </View>
          </View>
          <ShimmerBlock theme={theme} style={{ height: 160, borderRadius: radii.lg }} />
        </View>
      </SafeAreaView>
    );
  }

  if (!provider) {
    return (
      <SafeAreaView style={[ui.screen(theme), { flex: 1 }]} edges={['top']}>
        <ScreenHeader title="Shop" onBack={() => router.back()} />
        <Text style={[ui.errorText(theme), { margin: spacing.md }]}>{error || 'Not found'}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[ui.screen(theme), { flex: 1 }]} edges={['top']}>
      <ScreenHeader
        title={provider.name || 'Shop'}
        onBack={() => router.back()}
        right={
          <TouchableOpacity
            onPress={() => router.push('/(app)/cart')}
            style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}
            hitSlop={12}
          >
            <Ionicons name="cart-outline" size={22} color={theme.text} />
            {cartCount ? (
              <View
                style={{
                  position: 'absolute',
                  right: 6,
                  top: 0,
                  backgroundColor: theme.primary,
                  borderRadius: 10,
                  minWidth: 18,
                  height: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 4,
                }}
              >
                <Text style={{ color: theme.primaryForeground, fontSize: 10, fontWeight: '800' }}>{cartCount}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        }
      />
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing['2xl'] }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {provider.imageUrl ? (
            <Image source={{ uri: provider.imageUrl }} style={styles.heroAvatar} />
          ) : (
            <View style={[styles.heroAvatarPh, { borderColor: theme.border, backgroundColor: theme.secondary }]}>
              <Ionicons name="storefront-outline" size={28} color={theme.subtleText} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[styles.heroTitle, { color: theme.text }]}>{provider.name}</Text>
            <Text style={[ui.caption(theme), { marginTop: 4 }]}>
              {provider.city || '—'} · {catalog.length} product{catalog.length === 1 ? '' : 's'}
            </Text>
          </View>
        </View>

        <Text style={[ui.caption(theme), { marginTop: spacing.md, marginBottom: spacing.sm, color: theme.subtleText }]}>
          Tap a product for details, quantity, and checkout. Pay with your wallet or Interswitch if you need to top up.
        </Text>

        {error ? <Text style={ui.errorText(theme)}>{error}</Text> : null}

        <View style={styles.grid}>
          {catalog.map((p, index) => (
            <TouchableOpacity
              key={`${p.name}-${p.price}-${index}`}
              activeOpacity={0.92}
              style={[styles.tile, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() =>
                router.push({
                  pathname: '/(app)/provider-shop/[providerId]/product/[index]',
                  params: { providerId: String(providerId), index: String(index) },
                })
              }
            >
              <View style={styles.imgWrap}>
                {p.imageUrl ? (
                  <Image source={{ uri: p.imageUrl }} style={styles.tileImg} resizeMode="cover" />
                ) : (
                  <View style={[styles.tileImgPh, { backgroundColor: theme.secondary }]}>
                    <Ionicons name="image-outline" size={32} color={theme.subtleText} />
                  </View>
                )}
              </View>
              <Text style={[styles.tileTitle, { color: theme.text }]} numberOfLines={2}>
                {p.name}
              </Text>
              <Text style={[styles.tilePrice, { color: theme.primary }]}>
                {p.price > 0 ? `₦${p.price.toLocaleString()}` : 'Free'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {!catalog.length ? (
          <Text style={[ui.caption(theme), { marginTop: spacing.lg }]}>This provider has not listed products yet.</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = {
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  heroAvatar: { width: 56, height: 56, borderRadius: 28 },
  heroAvatarPh: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontSize: 18, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.sm },
  tile: {
    width: '48%',
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  imgWrap: { borderRadius: radii.md, overflow: 'hidden', marginBottom: spacing.sm },
  tileImg: { width: '100%', aspectRatio: 1, borderRadius: radii.md },
  tileImgPh: { width: '100%', aspectRatio: 1, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  tileTitle: { fontSize: 14, fontWeight: '700', minHeight: 40 },
  tilePrice: { fontSize: 15, fontWeight: '800', marginTop: 4 },
};
