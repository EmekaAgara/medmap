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
  Platform,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth, useThemeMode } from '../../_layout';
import ScreenHeader from '../../components/ScreenHeader';
import { apiRequest } from '../../../src/api/client';
import { ui, spacing, radii, shadows } from '../../../theme/tokens';
import { normalizeCatalogProducts } from '../../../src/utils/catalog';

function serviceKey(name) {
  return `s:${encodeURIComponent(name)}`;
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

function providerLatLng(p) {
  const c = p?.location?.coordinates;
  if (!c || c.length < 2) return null;
  const lng = Number(c[0]);
  const lat = Number(c[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
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
  const [selectedServiceKeys, setSelectedServiceKeys] = useState([]);
  const [editProductName, setEditProductName] = useState('');
  const [editProductPrice, setEditProductPrice] = useState('');
  const [editProductDescription, setEditProductDescription] = useState('');
  const [editProductImageUrl, setEditProductImageUrl] = useState('');

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
  const serviceSelectSet = new Set(selectedServiceKeys);

  const catalog = useMemo(() => normalizeCatalogProducts(provider?.products || []), [provider?.products]);

  useEffect(() => {
    setSelectedServiceKeys([]);
  }, [provider?._id]);

  const toggleServiceKey = (sk) => {
    setSelectedServiceKeys((prev) => (prev.includes(sk) ? prev.filter((x) => x !== sk) : [...prev, sk]));
  };

  const appointmentServiceNote =
    selectedServiceKeys.length > 0
      ? `Services to discuss: ${selectedServiceKeys.map(labelForSelectionKey).join(', ')}`
      : '';

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
    setEditProductDescription('');
    setEditProductImageUrl('');
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
          products: (edit.productRows || []).map((p) => {
            const o = { name: p.name, price: p.price };
            if (p.description?.trim()) o.description = p.description.trim();
            if (p.imageUrl?.trim()) o.imageUrl = p.imageUrl.trim();
            return o;
          }),
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
      <SafeAreaView style={[ui.screen(theme), { flex: 1 }]} edges={['top']}>
        <ActivityIndicator color={theme.primary} style={{ marginTop: spacing.xl }} />
      </SafeAreaView>
    );
  }

  if (!provider) {
    return (
      <SafeAreaView style={[ui.screen(theme), { flex: 1 }]} edges={['top']}>
        <ScreenHeader title="Provider" onBack={() => router.back()} />
        <Text style={[ui.errorText(theme), { margin: spacing.md }]}>{error || 'Provider not found'}</Text>
      </SafeAreaView>
    );
  }

  const coords = providerLatLng(provider);
  const cardShadow = Platform.OS === 'ios' ? shadows.cardDark : { elevation: 5 };

  const goShop = () => {
    router.push({
      pathname: '/(app)/provider-shop/[providerId]',
      params: { providerId: String(provider._id) },
    });
  };

  return (
    <SafeAreaView style={[ui.screen(theme), { flex: 1 }]} edges={['top']}>
      <View
        style={{
          backgroundColor: theme.background,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
        }}
      >
        <ScreenHeader title={provider.name || 'Provider'} onBack={() => router.back()} />
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: spacing.md,
          paddingTop: spacing.md,
          paddingBottom: spacing['3xl'],
        }}
        showsVerticalScrollIndicator={false}
      >
      <View
        style={[
          {
            marginBottom: spacing.md,
            overflow: 'hidden',
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.card,
            padding: spacing.md,
          },
          cardShadow,
        ]}
      >
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
        <View
          style={[
            {
              marginBottom: spacing.md,
              padding: spacing.md,
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: theme.border,
              backgroundColor: theme.secondary,
            },
          ]}
        >
          <Text style={[ui.caption(theme), { fontWeight: '700', marginBottom: spacing.xs }]}>Availability</Text>
          <Text style={[ui.caption(theme)]}>{provider.availabilityText}</Text>
        </View>
      ) : null}

      {(provider.canBook || catalog.length > 0) && (
        <View
          style={[
            {
              marginBottom: spacing.lg,
              padding: spacing.md,
              borderRadius: radii.lg,
              borderWidth: 1,
              borderColor: theme.border,
              backgroundColor: theme.card,
            },
            cardShadow,
          ]}
        >
          <Text style={{ color: theme.text, fontWeight: '800', fontSize: 16, marginBottom: spacing.xs }}>
            Book or shop
          </Text>
          <Text style={[ui.caption(theme), { color: theme.subtleText, marginBottom: spacing.md }]}>
            Book a visit (wallet + Interswitch if the provider charges a fee). Browse the shop for products with photos
            and checkout details.
          </Text>
          <View style={{ gap: spacing.sm }}>
            {provider.canBook ? (
              <TouchableOpacity
                style={[ui.buttonPrimary(theme), { borderRadius: radii.lg, minHeight: 50, justifyContent: 'center' }]}
                onPress={() =>
                  router.push({
                    pathname: '/(app)/book-appointment',
                    params: {
                      providerId: provider._id,
                      providerName: provider.name,
                      ...(appointmentServiceNote ? { prefillNote: appointmentServiceNote } : {}),
                    },
                  })
                }
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}>
                  <Ionicons name="calendar" size={20} color={theme.primaryForeground} />
                  <Text adjustsFontSizeToFit style={ui.buttonTextPrimary(theme)}>Book appointment</Text>
                </View>
              </TouchableOpacity>
            ) : null}
            {catalog.length > 0 ? (
              <TouchableOpacity
                style={[
                  ui.buttonOutline(theme),
                  { borderRadius: radii.lg, minHeight: 50, justifyContent: 'center', borderWidth: 2 },
                ]}
                onPress={goShop}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}>
                  <Ionicons name="bag-handle-outline" size={22} color={theme.primary} />
                  <Text style={[ui.buttonText(theme), { color: theme.primary, fontWeight: '800' }]}>Go to shop</Text>
                </View>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      )}

      <View
        style={[
          {
            marginBottom: spacing.md,
            padding: spacing.md,
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.card,
          },
          cardShadow,
        ]}
      >
        <Text style={[ui.h2(theme), { fontSize: 16, marginBottom: spacing.sm }]}>Location</Text>
        {provider.address ? (
          <Text style={[ui.caption(theme), { marginBottom: spacing.xs }]}>{provider.address}</Text>
        ) : null}
        <Text style={[ui.caption(theme), { marginBottom: spacing.sm }]}>
          {[provider.city, provider.country].filter(Boolean).join(', ') || '—'}
        </Text>
        {coords ? (
          <>
            <Text style={[ui.caption(theme), { color: theme.subtleText, marginBottom: spacing.sm }]}>
              GPS: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </Text>
            <TouchableOpacity
              style={[ui.buttonOutline(theme), { alignSelf: 'flex-start' }]}
              onPress={() =>
                Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`).catch(
                  () => {}
                )
              }
            >
              <Text style={ui.buttonText(theme)}>Open in Maps</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={ui.caption(theme)}>Coordinates not available</Text>
        )}
      </View>

      <View
        style={[
          {
            marginBottom: spacing.md,
            padding: spacing.md,
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.card,
          },
          cardShadow,
        ]}
      >
        <Text style={[ui.h2(theme), { fontSize: 16, marginBottom: spacing.sm }]}>Services</Text>
        <Text style={[ui.caption(theme), { color: theme.subtleText, marginBottom: spacing.sm }]}>
          {canRequestItems ? 'Tap services you want mentioned when you book.' : 'Offered services'}
        </Text>
        {provider.services?.length ? (
          <View style={styles.pillsWrap}>
            {provider.services.slice(0, 16).map((s) => {
              const sk = serviceKey(s);
              const selected = serviceSelectSet.has(sk);
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
                <TouchableOpacity key={s} onPress={() => toggleServiceKey(sk)} style={[styles.pill, pillStyle]}>
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
      </View>

      {canManage && edit ? (
        <View
          style={[
            {
              marginBottom: spacing.md,
              padding: spacing.md,
              borderRadius: radii.lg,
              borderWidth: 1,
              borderColor: theme.border,
              backgroundColor: theme.card,
            },
            cardShadow,
          ]}
        >
          <Text style={[ui.h2(theme), { fontSize: 16, marginBottom: spacing.sm }]}>Manage listing & catalog</Text>

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

          <Text style={[ui.caption(theme), { fontWeight: '800', marginBottom: spacing.xs }]}>Products (shop)</Text>
          <Text style={[ui.caption(theme), { color: theme.subtleText, marginBottom: spacing.sm }]}>
            Optional image URL and description show on the storefront.
          </Text>
          <TextInput
            value={editProductName}
            onChangeText={setEditProductName}
            placeholder="Product name *"
            placeholderTextColor={theme.subtleText}
            style={[ui.input(theme), { marginBottom: spacing.sm }]}
          />
          <TextInput
            value={editProductPrice}
            onChangeText={setEditProductPrice}
            placeholder="Price ₦ (0 = free)"
            placeholderTextColor={theme.subtleText}
            keyboardType="numeric"
            style={[ui.input(theme), { marginBottom: spacing.sm }]}
          />
          <TextInput
            value={editProductDescription}
            onChangeText={setEditProductDescription}
            placeholder="Description (optional)"
            placeholderTextColor={theme.subtleText}
            multiline
            style={[ui.input(theme), { marginBottom: spacing.sm, minHeight: 72, textAlignVertical: 'top' }]}
          />
          <TextInput
            value={editProductImageUrl}
            onChangeText={setEditProductImageUrl}
            placeholder="Image URL (optional)"
            placeholderTextColor={theme.subtleText}
            autoCapitalize="none"
            style={[ui.input(theme), { marginBottom: spacing.md }]}
          />
          <TouchableOpacity
            onPress={() => {
              const name = String(editProductName || '').trim();
              if (!name) return;
              const price = Math.max(0, Number(editProductPrice) || 0);
              const row = { name, price };
              const d = String(editProductDescription || '').trim();
              const img = String(editProductImageUrl || '').trim();
              if (d) row.description = d;
              if (img) row.imageUrl = img;
              setEdit((p) => ({
                ...p,
                productRows: [...(p.productRows || []), row],
              }));
              setEditProductName('');
              setEditProductPrice('');
              setEditProductDescription('');
              setEditProductImageUrl('');
            }}
            activeOpacity={0.88}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.sm,
              backgroundColor: theme.primary,
              borderRadius: radii.lg,
              paddingVertical: spacing.md,
            }}
          >
            <Ionicons name="add-circle" size={22} color={theme.primaryForeground} />
            <Text style={{ color: theme.primaryForeground, fontWeight: '800', fontSize: 16 }}>Add to catalog</Text>
          </TouchableOpacity>
          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            {(edit.productRows || []).map((p, i) => (
              <TouchableOpacity
                key={`${p.name}-${p.price}-${i}`}
                onPress={() =>
                  setEdit((prev) => ({
                    ...prev,
                    productRows: (prev.productRows || []).filter((_, idx) => idx !== i),
                  }))
                }
                activeOpacity={0.85}
                style={{
                  borderWidth: 1,
                  borderColor: theme.border,
                  borderRadius: radii.md,
                  padding: spacing.sm,
                  backgroundColor: theme.secondary,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                }}
              >
                {p.imageUrl ? (
                  <Image source={{ uri: p.imageUrl }} style={{ width: 44, height: 44, borderRadius: radii.sm }} />
                ) : (
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: radii.sm,
                      backgroundColor: theme.card,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: theme.border,
                    }}
                  >
                    <Ionicons name="cube-outline" size={20} color={theme.subtleText} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontWeight: '800' }} numberOfLines={2}>
                    {p.name}
                  </Text>
                  <Text style={{ color: theme.primary, fontWeight: '700', marginTop: 2 }}>
                    {p.price > 0 ? `₦${p.price.toLocaleString()}` : 'Free'}
                  </Text>
                </View>
                <Ionicons name="close-circle" size={24} color={theme.subtleText} />
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
          {(edit.productRows || []).length > 0 ? (
            <TouchableOpacity
              style={[ui.buttonOutline(theme), { marginTop: spacing.sm, borderRadius: radii.lg }]}
              onPress={goShop}
            >
              <Text style={ui.buttonText(theme)}>Preview storefront</Text>
            </TouchableOpacity>
          ) : null}
          <Text style={[ui.caption(theme), { marginTop: spacing.xs }]}>
            Clinician listings usually go live immediately; admins can still review if needed.
          </Text>
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
      </ScrollView>
    </SafeAreaView>
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

