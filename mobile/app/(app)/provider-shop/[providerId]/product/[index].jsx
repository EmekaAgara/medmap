import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useThemeMode } from '../../../../_layout';
import ScreenHeader from '../../../../components/ScreenHeader';
import { apiRequest } from '../../../../../src/api/client';
import { normalizeCatalogProducts } from '../../../../../src/utils/catalog';
import { presentOrderResult } from '../../../../../src/utils/orderPay';
import { addToCart } from '../../../../../src/cart/cartStore';
import { ui, spacing, radii } from '../../../../../theme/tokens';

export default function ProviderProductDetailScreen() {
  const { providerId, index: indexStr } = useLocalSearchParams();
  const router = useRouter();
  const { token, user } = useAuth();
  const { theme } = useThemeMode();
  const [provider, setProvider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [qty, setQty] = useState(1);
  const [ordering, setOrdering] = useState(false);

  const idx = Math.max(0, parseInt(String(indexStr || '0'), 10) || 0);

  const load = useCallback(async () => {
    if (!providerId) return;
    try {
      setLoading(true);
      setError('');
      const res = await apiRequest(`/providers/${providerId}`, { method: 'GET', token });
      setProvider(res.data || null);
    } catch (e) {
      setError(e.message || 'Could not load product');
      setProvider(null);
    } finally {
      setLoading(false);
    }
  }, [providerId, token]);

  useEffect(() => {
    load();
  }, [load]);

  const catalog = useMemo(() => normalizeCatalogProducts(provider?.products || []), [provider?.products]);
  const product = catalog[idx] || null;

  const buyNow = async () => {
    if (!token) {
      Alert.alert('Sign in', 'Log in to purchase.');
      return;
    }
    if (user?.accountType !== 'patient') {
      Alert.alert('Patients only', 'Only patient accounts can purchase from the shop.');
      return;
    }
    if (!product || !provider?._id) return;
    try {
      setOrdering(true);
      const res = await apiRequest('/orders', {
        method: 'POST',
        token,
        body: {
          providerId: provider._id,
          lines: [{ name: product.name, quantity: qty }],
        },
      });
      presentOrderResult({
        pack: res.data,
        router,
        token,
        clearCart: () => setQty(1),
      });
    } catch (e) {
      if (e?.details?.requiresPrescription) {
        router.push({
          pathname: '/(app)/prescription-upload',
          params: {
            providerId: String(provider?._id || providerId),
            name: product.name,
            qty: String(qty),
            payload: JSON.stringify({
              providerId: String(provider?._id || providerId),
              lines: [{ name: product.name, quantity: qty }],
            }),
          },
        });
        return;
      }
      Alert.alert('Checkout failed', e.message || 'Could not place order');
    } finally {
      setOrdering(false);
    }
  };

  const addItemToCart = async () => {
    if (!product || !provider?._id) return;
    try {
      await addToCart({
        providerId: String(provider._id),
        name: product.name,
        unitPrice: product.price,
        quantity: qty,
      });
      Alert.alert('Cart', 'Added to cart.');
    } catch (e) {
      Alert.alert('Cart', e.message || 'Could not add to cart');
    }
  };

  if (loading && !provider) {
    return (
      <SafeAreaView style={[ui.screen(theme), { flex: 1 }]} edges={['top']}>
        <ScreenHeader title="Product" onBack={() => router.back()} />
        <ActivityIndicator color={theme.primary} style={{ marginTop: spacing.xl }} />
      </SafeAreaView>
    );
  }

  if (!provider || !product) {
    return (
      <SafeAreaView style={[ui.screen(theme), { flex: 1 }]} edges={['top']}>
        <ScreenHeader title="Product" onBack={() => router.back()} />
        <Text style={[ui.errorText(theme), { margin: spacing.md }]}>{error || 'Product not found'}</Text>
      </SafeAreaView>
    );
  }

  const lineTotal = product.price * qty;
  const stockQty = product.stockQty;
  const outOfStock = stockQty != null && Number.isFinite(Number(stockQty)) && Number(stockQty) <= 0;

  return (
    <SafeAreaView style={[ui.screen(theme), { flex: 1 }]} edges={['top']}>
      <ScreenHeader title={product.name} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing['3xl'] }} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroImgWrap, { backgroundColor: theme.secondary }]}>
          {product.imageUrl ? (
            <Image source={{ uri: product.imageUrl }} style={styles.heroImg} resizeMode="cover" />
          ) : (
            <View style={[styles.heroImgPh, { backgroundColor: theme.card }]}>
              <Ionicons name="medkit-outline" size={48} color={theme.subtleText} />
            </View>
          )}
        </View>

        <View style={{ padding: spacing.lg }}>
          <Text style={[styles.title, { color: theme.text }]}>{product.name}</Text>
          <Text style={[styles.price, { color: theme.primary }]}>
            {product.price > 0 ? `₦${product.price.toLocaleString()}` : 'Free'}
          </Text>
          {product.description ? (
            <Text style={[ui.caption(theme), { marginTop: spacing.md, lineHeight: 22 }]}>{product.description}</Text>
          ) : null}

          <View style={[styles.sellerRow, { marginTop: spacing.lg }]}>
            <Ionicons name="person-circle-outline" size={20} color={theme.subtleText} />
            <Text style={[ui.caption(theme), { marginLeft: spacing.xs, flex: 1 }]} numberOfLines={1}>
              Sold by {provider.name}
            </Text>
          </View>

          <Text style={[ui.caption(theme), { marginTop: spacing.lg, color: theme.subtleText }]}>
            Wallet balance is charged first. Any shortfall opens a secure Interswitch payment to top up.
          </Text>

          {user?.accountType === 'patient' && token ? (
            <>
              {outOfStock ? (
                <Text style={[ui.caption(theme), { marginTop: spacing.md, color: theme.subtleText }]}>
                  Out of stock.
                </Text>
              ) : null}
              <Text style={[ui.caption(theme), { marginTop: spacing.lg, fontWeight: '700' }]}>Quantity</Text>
              <View style={styles.qtyRow}>
                <TouchableOpacity
                  style={[styles.qtyBtn, { borderColor: theme.border }]}
                  onPress={() => setQty((q) => Math.max(1, q - 1))}
                >
                  <Text style={{ color: theme.text, fontWeight: '900' }}>−</Text>
                </TouchableOpacity>
                <Text style={{ color: theme.text, fontWeight: '800', fontSize: 18, minWidth: 32, textAlign: 'center' }}>
                  {qty}
                </Text>
                <TouchableOpacity
                  style={[styles.qtyBtn, { borderColor: theme.border }]}
                  onPress={() => setQty((q) => Math.min(99, q + 1))}
                >
                  <Text style={{ color: theme.text, fontWeight: '900' }}>+</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.subtotal, { color: theme.text }]}>
                Subtotal: {lineTotal > 0 ? `₦${lineTotal.toLocaleString()}` : 'Free'}
              </Text>
              <TouchableOpacity
                style={[ui.buttonPrimary(theme), { marginTop: spacing.lg, borderRadius: radii.lg, minHeight: 52 }]}
                onPress={buyNow}
                  disabled={ordering || outOfStock}
              >
                <Text style={ui.buttonTextPrimary(theme)}>{ordering ? 'Processing…' : 'Buy now'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[ui.buttonOutline(theme), { marginTop: spacing.sm, borderRadius: radii.lg, minHeight: 52 }]}
                onPress={addItemToCart}
                disabled={ordering || outOfStock}
              >
                <Text style={ui.buttonText(theme)}>Add to cart</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={[ui.caption(theme), { marginTop: spacing.lg }]}>Sign in as a patient to purchase.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = {
  heroImgWrap: { width: '100%' },
  heroImg: { width: '100%', aspectRatio: 1, maxHeight: 360 },
  heroImgPh: { width: '100%', aspectRatio: 1, maxHeight: 360, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800' },
  price: { fontSize: 24, fontWeight: '900', marginTop: spacing.sm },
  sellerRow: { flexDirection: 'row', alignItems: 'center' },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  qtyBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtotal: { marginTop: spacing.md, fontWeight: '800', fontSize: 16 },
};
