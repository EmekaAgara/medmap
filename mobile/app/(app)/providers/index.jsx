import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
  Image,
  TextInput,
  Modal,
  ScrollView,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useAuth, useThemeMode } from '../../_layout';
import ScreenHeader from '../../components/ScreenHeader';
import { apiRequest } from '../../../src/api/client';
import { ui, spacing } from '../../../theme/tokens';

const PAGE_LIMIT = 100;

function getInitials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatEtaFromKm(distanceKm) {
  if (distanceKm == null || !Number.isFinite(Number(distanceKm))) return null;
  const mins = Math.max(1, Math.round(Number(distanceKm) * 2));
  return `${mins}m`;
}

export default function ProvidersPage() {
  const router = useRouter();
  const { token, user } = useAuth();
  const { theme } = useThemeMode();

  const [type, setType] = useState('');
  const [searchText, setSearchText] = useState('');
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [providerTypeModalOpen, setProviderTypeModalOpen] = useState(false);
  const [providers, setProviders] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userCoords, setUserCoords] = useState(null);

  const typeRef = useRef(type);
  const searchRef = useRef(searchText);
  typeRef.current = type;
  searchRef.current = searchText;

  const providerTypes = useMemo(
    () => [
      { value: '', label: 'All' },
      { value: 'doctor', label: 'Doctors' },
      { value: 'pharmacy', label: 'Pharmacies' },
      { value: 'hospital', label: 'Hospitals' },
    ],
    []
  );

  const providerTypeLabel = providerTypes.find((p) => p.value === type)?.label || 'All';

  const fetchProviders = useCallback(
    async (pageToFetch = 1, { append = false } = {}) => {
      try {
        setLoading(!append);
        setError('');
        const params = new URLSearchParams();
        params.set('limit', String(PAGE_LIMIT));
        params.set('page', String(pageToFetch));

        if (typeRef.current) params.set('type', typeRef.current);
        if (searchRef.current.trim()) params.set('search', searchRef.current.trim());
        if (openNowOnly) params.set('openNow', 'true');

        if (userCoords) {
          params.set('latitude', String(userCoords.latitude));
          params.set('longitude', String(userCoords.longitude));
          params.set('radiusKm', String(50000));
        }

        const res = await apiRequest(`/providers?${params.toString()}`, {
          method: 'GET',
          token,
        });

        const items = res.data || [];
        if (append) setProviders((prev) => [...prev, ...items]);
        else setProviders(items);
        setHasMore(items.length === PAGE_LIMIT);
      } catch (e) {
        setError(e.message || 'Could not load providers');
      } finally {
        setLoading(false);
      }
    },
    [token, openNowOnly, userCoords]
  );

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setUserCoords(null);
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      } catch {
        setUserCoords(null);
      }
    })();
  }, []);

  useEffect(() => {
    if (!token) return;
    if (!userCoords) return;
    setPage(1);
    fetchProviders(1, { append: false });
  }, [token, userCoords, type, searchText, openNowOnly, fetchProviders]);

  const handleCall = async (phone) => {
    if (!phone) return;
    const url = `tel:${phone}`;
    await Linking.openURL(url);
  };

  const handleWhatsApp = async (phone) => {
    if (!phone) return;
    const digits = String(phone).replace(/[^\d]/g, '');
    const url = `https://wa.me/${digits}`;
    await Linking.openURL(url);
  };

  return (
    <SafeAreaView style={ui.screen(theme)} edges={['top']}>
      <ScreenHeader title="Providers" />

      <ScrollView contentContainerStyle={{ paddingBottom: spacing['2xl'] }} showsVerticalScrollIndicator={false}>
        <View style={[ui.card(theme), { padding: spacing.md, marginBottom: spacing.md }]}>
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search provider or service"
            placeholderTextColor={theme.subtleText}
            style={ui.input(theme)}
          />

          <View style={{ marginTop: spacing.sm, flexDirection: 'row', gap: spacing.sm }}>
            <TouchableOpacity
              style={[ui.buttonOutline(theme), styles.providerTypeDropdown, { flex: 1 }]}
              onPress={() => setProviderTypeModalOpen(true)}
            >
              <Text style={ui.buttonText(theme)} numberOfLines={1}>
                {providerTypeLabel}
              </Text>
              <Ionicons name="chevron-down" size={16} color={theme.subtleText} />
            </TouchableOpacity>

            <View style={[styles.openNowRow, { borderColor: theme.border }]}>
              <Text style={{ color: theme.subtleText, fontSize: 12 }}>{openNowOnly ? 'Open' : 'Any'}</Text>
              <Switch
                value={openNowOnly}
                onValueChange={(v) => setOpenNowOnly(v)}
                trackColor={{ false: theme.border, true: theme.primary + '88' }}
                thumbColor={openNowOnly ? theme.primary : theme.subtleText}
              />
            </View>
          </View>
        </View>

        <Modal
          visible={providerTypeModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setProviderTypeModalOpen(false)}
        >
          <TouchableOpacity
            style={styles.providerTypeModalOverlay}
            activeOpacity={1}
            onPress={() => setProviderTypeModalOpen(false)}
          />
          <View style={[styles.providerTypeModalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {providerTypes.map((p) => {
              const active = p.value === type;
              return (
                <TouchableOpacity
                  key={p.value || 'all'}
                  style={[
                    styles.providerTypeModalOption,
                    active ? { backgroundColor: theme.primary + '10' } : null,
                  ]}
                  onPress={() => {
                    setType(p.value);
                    setPage(1);
                    setProviderTypeModalOpen(false);
                  }}
                >
                  <Text style={{ color: theme.text, fontWeight: active ? '800' : '600' }}>{p.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Modal>

        <View style={{ flex: 1 }}>
            {loading ? <ActivityIndicator color={theme.primary} style={{ marginTop: spacing.lg }} /> : null}
            {error ? <Text style={ui.errorText(theme)}>{error}</Text> : null}
            {!loading && !providers.length ? <Text style={ui.caption(theme)}>No providers found.</Text> : null}

            {providers.map((p) => (
              <View key={p._id} style={[ui.card(theme), { marginBottom: spacing.md, padding: spacing.md }]}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() =>
                    router.push({
                      pathname: '/(app)/provider-details/[id]',
                      params: { id: String(p._id) },
                    })
                  }
                >
                  <View style={styles.cardHeader}>
                    {p.imageUrl ? (
                      <Image source={{ uri: p.imageUrl }} style={styles.avatar} />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Text style={{ color: theme.text, fontWeight: '800' }}>{getInitials(p.name)}</Text>
                      </View>
                    )}

                    <View style={{ flex: 1 }}>
                      <Text style={[styles.providerName, { color: theme.text }]} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <Text style={[ui.caption(theme), styles.meta]} numberOfLines={1}>
                        {p.providerType} • {p.city || '—'}
                      </Text>
                      {p.hourlyRate === 0 ? (
                        <Text style={[ui.caption(theme), styles.meta]}>Free</Text>
                      ) : p.hourlyRate ? (
                        <Text style={[ui.caption(theme), styles.meta]}>
                          ₦{Number(p.hourlyRate).toLocaleString()}/hr
                        </Text>
                      ) : null}
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.badge, { color: p.isOpenNow ? theme.success : theme.error }]}>
                        {p.isOpenNow ? 'Open' : 'Closed'}
                      </Text>
                      {p.distanceKm != null ? (
                        <Text style={[ui.caption(theme), styles.meta]}>
                          {p.distanceKm} km • ETA ~{formatEtaFromKm(p.distanceKm)}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={{ marginTop: spacing.sm }}>
                    {p.services?.length ? (
                      <Text style={[ui.caption(theme), styles.meta]} numberOfLines={1}>
                        Services: {p.services.slice(0, 3).join(', ')}
                      </Text>
                    ) : null}
                    {p.products?.length ? (
                      <Text style={[ui.caption(theme), styles.meta]} numberOfLines={1}>
                        Products: {p.products.slice(0, 3).join(', ')}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm }}>
                  <TouchableOpacity style={[ui.buttonOutline(theme), styles.actionBtn]} onPress={() => handleCall(p.phone)}>
                    <Ionicons name="call-outline" size={16} color={theme.text} />
                    <Text style={ui.buttonText(theme)}>Call</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[ui.buttonOutline(theme), styles.actionBtn]}
                    onPress={() => handleWhatsApp(p.phone)}
                  >
                    <Ionicons name="logo-whatsapp" size={16} color={theme.text} />
                    <Text style={ui.buttonText(theme)}>WhatsApp</Text>
                  </TouchableOpacity>

                  {user?.accountType === 'patient' && p.canBook ? (
                    <TouchableOpacity
                      style={[ui.buttonPrimary(theme), styles.actionBtnPrimary]}
                      onPress={() =>
                        router.push({
                          pathname: '/(app)/book-appointment',
                          params: { providerId: p._id, providerName: p.name },
                        })
                      }
                    >
                      <Text style={ui.buttonTextPrimary(theme)}>{p.hourlyRate === 0 ? 'Free Book' : 'Book'}</Text>
                    </TouchableOpacity>
                  ) : null}

                  {p.canChat ? (
                    <TouchableOpacity
                      style={[ui.buttonOutline(theme), styles.actionBtn]}
                      onPress={() =>
                        router.push({
                          pathname: '/(app)/provider-chat',
                          params: { providerId: p._id, providerName: p.name },
                        })
                      }
                    >
                      <Ionicons name="chatbubble-outline" size={16} color={theme.text} />
                      <Text style={ui.buttonText(theme)}>Chat</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ))}

            <TouchableOpacity
              style={[ui.buttonOutline(theme), styles.loadMoreBtn]}
              disabled={loading || !hasMore}
              onPress={() => {
                const next = page + 1;
                setPage(next);
                fetchProviders(next, { append: true });
              }}
            >
              <Text style={ui.buttonText(theme)}>{loading ? 'Loading...' : hasMore ? 'Load more' : 'End'}</Text>
            </TouchableOpacity>
          </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = {
  layout: { flexDirection: 'row', gap: spacing.md },
  sideBar: { width: 150, paddingTop: spacing.sm },
  filterChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  cardHeader: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerName: { fontSize: 16, fontWeight: '700' },
  meta: { marginTop: spacing.xs },
  badge: { fontSize: 12, fontWeight: '700' },
  openNowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    height: 42,
  },
  providerTypeDropdown: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, height: 42 },
  providerTypeModalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  providerTypeModalCard: { marginHorizontal: spacing.lg, marginTop: 120, borderWidth: 1, borderRadius: 16, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm },
  providerTypeModalOption: { paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderRadius: 12 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    height: 38,
  },
  actionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    height: 38,
  },
  loadMoreBtn: { marginTop: spacing.lg, marginBottom: spacing['2xl'], alignSelf: 'center' },
};

