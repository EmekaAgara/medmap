import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Linking,
  Image,
  Alert,
  Switch,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth, useThemeMode } from '../../_layout';
import ScreenHeader from '../../components/ScreenHeader';
import { apiRequest } from '../../../src/api/client';
import { ui, spacing } from '../../../theme/tokens';

function normalizeCatalogProducts(raw) {
  if (!raw?.length) return [];
  return raw
    .map((p) => {
      if (typeof p === 'string') {
        const t = p.trim();
        return t ? { name: t, price: 0 } : null;
      }
      if (p && typeof p === 'object' && p.name != null) {
        const name = String(p.name).trim();
        if (!name) return null;
        return { name, price: Math.max(0, Number(p.price) || 0) };
      }
      return null;
    })
    .filter(Boolean);
}

function serviceKey(name) {
  return `s:${encodeURIComponent(name)}`;
}

function productKey(p) {
  return `p:${encodeURIComponent(p.name)}:${p.price}`;
}

function labelForSelectionKey(key) {
  if (key.startsWith('s:')) return decodeURIComponent(key.slice(2));
  if (key.startsWith('p:')) {
    const rest = key.slice(2);
    const i = rest.lastIndexOf(':');
    if (i <= 0) return key;
    const name = decodeURIComponent(rest.slice(0, i));
    const price = Number(rest.slice(i + 1));
    const priceLabel = Number.isFinite(price) && price > 0 ? ` (₦${price.toLocaleString()})` : ' (free)';
    return `${name}${priceLabel}`;
  }
  return key;
}

function orderLinesFromSelectedKeys(selectedKeys) {
  return selectedKeys
    .filter((k) => k.startsWith('p:'))
    .map((k) => {
      const rest = k.slice(2);
      const i = rest.lastIndexOf(':');
      if (i <= 0) return null;
      const name = decodeURIComponent(rest.slice(0, i));
      if (!name) return null;
      return { name, quantity: 1 };
    })
    .filter(Boolean);
}

