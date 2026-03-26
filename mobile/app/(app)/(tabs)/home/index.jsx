import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Switch,
  Alert,
  Image,
  Modal,
  Platform,
} from 'react-native';
import * as Location from 'expo-location';
import { useThemeMode } from '../../../_layout';
import { useAuth } from '../../../_layout';
import { apiRequest } from '../../../../src/api/client';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ui, spacing, radii, typography, shadows } from '../../../../theme/tokens';
import ScreenHeader from '../../../components/ScreenHeader';

const PAGE_LIMIT = 10;

function productPreviewLabel(p) {
  if (p == null) return '';
  if (typeof p === 'string') return p;
  if (typeof p === 'object' && p.name != null) {
    const pr = Math.max(0, Number(p.price) || 0);
    return pr > 0 ? `${p.name} (₦${pr.toLocaleString()})` : `${p.name} (free)`;
  }
  return '';
}

function getInitials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function appointmentStatusLabel(s) {
  if (s === 'pending') return 'Awaiting provider';
  if (s === 'confirmed') return 'Confirmed';
  if (s === 'rejected') return 'Declined';
  if (s === 'cancelled') return 'Cancelled';
  return s;
}

export default function HomeScreen() {
  const { theme } = useThemeMode();
  const { token, user } = useAuth();
  const router = useRouter();
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [claimingProviderId, setClaimingProviderId] = useState('');
  const [radiusKm] = useState(50000);
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [userCoords, setUserCoords] = useState(null);
  const [locationLabel, setLocationLabel] = useState('');
  const [appointments, setAppointments] = useState([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [appointmentsError, setAppointmentsError] = useState('');
  const [providerTypeModalOpen, setProviderTypeModalOpen] = useState(false);

  const typeRef = useRef(type);
  const searchRef = useRef(search);
  typeRef.current = type;
  searchRef.current = search;
  const searchDebounceRef = useRef(null);

  const providerTypes = useMemo(
    () => [
      { value: '', label: 'All' },
      { value: 'doctor', label: 'Doctors' },
      { value: 'pharmacy', label: 'Pharmacies' },
      { value: 'hospital', label: 'Hospitals' },
    ],
    []
  );

  const providerTypeLabel =
    providerTypes.find((p) => p.value === type)?.label || 'All';

  const fetchProviders = useCallback(
    async (
      selectedType = typeRef.current,
      currentSearch = searchRef.current,
      pageToFetch = 1,
      { append = false, openNowOnlyOverride = null } = {}
    ) => {
      try {
        setLoading(!append);
        setError('');
        const params = new URLSearchParams();
        params.set('limit', String(PAGE_LIMIT));
        params.set('page', String(pageToFetch));
        if (selectedType) params.set('type', selectedType);
        if (currentSearch.trim()) params.set('search', currentSearch.trim());
        const openNowValue = openNowOnlyOverride === null ? openNowOnly : openNowOnlyOverride;
        if (openNowValue) params.set('openNow', 'true');
        if (userCoords) {
          params.set('latitude', String(userCoords.latitude));
          params.set('longitude', String(userCoords.longitude));
          params.set('radiusKm', String(radiusKm));
        }

        const res = await apiRequest(`/providers?${params.toString()}`, {
          method: 'GET',
          token,
        });

        const items = res.data || [];
        if (append) setProviders((prev) => [...prev, ...items]);
        else setProviders(items);
      } catch (e) {
        setError(e.message || 'Could not load providers');
      } finally {
        setLoading(false);
      }
    },
    [token, openNowOnly, userCoords, radiusKm]
  );

  useEffect(() => {
    fetchProviders(typeRef.current, searchRef.current, 1);
  }, []);

  const requestLocationAndSearch = async () => {
    try {
      setError('');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationLabel('Location denied — showing all results');
        setUserCoords(null);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setUserCoords(coords);
      setLocationLabel('Showing the 10 nearest providers by distance');
    } catch (e) {
      setError(e.message || 'Could not get location');
    }
  };

  useEffect(() => {
    // Auto-load coordinates so distance sorting "just works".
    requestLocationAndSearch();
  }, []);

  useEffect(() => {
    // Re-fetch to sort by distance once we have coordinates.
    if (userCoords) {
      fetchProviders(typeRef.current, searchRef.current, 1);
    }
  }, [userCoords]);

  useEffect(() => {
    // Debounced search so typing doesn't spam the API.
    if (!search && !type) {
      // Still refresh because openNowOnly might have changed earlier.
    }
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      fetchProviders(typeRef.current, search, 1);
    }, 400);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [search]);

  useEffect(() => {
    if (user?.accountType !== 'patient') {
      setAppointments([]);
      return;
    }
    if (!token) return;
    (async () => {
      try {
        setAppointmentsLoading(true);
        setAppointmentsError('');
        const res = await apiRequest('/appointments/mine/patient', { method: 'GET', token });
        setAppointments(res.data || []);
      } catch (e) {
        setAppointmentsError(e.message || 'Could not load appointments');
      } finally {
        setAppointmentsLoading(false);
      }
    })();
  }, [token, user?.accountType]);

  const handleCall = async (phone) => {
    if (!phone) return;
    const url = `tel:${phone}`;
    const can = await Linking.canOpenURL(url);
    if (can) await Linking.openURL(url);
  };

  const handleChat = async (provider) => {
    router.push({
      pathname: '/(app)/provider-chat',
      params: { providerId: provider._id, providerName: provider.name },
    });
  };

  const handleClaim = async (providerId) => {
    try {
      setClaimingProviderId(providerId);
      await apiRequest(`/providers/${providerId}/claim`, {
        method: 'POST',
        token,
      });
      Alert.alert('Claim submitted', 'An admin will review your request.');
      await fetchProviders();
    } catch (e) {
      setError(e.message || 'Unable to claim provider');
    } finally {
      setClaimingProviderId('');
    }
  };

  const handleEmail = async (email) => {
    if (!email) return;
    const url = `mailto:${encodeURIComponent(email)}`;
    const can = await Linking.canOpenURL(url);
    if (can) await Linking.openURL(url);
  };

  const handleSms = async (phone) => {
    if (!phone) return;
    const url = `sms:${phone}`;
    const can = await Linking.canOpenURL(url);
    if (can) await Linking.openURL(url);
  };

  const quickActions = [];
  if (user?.accountType && user.accountType !== 'patient') {
    quickActions.push({
      key: 'requests',
      label: 'Requests',
      icon: 'time-outline',
      color: theme.text,
      onPress: () => router.push('/(app)/provider-appointments'),
    });
    quickActions.push({
      key: 'listing',
      label: 'Manage',
      icon: 'briefcase-outline',
      color: theme.text,
      onPress: () => router.push('/(app)/provider-listing'),
    });
  }

  quickActions.push({
    key: 'explore',
    label: 'Explore',
    icon: 'map-outline',
    color: theme.text,
    onPress: () => router.push('/(tabs)/explore'),
  });
  quickActions.push({
    key: 'urgent',
    label: 'Urgent',
    icon: 'warning-outline',
    color: theme.error,
    onPress: () => router.push('/(tabs)/home/urgent'),
  });
  quickActions.push({
    key: 'messages',
    label: 'Messages',
    icon: 'chatbubble-outline',
    color: theme.text,
    onPress: () => router.push('/(tabs)/messages'),
  });
  quickActions.push({
    key: 'notifications',
    label: 'Alerts',
    icon: 'notifications-outline',
    color: theme.text,
    onPress: () => router.push('/(tabs)/notifications'),
  });

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.background, paddingHorizontal: spacing.md }}
      edges={['top']}
    >
      <View style={[styles.headerBar, { borderBottomColor: theme.border }]}>
        <Text style={[ui.h2(theme), styles.headerTitle]}>MedMap</Text>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/notifications')}
          style={[styles.headerNotifBtn, { borderColor: theme.border, backgroundColor: theme.secondary }]}
          hitSlop={10}
        >
          <Ionicons name="notifications-outline" size={22} color={theme.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={[ui.card(theme), { padding: spacing.lg }, styles.quickActionsCard]}>
          <View style={styles.quickActionsHeader}>
            <Text style={[ui.h2(theme), { fontSize: 16, marginBottom: spacing.xs }]}>Quick actions</Text>
            <Text style={[ui.caption(theme), { marginBottom: spacing.md }]}>
              Hello, {user?.fullName || user?.firstName || 'there'}.
            </Text>
          </View>

          <View style={styles.quickActionsRow}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.key}
                style={[styles.quickActionBtn, { borderColor: theme.border }]}
                onPress={action.onPress}
                activeOpacity={0.9}
              >
                <View style={[styles.quickActionIconWrap, { backgroundColor: theme.secondary }]}>
                  <Ionicons name={action.icon} size={22} color={theme.primary} />
                </View>
                <Text style={[styles.quickActionLabel, { color: theme.subtleText }]}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[ui.card(theme), { padding: spacing.lg }, styles.discoveryCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search provider or service"
            placeholderTextColor={theme.subtleText}
            style={ui.input(theme)}
          />

          {locationLabel ? (
            <Text style={[ui.caption(theme), { marginTop: spacing.sm, marginBottom: spacing.md }]}>{locationLabel}</Text>
          ) : null}

          <View style={styles.filterLayout}>
            <View style={styles.filterSidebar}>
              <View style={styles.filterLeft}>
                <Text style={[ui.caption(theme), { marginBottom: spacing.xs }]}>Provider type</Text>
                <TouchableOpacity
                  style={[ui.buttonOutline(theme), styles.providerTypeDropdown]}
                  onPress={() => setProviderTypeModalOpen(true)}
                  activeOpacity={0.9}
                >
                  <Text style={[ui.buttonText(theme), styles.providerTypeDropdownText]} numberOfLines={1}>
                    {providerTypeLabel}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={theme.subtleText} />
                </TouchableOpacity>
              </View>

              <View style={styles.filterRight}>
                <Text style={[ui.caption(theme), { marginBottom: spacing.xs }]}>Open now</Text>
                <View style={[styles.openNowRow, { borderColor: theme.border }]}>
                  <Text style={{ color: theme.subtleText, fontSize: 12 }}>{openNowOnly ? 'Open' : 'Any'}</Text>
                  <Switch
                    value={openNowOnly}
                    onValueChange={(v) => {
                      setOpenNowOnly(v);
                      fetchProviders(typeRef.current, searchRef.current, 1, { openNowOnlyOverride: v });
                    }}
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
                        fetchProviders(p.value, searchRef.current, 1);
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
              {loading ? (
                <ActivityIndicator color={theme.primary} style={{ marginTop: spacing.lg }} />
              ) : null}
              {error ? <Text style={ui.errorText(theme)}>{error}</Text> : null}

              {!loading && !providers.length ? (
                <Text style={ui.caption(theme)}>No providers found.</Text>
              ) : null}

              {providers.map((provider) => {
                const cardLift = Platform.OS === 'ios' ? shadows.cardDark : { elevation: 4 };
                return (
                <TouchableOpacity
                  key={provider._id}
                  activeOpacity={0.9}
                  style={[
                    {
                      padding: spacing.md,
                      marginBottom: spacing.md,
                      borderRadius: radii.lg,
                      borderWidth: 1,
                      borderColor: theme.border,
                      backgroundColor: theme.card,
                    },
                    cardLift,
                  ]}
                  onPress={() =>
                    router.push({
                      pathname: '/(app)/provider-details/[id]',
                      params: { id: String(provider._id) },
                    })
                  }
                >
                  <View style={styles.cardHeader}>
                    {provider.imageUrl ? (
                      <Image source={{ uri: provider.imageUrl }} style={styles.avatar} />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Text style={{ color: theme.text, fontWeight: '800' }}>{getInitials(provider.name)}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.providerName, { color: theme.text }]}>{provider.name}</Text>
                      <Text style={[ui.caption(theme), styles.meta]}>{provider.providerType}</Text>
                      {provider.hourlyRate === 0 ? (
                        <Text style={[ui.caption(theme), styles.meta]}>Free</Text>
                      ) : provider.hourlyRate ? (
                        <Text style={[ui.caption(theme), styles.meta]}>
                          ₦{Number(provider.hourlyRate).toLocaleString()}/hr
                        </Text>
                      ) : null}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.badge, { color: provider.isOpenNow ? theme.success : theme.error }]}>
                        {provider.isOpenNow ? 'Open' : 'Closed'}
                      </Text>
                      {provider.distanceKm != null ? (
                        <Text style={[ui.caption(theme), styles.meta]}>
                          {provider.distanceKm} km • ETA ~{Math.max(1, Math.round(provider.distanceKm * 2))}m
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.cardMetaBlock}>
                    {provider.services?.length ? (
                      <Text style={[ui.caption(theme), styles.metaLine]} numberOfLines={1}>
                        Services: {provider.services.slice(0, 2).join(', ')}
                      </Text>
                    ) : null}

                    {provider.products?.length ? (
                      <Text style={[ui.caption(theme), styles.metaLine]} numberOfLines={1}>
                        Products:{' '}
                        {provider.products
                          .slice(0, 2)
                          .map(productPreviewLabel)
                          .filter(Boolean)
                          .join(', ')}
                      </Text>
                    ) : null}
                  </View>

                  {user?.accountType === 'patient' && provider.canBook ? (
                    <View style={styles.cardActionsRow}>
                      <TouchableOpacity
                        style={[ui.buttonPrimary(theme), styles.cardActionBtnPrimary]}
                        onPress={() =>
                          router.push({
                            pathname: '/(app)/book-appointment',
                            params: { providerId: provider._id, providerName: provider.name },
                          })
                        }
                      >
                        <Text style={ui.buttonTextPrimary(theme)}>
                          {provider.hourlyRate === 0 ? 'Free Book' : 'Book'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );})}

              <TouchableOpacity
                style={[ui.buttonOutline(theme), styles.viewAllBtn]}
                onPress={() => router.push('/(app)/providers')}
              >
                <Text style={ui.buttonText(theme)}>Browse all providers (paginated)</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        {user?.accountType === 'patient' ? (
          <View style={[ui.card(theme), styles.appointmentsCard, { padding: spacing.lg }]}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[ui.h2(theme), { fontSize: 16 }]}>My appointments</Text>
              <TouchableOpacity onPress={() => router.push('/(app)/appointments')}>
                <Text style={{ color: theme.primary, fontWeight: '700' }}>View all</Text>
              </TouchableOpacity>
            </View>

            {appointmentsLoading ? (
              <ActivityIndicator color={theme.primary} style={{ marginTop: spacing.md }} />
            ) : null}

            {appointmentsError ? <Text style={ui.errorText(theme)}>{appointmentsError}</Text> : null}

            {!appointmentsLoading && appointments.length === 0 ? (
              <Text style={[ui.caption(theme), { marginTop: spacing.sm }]}>No appointments yet.</Text>
            ) : null}

            {appointments.slice(0, 2).map((a) => (
              <TouchableOpacity
                key={a._id}
                onPress={() => router.push({ pathname: '/(app)/appointments/[id]', params: { id: String(a._id) } })}
                style={[
                  styles.appointmentInlineItem,
                  { borderColor: theme.border, backgroundColor: theme.secondary },
                ]}
              >
                <Text style={{ color: theme.text, fontWeight: '700' }}>{a.provider?.name || 'Provider'}</Text>
                <Text style={[ui.caption(theme), { marginTop: spacing.xs }]}>
                  {appointmentStatusLabel(a.status)} ·{' '}
                  {a.status === 'confirmed' && a.confirmedStart
                    ? new Date(a.confirmedStart).toLocaleString()
                    : new Date(a.requestedStart).toLocaleString()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = {
  container: { paddingBottom: spacing['2xl'] },
  title: { marginBottom: spacing.sm },
  subtitle: { marginBottom: spacing.md },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  headerTitle: { fontWeight: '800', fontSize: 20 },
  headerNotifBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  stickyHeader: {
    paddingTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
  },
  stickyHeaderCard: { },
  logoIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoIcon: { width: 28, height: 28, resizeMode: 'contain' },
  quickActionsHeader: { marginBottom: spacing.md },
  quickActionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 0, marginBottom: spacing.lg },
  quickActionBtn: {
    width: '23%',
    flexGrow: 0,
    flexShrink: 0,
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  quickActionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  quickActionLabel: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 11,
    textAlign: 'center',
  },
  topInfoCard: { marginTop: spacing.md },
  discoveryCard: { marginTop: spacing.md },
  appointmentsInline: { marginTop: spacing.md, marginBottom: spacing.md },
  appointmentInlineItem: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
  },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  appointmentItem: { marginTop: 0 },
  filterLayout: { flexDirection: 'column', gap: spacing.md },
  filterSidebar: { width: '100%', paddingTop: spacing.sm, flexDirection: 'row', gap: spacing.md },
  filterLeft: { flex: 1 },
  filterRight: { flex: 1 },
  providerTypeDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    height: 42,
  },
  providerTypeDropdownText: { flex: 1, marginRight: spacing.sm },
  openNowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    height: 42,
  },
  providerTypeModalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  providerTypeModalCard: {
    marginHorizontal: spacing.md,
    marginTop: 120,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  providerTypeModalOption: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: 12,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 84,
    paddingHorizontal: spacing.lg,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: spacing.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  modalItem: {
    width: '48%',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  loadMoreBtn: { marginBottom: spacing['2xl'], alignSelf: 'center' },
  searchInput: { marginBottom: spacing.md },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  filtersRow: { gap: spacing.sm, paddingBottom: spacing.sm },
  filterChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  searchBtn: { marginBottom: spacing.lg },
  card: { marginBottom: spacing.md },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  providerName: { fontSize: 16, fontWeight: '600' },
  badge: { fontSize: 12, fontWeight: '600' },
  meta: { marginTop: spacing.xs },
  cardMetaBlock: { marginTop: spacing.sm },
  metaLine: { marginTop: spacing.xs },
  cardActionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  cardActionBtn: { flex: 1, borderRadius: 14, paddingHorizontal: spacing.md, height: 40 },
  cardActionBtnPrimary: { flex: 1, borderRadius: 14, paddingHorizontal: spacing.md, height: 40 },
  viewAllBtn: { marginTop: spacing.lg },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeader: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
};
