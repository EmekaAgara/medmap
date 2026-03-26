import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import { useAuth, useThemeMode } from '../_layout';
import { apiRequest } from '../../src/api/client';
import { presentOrderResult } from '../../src/utils/orderPay';
import { getCart, updateCartItem, clearCart } from '../../src/cart/cartStore';
import { ui, spacing, radii, typography } from '../../theme/tokens';

export default function CartScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { theme } = useThemeMode();
  const [cart, setCart] = useState({ items: [] });
  const [busy, setBusy] = useState(false);
  const [fulfillmentMethod, setFulfillmentMethod] = useState('pickup'); // pickup | delivery
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    const c = await getCart();
    setCart(c);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => {
    const items = cart?.items || [];
    const byProvider = new Map();
    for (const it of items) {
      const pid = String(it.providerId);
      if (!byProvider.has(pid)) byProvider.set(pid, []);
      byProvider.get(pid).push(it);
    }
    return Array.from(byProvider.entries()).map(([providerId, items]) => ({ providerId, items }));
  }, [cart]);

  const total = useMemo(() => {
    return (cart?.items || []).reduce((sum, it) => sum + (Number(it.unitPrice) || 0) * (Number(it.quantity) || 0), 0);
  }, [cart]);

  const updateQty = async (providerId, name, nextQty) => {
    const next = await updateCartItem({ providerId, name, quantity: nextQty });
    setCart(next);
  };

  const checkout = async () => {
    if (!token) {
      Alert.alert('Sign in', 'Log in to checkout.');
      return;
    }
    if (grouped.length !== 1) {
      Alert.alert('Cart', 'Checkout supports one provider at a time. Remove items from other shops.');
      return;
    }
    const g = grouped[0];
    const lines = (g.items || []).map((it) => ({ name: it.name, quantity: it.quantity }));
    if (!lines.length) return;
    if (fulfillmentMethod === 'delivery' && !address.trim()) {
      Alert.alert('Delivery', 'Enter your delivery address.');
      return;
    }

    try {
      setBusy(true);
      const res = await apiRequest('/orders', {
        method: 'POST',
        token,
        body: {
          providerId: g.providerId,
          lines,
          fulfillment: {
            method: fulfillmentMethod,
            address: address.trim() || undefined,
            phone: phone.trim() || undefined,
            notes: notes.trim() || undefined,
          },
        },
      });

      presentOrderResult({
        pack: res.data,
        router,
        token,
        clearCart: async () => {
          await clearCart();
          setCart({ items: [] });
        },
      });
    } catch (e) {
      if (e?.details?.requiresPrescription) {
        router.push({
          pathname: '/(app)/prescription-upload',
          params: {
            providerId: String(g.providerId),
            payload: JSON.stringify({
              providerId: g.providerId,
              lines,
              fulfillment: {
                method: fulfillmentMethod,
                address: address.trim() || undefined,
                phone: phone.trim() || undefined,
                notes: notes.trim() || undefined,
              },
            }),
          },
        });
        return;
      }
      Alert.alert('Checkout', e.message || 'Could not checkout');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={ui.screen(theme)} edges={['top']}>
      <ScreenHeader title="Cart" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing['3xl'] }}>
        {!cart?.items?.length ? (
          <View style={[ui.card(theme), { padding: spacing.lg, alignItems: 'center' }]}>
            <Ionicons name="cart-outline" size={34} color={theme.subtleText} />
            <Text style={[ui.caption(theme), { marginTop: spacing.sm }]}>Your cart is empty.</Text>
          </View>
        ) : (
          <>
            {grouped.length > 1 ? (
              <Text style={[ui.caption(theme), { color: theme.subtleText, marginBottom: spacing.sm }]}>
                You have items from multiple shops. Checkout supports one provider at a time.
              </Text>
            ) : null}

            {(grouped || []).map((g) => (
              <View key={g.providerId} style={{ marginBottom: spacing.lg }}>
                <Text style={[ui.caption(theme), { fontFamily: typography.fontFamilySemiBold, marginBottom: spacing.sm }]}>
                  Provider: {g.providerId}
                </Text>
                {(g.items || []).map((it) => (
                  <View key={`${g.providerId}:${it.name}`} style={[ui.card(theme), { padding: spacing.md, marginBottom: spacing.sm }]}>
                    <Text style={[ui.caption(theme), { fontFamily: typography.fontFamilySemiBold }]}>{it.name}</Text>
                    <Text style={[ui.caption(theme), { marginTop: 2, color: theme.subtleText }]}>
                      ₦{Number(it.unitPrice || 0).toLocaleString()} × {Number(it.quantity || 1)}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                      <TouchableOpacity
                        style={[ui.buttonOutline(theme), { paddingHorizontal: spacing.md }]}
                        onPress={() => updateQty(g.providerId, it.name, Math.max(0, Number(it.quantity || 1) - 1))}
                      >
                        <Text style={ui.buttonText(theme)}>−</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[ui.buttonOutline(theme), { paddingHorizontal: spacing.md }]}
                        onPress={() => updateQty(g.providerId, it.name, Math.min(99, Number(it.quantity || 1) + 1))}
                      >
                        <Text style={ui.buttonText(theme)}>+</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[ui.buttonSecondary(theme), { paddingHorizontal: spacing.md }]}
                        onPress={() => updateQty(g.providerId, it.name, 0)}
                      >
                        <Text style={ui.buttonText(theme)}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ))}

            <View style={[ui.card(theme), { padding: spacing.lg }]}>
              <Text style={[ui.caption(theme), { fontFamily: typography.fontFamilySemiBold }]}>Fulfillment</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                <TouchableOpacity
                  style={[
                    ui.buttonOutline(theme),
                    fulfillmentMethod === 'pickup' ? { borderColor: theme.primary } : null,
                  ]}
                  onPress={() => setFulfillmentMethod('pickup')}
                >
                  <Text style={ui.buttonText(theme)}>Pickup</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    ui.buttonOutline(theme),
                    fulfillmentMethod === 'delivery' ? { borderColor: theme.primary } : null,
                  ]}
                  onPress={() => setFulfillmentMethod('delivery')}
                >
                  <Text style={ui.buttonText(theme)}>Delivery</Text>
                </TouchableOpacity>
              </View>

              {fulfillmentMethod === 'delivery' ? (
                <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                  <TextInput
                    placeholder="Delivery address"
                    placeholderTextColor={theme.subtleText}
                    value={address}
                    onChangeText={setAddress}
                    style={{
                      borderWidth: 1,
                      borderColor: theme.border,
                      borderRadius: radii.lg,
                      padding: spacing.md,
                      color: theme.text,
                    }}
                  />
                  <TextInput
                    placeholder="Phone (optional)"
                    placeholderTextColor={theme.subtleText}
                    value={phone}
                    onChangeText={setPhone}
                    style={{
                      borderWidth: 1,
                      borderColor: theme.border,
                      borderRadius: radii.lg,
                      padding: spacing.md,
                      color: theme.text,
                    }}
                  />
                </View>
              ) : null}

              <TextInput
                placeholder="Notes (optional)"
                placeholderTextColor={theme.subtleText}
                value={notes}
                onChangeText={setNotes}
                style={{
                  borderWidth: 1,
                  borderColor: theme.border,
                  borderRadius: radii.lg,
                  padding: spacing.md,
                  color: theme.text,
                  marginTop: spacing.md,
                }}
              />

              <Text style={[ui.caption(theme), { marginTop: spacing.md }]}>
                Total: <Text style={{ fontFamily: typography.fontFamilySemiBold }}>₦{Number(total || 0).toLocaleString()}</Text>
              </Text>

              <TouchableOpacity style={[ui.buttonPrimary(theme), { marginTop: spacing.lg }]} onPress={checkout} disabled={busy}>
                <Text style={ui.buttonTextPrimary(theme)}>{busy ? 'Processing…' : 'Checkout'}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