export default function ProviderDetailsScreen() {
  const { id } = useLocalSearchParams();
  const { token, user } = useAuth();
  const router = useRouter();
  const { theme } = useThemeMode();

  const [provider, setProvider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mine, setMine] = useState(null);
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [ordering, setOrdering] = useState(false);
  const [editProductName, setEditProductName] = useState('');
  const [editProductPrice, setEditProductPrice] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiRequest(`/providers/${id}`, { method: 'GET', token });
      setProvider(res.data || null);
    } catch (e) {
      setError(e.message || 'Could not load provider');
    } finally {
      setLoading(false);
    }
  };

  const loadMine = async () => {
    if (!token) return;
    try {
      const res = await apiRequest('/providers/mine', { method: 'GET', token });
      setMine(res.data || null);
    } catch (e) {
      // If user is not a provider owner, silently ignore.
      setMine(null);
    }
  };

  useEffect(() => {
    if (id) load();
  }, [id]);

  useEffect(() => {
    if (id && token) loadMine();
  }, [id, token]);

  const canManage = !!(provider && mine && String(mine._id) === String(provider._id));
  const canRequestItems = user?.accountType === 'patient' && !!provider?.canBook;
  const selectedSet = new Set(selectedItems);

  const catalog = useMemo(() => normalizeCatalogProducts(provider?.products || []), [provider?.products]);

  useEffect(() => {
    setSelectedItems([]);
  }, [provider?._id]);

  const toggleSelectedItem = (key) => {
    setSelectedItems((prev) => {
      if (prev.includes(key)) return prev.filter((x) => x !== key);
      return [...prev, key];
    });
  };

  const requestNote = selectedItems.length
    ? `Requested items: ${selectedItems.map(labelForSelectionKey).join(', ')}`
    : '';
  const selectedPreview = selectedItems.length
    ? `${selectedItems.slice(0, 3).map(labelForSelectionKey).join(', ')}${
        selectedItems.length > 3 ? ` +${selectedItems.length - 3} more` : ''
      }`
    : 'None';

  const selectedOrderLines = useMemo(() => orderLinesFromSelectedKeys(selectedItems), [selectedItems]);

  const checkoutSelectedProducts = async () => {
    if (!token || !provider?._id) {
      Alert.alert('Sign in required', 'Log in to purchase products.');
      return;
    }
    if (!selectedOrderLines.length) {
      Alert.alert('Select products', 'Tap product pills to add them to your cart.');
      return;
    }
    try {
      setOrdering(true);
      const res = await apiRequest('/orders', {
        method: 'POST',
        token,
        body: { providerId: provider._id, lines: selectedOrderLines },
      });
      const pack = res.data;
      const order = pack?.order;
      const payment = pack?.payment;

      if (payment?.paymentLink) {
        Alert.alert(
          'Complete payment',
          'Your wallet balance was short. Add funds to finish checkout.',
          [
            { text: 'Later', style: 'cancel', onPress: () => order?._id && router.push({ pathname: '/(app)/orders/[id]', params: { id: String(order._id) } }) },
            {
              text: 'Pay now',
              onPress: () => {
                Linking.openURL(payment.paymentLink).catch(() => {});
                if (order?._id) {
                  router.push({ pathname: '/(app)/orders/[id]', params: { id: String(order._id) } });
                }
              },
            },
          ]
        );
        return;
      }

      if (order?._id) {
        Alert.alert('Order placed', payment?.method === 'wallet' ? 'Paid from your wallet.' : 'Your order is confirmed.', [
          { text: 'OK', onPress: () => router.push({ pathname: '/(app)/orders/[id]', params: { id: String(order._id) } }) },
        ]);
      }
    } catch (e) {
      Alert.alert('Checkout failed', e.message || 'Could not place order');
    } finally {
      setOrdering(false);
    }
  };

  useEffect(() => {
    if (!canManage || !provider) return;
    setEdit({
      isOpenNow: !!provider.isOpenNow,
      hourlyRate: provider.hourlyRate != null ? String(provider.hourlyRate) : '',
      workingHours: provider.workingHours || '',
      availabilityText: provider.availabilityText || '',
      services: (provider.services || []).join(', '),
      productRows: normalizeCatalogProducts(provider.products || []),
      imageUrl: provider.imageUrl || '',
    });
    setEditProductName('');
    setEditProductPrice('');
  }, [canManage, provider]);

  const saveMine = async () => {
    if (!canManage || !provider || !edit) return;
    try {
      setSaving(true);
      setError('');
      const location = provider.location?.coordinates;
      await apiRequest('/providers/mine', {
        method: 'POST',
        token,
        body: {
          providerType: provider.providerType,
          name: provider.name,
          description: provider.description,
          phone: provider.phone,
          city: provider.city,
          address: provider.address,
          imageUrl: edit.imageUrl.trim() || undefined,
          hourlyRate: edit.hourlyRate === '' ? 0 : Number(edit.hourlyRate),
          isOpenNow: edit.isOpenNow,
          workingHours: edit.workingHours.trim(),
          availabilityText: edit.availabilityText.trim(),
          services: edit.services.trim(),
          products: (edit.productRows || []).map((p) => ({ name: p.name, price: p.price })),
          location: location
            ? {
                longitude: Number(location[0]),
                latitude: Number(location[1]),
              }
            : undefined,
        },
      });
      await load();
      await loadMine();
    } catch (e) {
      setError(e.message || 'Unable to save listing');
    } finally {
      setSaving(false);
    }
  };

  const handleCall = async (phone) => {
    if (!phone) return;
    const url = `tel:${phone}`;
    if (await Linking.canOpenURL(url)) Linking.openURL(url);
  };

  const handleWhatsApp = async (phone) => {
    if (!phone) return;
    const digits = String(phone).replace(/[^\d]/g, '');
    // wa.me expects country code included; keep digits as-is.
    const url = `https://wa.me/${digits}`;
    if (await Linking.canOpenURL(url)) Linking.openURL(url);
  };

  const getInitials = (name) => {
    const parts = String(name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  };

  const handleChat = () => {
    if (!provider?.canChat) {
      Alert.alert(
        'Chat unavailable',
        'Chat becomes available after the provider has claimed and been approved.'
      );
      return;
    }
    router.push({
      pathname: '/(app)/provider-chat',
      params: { providerId: provider._id, providerName: provider.name },
    });
  };

  if (loading) {
    return (
      <View style={ui.screen(theme)}>
        <ActivityIndicator color={theme.primary} style={{ marginTop: spacing.lg }} />
      </View>
    );
  }

  if (!provider) {
    return (
      <View style={ui.screen(theme)}>
        <ScreenHeader title="Provider" onBack={() => router.back()} />
        <Text style={ui.errorText(theme)}>{error || 'Provider not found'}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={ui.screen(theme)} contentContainerStyle={{ paddingBottom: spacing['2xl'] }}>
      <ScreenHeader title={provider.name || 'Provider'} onBack={() => router.back()} />

      <View style={[ui.card(theme), { marginBottom: spacing.md, overflow: 'hidden' }]}>
        <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
          {provider.imageUrl ? (
            <Image
              source={{ uri: provider.imageUrl }}
              style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 1, borderColor: theme.border }}
            />
          ) : (
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                borderWidth: 1,
                borderColor: theme.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: theme.text, fontWeight: '800' }}>
                {getInitials(provider.name)}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800' }}>
              {provider.name}
            </Text>
            <Text style={[ui.caption(theme), { marginTop: 4 }]}>
              {provider.providerType} • {provider.city || 'Unknown city'}
            </Text>
            {provider.hourlyRate === 0 ? (
              <Text style={[ui.caption(theme), { marginTop: 4, fontWeight: '700' }]}>Free</Text>
            ) : provider.hourlyRate ? (
              <Text style={[ui.caption(theme), { marginTop: 4, fontWeight: '700' }]}>
                ₦{Number(provider.hourlyRate).toLocaleString()}/hour
              </Text>
            ) : null}
            <Text style={[ui.caption(theme), { marginTop: 4 }]}>
              {provider.isOpenNow ? 'Open now' : 'Closed'} • {provider.workingHours || 'Hours not set'}
            </Text>
          </View>
        </View>
      </View>

      {provider.availabilityText ? (
        <Text style={[ui.caption(theme), { marginBottom: spacing.md }]}>
          Availability: {provider.availabilityText}
        </Text>
      ) : null}

      <View style={[ui.card(theme), { marginBottom: spacing.md }]}>
        <Text style={[ui.h2(theme), { fontSize: 16, marginBottom: spacing.sm }]}>Services & products</Text>

        <Text style={[ui.caption(theme), { marginBottom: spacing.xs, fontWeight: '700' }]}>Services</Text>
        {provider.services?.length ? (
          <View style={styles.pillsWrap}>
            {provider.services.slice(0, 10).map((s) => {
              const sk = serviceKey(s);
              const selected = selectedSet.has(sk);
              const pillStyle = {
                borderColor: theme.border,
                backgroundColor: selected ? theme.primary + '22' : theme.secondary,
              };
              const inner = (
                <Text style={[styles.pillText, { color: theme.text }]} numberOfLines={1}>
                  {s}
                </Text>
              );

              return canRequestItems ? (
                <TouchableOpacity key={s} onPress={() => toggleSelectedItem(sk)} style={[styles.pill, pillStyle]}>
                  {inner}
                </TouchableOpacity>
              ) : (
                <View key={s} style={[styles.pill, pillStyle]}>
                  {inner}
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={ui.caption(theme)}>Not listed</Text>
        )}

        <View style={{ height: spacing.md }} />

        <Text style={[ui.caption(theme), { marginBottom: spacing.xs, fontWeight: '700' }]}>Products for sale</Text>
        {catalog.length ? (
          <View style={styles.pillsWrap}>
            {catalog.slice(0, 20).map((p) => {
              const pk = productKey(p);
              const selected = selectedSet.has(pk);
              const pillStyle = {
                borderColor: theme.border,
                backgroundColor: selected ? theme.primary + '22' : theme.secondary,
              };
              const label = p.price > 0 ? `${p.name} · ₦${p.price.toLocaleString()}` : `${p.name} · Free`;
              const inner = (
                <Text style={[styles.pillText, { color: theme.text }]} numberOfLines={2}>
                  {label}
                </Text>
              );

              return canRequestItems ? (
                <TouchableOpacity key={pk} onPress={() => toggleSelectedItem(pk)} style={[styles.pill, pillStyle]}>
                  {inner}
                </TouchableOpacity>
              ) : (
                <View key={pk} style={[styles.pill, pillStyle]}>
                  {inner}
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={ui.caption(theme)}>Not listed</Text>
        )}
      </View>

      {canRequestItems ? (
        <Text style={[ui.caption(theme), { marginBottom: spacing.md, fontWeight: '700' }]}>
          Selected: {selectedPreview}
        </Text>
      ) : null}

      {canManage && edit ? (
        <View style={[ui.card(theme), { marginBottom: spacing.md }]}>
          <Text style={[ui.h2(theme), { fontSize: 16, marginBottom: spacing.sm }]}>Manage listing</Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <Text style={ui.caption(theme)}>Open now</Text>
            <Switch value={edit.isOpenNow} onValueChange={(v) => setEdit((p) => ({ ...p, isOpenNow: v }))} />
          </View>

          <TextInput
            value={edit.hourlyRate}
            onChangeText={(t) => setEdit((p) => ({ ...p, hourlyRate: t }))}
            placeholder="Hourly rate (NGN)"
            keyboardType="numeric"
            placeholderTextColor={theme.subtleText}
            style={[ui.input(theme), { marginBottom: spacing.sm }]}
          />

          <TextInput
            value={edit.workingHours}
            onChangeText={(t) => setEdit((p) => ({ ...p, workingHours: t }))}
            placeholder="Working hours"
            placeholderTextColor={theme.subtleText}
            style={[ui.input(theme), { marginBottom: spacing.sm }]}
          />

          <TextInput
            value={edit.availabilityText}
            onChangeText={(t) => setEdit((p) => ({ ...p, availabilityText: t }))}
            placeholder="Availability note"
            placeholderTextColor={theme.subtleText}
            style={[ui.input(theme), { marginBottom: spacing.sm }]}
          />

          <TextInput
            value={edit.services}
            onChangeText={(t) => setEdit((p) => ({ ...p, services: t }))}
            placeholder="Services (comma separated)"
            placeholderTextColor={theme.subtleText}
            style={[ui.input(theme), { marginBottom: spacing.sm }]}
          />

          <Text style={[ui.caption(theme), { fontWeight: '700', marginBottom: spacing.xs }]}>Products (name & price)</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.sm }}>
            <TextInput
              value={editProductName}
              onChangeText={setEditProductName}
              placeholder="Product name"
              placeholderTextColor={theme.subtleText}
              style={[ui.input(theme), { flex: 1, minWidth: 120, marginBottom: 0 }]}
            />
            <TextInput
              value={editProductPrice}
              onChangeText={setEditProductPrice}
              placeholder="₦ (0 free)"
              placeholderTextColor={theme.subtleText}
              keyboardType="numeric"
              style={[ui.input(theme), { width: 96, marginBottom: 0 }]}
            />
            <TouchableOpacity
              style={[ui.buttonPrimary(theme)]}
              onPress={() => {
                const name = String(editProductName || '').trim();
                if (!name) return;
                const price = Math.max(0, Number(editProductPrice) || 0);
                setEdit((p) => ({
                  ...p,
                  productRows: [...(p.productRows || []), { name, price }],
                }));
                setEditProductName('');
                setEditProductPrice('');
              }}
            >
              <Text style={ui.buttonTextPrimary(theme)}>Add</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm }}>
            {(edit.productRows || []).map((p, i) => (
              <TouchableOpacity
                key={`${p.name}-${p.price}-${i}`}
                onPress={() =>
                  setEdit((prev) => ({
                    ...prev,
                    productRows: (prev.productRows || []).filter((_, idx) => idx !== i),
                  }))
                }
                style={[styles.pill, { borderColor: theme.border, backgroundColor: theme.secondary }]}
              >
                <Text style={[styles.pillText, { color: theme.text }]} numberOfLines={1}>
                  {p.name}
                  {p.price > 0 ? ` · ₦${p.price.toLocaleString()}` : ' · Free'} ×
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            value={edit.imageUrl}
            onChangeText={(t) => setEdit((p) => ({ ...p, imageUrl: t }))}
            placeholder="Profile image URL (optional)"
            placeholderTextColor={theme.subtleText}
            style={[ui.input(theme), { marginBottom: spacing.sm }]}
          />

          <TouchableOpacity style={[ui.buttonPrimary(theme), { marginTop: spacing.sm }]} onPress={saveMine} disabled={saving}>
            <Text style={ui.buttonTextPrimary(theme)}>{saving ? 'Saving...' : 'Save changes'}</Text>
          </TouchableOpacity>
          <Text style={[ui.caption(theme), { marginTop: spacing.xs }]}>Updates will be submitted for moderation.</Text>
        </View>
      ) : null}

      {canManage ? (
        <View style={[ui.card(theme), { marginBottom: spacing.md }]}>
          <Text style={[ui.h2(theme), { fontSize: 16, marginBottom: spacing.sm }]}>Manage appointments</Text>
          <Text style={[ui.caption(theme), { marginBottom: spacing.md }]}>
            Confirm or reschedule patient requests.
          </Text>
          <TouchableOpacity
            style={[ui.buttonOutline(theme), { alignSelf: 'flex-start' }]}
            onPress={() => router.push('/(app)/provider-appointments')}
          >
            <Text style={ui.buttonText(theme)}>Open provider inbox</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[ui.buttonOutline(theme), { alignSelf: 'flex-start', marginTop: spacing.sm }]}
            onPress={() => router.push('/(app)/provider-orders')}
          >
            <Text style={ui.buttonText(theme)}>Sales & orders</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={[ui.card(theme), { marginBottom: spacing.md }]}>
        <Text style={[ui.h2(theme), { fontSize: 16, marginBottom: spacing.sm }]}>Contact</Text>

        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
          <TouchableOpacity style={[ui.buttonOutline(theme), { flex: 1, minWidth: 120 }]} onPress={() => handleCall(provider.phone)}>
            <Text style={ui.buttonText(theme)}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[ui.buttonOutline(theme), { flex: 1, minWidth: 120 }]} onPress={() => handleWhatsApp(provider.phone)}>
            <Text style={ui.buttonText(theme)}>WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[ui.buttonOutline(theme), { flex: 1, minWidth: 120 }]} onPress={handleChat}>
            <Text style={ui.buttonText(theme)}>{provider.canChat ? 'Chat' : 'Chat (locked)'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {user?.accountType === 'patient' && selectedOrderLines.length > 0 ? (
        <TouchableOpacity
          style={[ui.buttonOutline(theme), { marginTop: spacing.md }]}
          onPress={checkoutSelectedProducts}
          disabled={ordering}
        >
          <Text style={ui.buttonText(theme)}>{ordering ? 'Checking out…' : 'Buy selected products'}</Text>
        </TouchableOpacity>
      ) : null}

      {user?.accountType === 'patient' && provider.canBook ? (
        <TouchableOpacity
          style={[ui.buttonPrimary(theme), { marginTop: spacing.md }]}
          onPress={() =>
            router.push({
              pathname: '/(app)/book-appointment',
              params: {
                providerId: provider._id,
                providerName: provider.name,
                ...(selectedItems.length ? { prefillNote: requestNote } : {}),
              },
            })
          }
        >
          <Text style={ui.buttonTextPrimary(theme)}>
            {selectedItems.length ? 'Book & request items' : 'Book appointment'}
          </Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

const styles = {
  pillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  pill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '100%',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
  },
};

