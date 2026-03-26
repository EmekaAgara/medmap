import { useEffect, useMemo, useState, useCallback, useRef } from "react";
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
  Platform,
} from "react-native";
import * as Location from "expo-location";
import { useThemeMode } from "../../../_layout";
import { useAuth } from "../../../_layout";
import { apiRequest } from "../../../../src/api/client";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ui,
  spacing,
  radii,
  typography,
  shadows,
} from "../../../../theme/tokens";
import QuickActionsGrid from "../../../components/QuickActionsGrid";
import {
  ShimmerAvatar,
  ShimmerBlock,
  ShimmerText,
} from "../../../components/Shimmer";
import { hapticTap, hapticToggle } from "../../../../src/utils/haptics";

const PAGE_LIMIT = 10;

function productPreviewLabel(p) {
  if (p == null) return "";
  if (typeof p === "string") return p;
  if (typeof p === "object" && p.name != null) {
    const pr = Math.max(0, Number(p.price) || 0);
    return pr > 0 ? `${p.name} (₦${pr.toLocaleString()})` : `${p.name} (free)`;
  }
  return "";
}

function getInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function appointmentStatusLabel(s) {
  if (s === "pending") return "Awaiting provider";
  if (s === "confirmed") return "Confirmed";
  if (s === "rejected") return "Declined";
  if (s === "cancelled") return "Cancelled";
  return s;
}

export default function HomeScreen() {
  const { theme } = useThemeMode();
  const { token, user } = useAuth();
  const router = useRouter();
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [claimingProviderId, setClaimingProviderId] = useState("");
  const [radiusKm] = useState(50000);
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [userCoords, setUserCoords] = useState(null);
  const [locationLabel, setLocationLabel] = useState("");
  const [appointments, setAppointments] = useState([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [appointmentsError, setAppointmentsError] = useState("");
  const [providerTypeModalOpen, setProviderTypeModalOpen] = useState(false);

  const typeRef = useRef(type);
  const searchRef = useRef(search);
  typeRef.current = type;
  searchRef.current = search;
  const searchDebounceRef = useRef(null);

  const loadUnreadNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiRequest("/notifications/mine/unread-count", {
        method: "GET",
        token,
      });
      const c = Number(res.data?.unreadCount || 0);
      setUnreadNotifCount(Number.isFinite(c) ? c : 0);
    } catch {
      // ignore unread count failures (should never break home UI)
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      loadUnreadNotifications();
    }, [loadUnreadNotifications]),
  );

  useEffect(() => {
    if (!token) return undefined;
    const t = setInterval(() => {
      loadUnreadNotifications();
    }, 20000);
    return () => clearInterval(t);
  }, [token, loadUnreadNotifications]);

  const providerTypes = useMemo(
    () => [
      { value: "", label: "All" },
      { value: "doctor", label: "Doctors" },
      { value: "pharmacy", label: "Pharmacies" },
      { value: "hospital", label: "Hospitals" },
    ],
    [],
  );

  const providerTypeLabel =
    providerTypes.find((p) => p.value === type)?.label || "All";

  const fetchProviders = useCallback(
    async (
      selectedType = typeRef.current,
      currentSearch = searchRef.current,
      pageToFetch = 1,
      { append = false, openNowOnlyOverride = null } = {},
    ) => {
      try {
        setLoading(!append);
        setError("");
        const params = new URLSearchParams();
        params.set("limit", String(PAGE_LIMIT));
        params.set("page", String(pageToFetch));
        if (selectedType) params.set("type", selectedType);
        if (currentSearch.trim()) params.set("search", currentSearch.trim());
        const openNowValue =
          openNowOnlyOverride === null ? openNowOnly : openNowOnlyOverride;
        if (openNowValue) params.set("openNow", "true");
        if (userCoords) {
          params.set("latitude", String(userCoords.latitude));
          params.set("longitude", String(userCoords.longitude));
          params.set("radiusKm", String(radiusKm));
        }

        const res = await apiRequest(`/providers?${params.toString()}`, {
          method: "GET",
          token,
        });

        const items = res.data || [];
        if (append) setProviders((prev) => [...prev, ...items]);
        else setProviders(items);
      } catch (e) {
        setError(e.message || "Could not load providers");
      } finally {
        setLoading(false);
      }
    },
    [token, openNowOnly, userCoords, radiusKm],
  );

  useEffect(() => {
    fetchProviders(typeRef.current, searchRef.current, 1);
  }, []);

  const requestLocationAndSearch = async () => {
    try {
      setError("");
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationLabel("Location denied — showing all results");
        setUserCoords(null);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
      setUserCoords(coords);
      setLocationLabel("Showing the 10 nearest providers by distance");
    } catch (e) {
      setError(e.message || "Could not get location");
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
    if (user?.accountType !== "patient") {
      setAppointments([]);
      return;
    }
    if (!token) return;
    (async () => {
      try {
        setAppointmentsLoading(true);
        setAppointmentsError("");
        const res = await apiRequest("/appointments/mine/patient", {
          method: "GET",
          token,
        });
        setAppointments(res.data || []);
      } catch (e) {
        setAppointmentsError(e.message || "Could not load appointments");
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
      pathname: "/(app)/provider-chat",
      params: { providerId: provider._id, providerName: provider.name },
    });
  };

  const handleClaim = async (providerId) => {
    try {
      setClaimingProviderId(providerId);
      await apiRequest(`/providers/${providerId}/claim`, {
        method: "POST",
        token,
      });
      Alert.alert("Claim submitted", "An admin will review your request.");
      await fetchProviders();
    } catch (e) {
      setError(e.message || "Unable to claim provider");
    } finally {
      setClaimingProviderId("");
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

  // Exactly 8 quick actions on Home; remaining shortcuts live on Profile.
  const quickActions =
    user?.accountType === "patient"
      ? [
          {
            key: "explore",
            label: "Explore",
            icon: "map-outline",
            onPress: () => router.push("/(tabs)/explore"),
          },
          {
            key: "urgent",
            label: "Urgent",
            icon: "warning-outline",
            color: theme.error,
            onPress: () => router.push("/(tabs)/home/urgent"),
          },
          {
            key: "messages",
            label: "Messages",
            icon: "chatbubble-outline",
            onPress: () => router.push("/(tabs)/messages"),
          },
          {
            key: "alerts",
            label: "Alerts",
            icon: "notifications-outline",
            onPress: () => router.push("/(tabs)/notifications"),
          },
          {
            key: "wallet",
            label: "Wallet",
            icon: "wallet-outline",
            onPress: () => router.push("/(app)/wallet"),
          },
          {
            key: "appointments",
            label: "Appts",
            icon: "calendar-outline",
            onPress: () => router.push("/(app)/appointments"),
          },
          {
            key: "orders",
            label: "Orders",
            icon: "bag-outline",
            onPress: () => router.push("/(app)/orders"),
          },
          {
            key: "timeline",
            label: "Timeline",
            icon: "pulse-outline",
            onPress: () => router.push("/(app)/medical-timeline"),
          },
        ]
      : [
          {
            key: "explore",
            label: "Explore",
            icon: "map-outline",
            onPress: () => router.push("/(tabs)/explore"),
          },
          {
            key: "urgent",
            label: "Urgent",
            icon: "warning-outline",
            color: theme.error,
            onPress: () => router.push("/(tabs)/home/urgent"),
          },
          {
            key: "messages",
            label: "Messages",
            icon: "chatbubble-outline",
            onPress: () => router.push("/(tabs)/messages"),
          },
          {
            key: "alerts",
            label: "Alerts",
            icon: "notifications-outline",
            onPress: () => router.push("/(tabs)/notifications"),
          },
          {
            key: "wallet",
            label: "Wallet",
            icon: "wallet-outline",
            onPress: () => router.push("/(app)/wallet"),
          },
          {
            key: "listing",
            label: "Listing",
            icon: "briefcase-outline",
            onPress: () => router.push("/(app)/provider-listing"),
          },
          {
            key: "requests",
            label: "Requests",
            icon: "time-outline",
            onPress: () => router.push("/(app)/provider-appointments"),
          },
          {
            key: "sales",
            label: "Sales",
            icon: "bag-outline",
            onPress: () => router.push("/(app)/provider-orders"),
          },
        ];

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: theme.background,
        paddingHorizontal: spacing.md,
      }}
      edges={["top"]}
    >
      <View style={[styles.headerBar, { borderBottomColor: theme.border }]}>
        <Text style={[ui.h2(theme), styles.headerTitle]}>MedMap</Text>
        <TouchableOpacity
          onPress={() => {
            hapticTap();
            router.push("/(tabs)/notifications");
          }}
          style={[
            styles.headerNotifBtn,
            { borderColor: theme.border, backgroundColor: theme.secondary },
          ]}
          hitSlop={10}
        >
          <Ionicons name="notifications-outline" size={22} color={theme.text} />
          {unreadNotifCount > 0 ? (
            <View style={[styles.notifBadge, { backgroundColor: theme.error }]}>
              <Text style={styles.notifBadgeText}>
                {unreadNotifCount > 99 ? "99+" : String(unreadNotifCount)}
              </Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            ui.card(theme),
            { padding: spacing.lg },
            styles.quickActionsCard,
          ]}
        >
          <View style={styles.quickActionsHeader}>
            <Text
              style={[ui.h2(theme), { fontSize: 16, marginBottom: spacing.xs }]}
            >
              Quick actions
            </Text>
            <Text style={[ui.caption(theme), { marginBottom: spacing.md }]}>
              Hello, {user?.fullName || user?.firstName || "there"}.
            </Text>
          </View>

          <QuickActionsGrid actions={quickActions} theme={theme} />
        </View>

        <View
          style={[
            ui.card(theme),
            { padding: spacing.lg },
            styles.discoveryCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search provider or service"
            placeholderTextColor={theme.subtleText}
            style={ui.input(theme)}
          />

          {locationLabel ? (
            <Text
              style={[
                ui.caption(theme),
                { marginTop: spacing.sm, marginBottom: spacing.md },
              ]}
            >
              {locationLabel}
            </Text>
          ) : null}

          <View style={styles.filterLayout}>
            <View style={styles.filterSidebar}>
              <View style={styles.filterLeft}>
                <Text style={[ui.caption(theme), { marginBottom: spacing.xs }]}>
                  Provider type
                </Text>
                <TouchableOpacity
                  style={[ui.buttonOutline(theme), styles.providerTypeDropdown]}
                  onPress={() => {
                    hapticTap();
                    setProviderTypeModalOpen(true);
                  }}
                  activeOpacity={0.9}
                >
                  <Text
                    style={[
                      ui.buttonText(theme),
                      styles.providerTypeDropdownText,
                    ]}
                    numberOfLines={1}
                  >
                    {providerTypeLabel}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={16}
                    color={theme.subtleText}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.filterRight}>
                <Text style={[ui.caption(theme), { marginBottom: spacing.xs }]}>
                  Open now
                </Text>
                <View
                  style={[styles.openNowRow, { borderColor: theme.border }]}
                >
                  <Text style={{ color: theme.subtleText, fontSize: 12 }}>
                    {openNowOnly ? "Open" : "Any"}
                  </Text>
                  <Switch
                    value={openNowOnly}
                    onValueChange={(v) => {
                      hapticToggle();
                      setOpenNowOnly(v);
                      fetchProviders(typeRef.current, searchRef.current, 1, {
                        openNowOnlyOverride: v,
                      });
                    }}
                  />
                </View>
              </View>
            </View>

            {providerTypeModalOpen ? (
              <View
                style={[
                  styles.providerTypeInlineMenu,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                {providerTypes.map((p) => {
                  const active = p.value === type;
                  return (
                    <TouchableOpacity
                      key={p.value || "all"}
                      style={[
                        styles.providerTypeInlineOption,
                        active
                          ? { backgroundColor: theme.primary + "10" }
                          : null,
                      ]}
                      onPress={() => {
                        hapticTap();
                        setType(p.value);
                        fetchProviders(p.value, searchRef.current, 1);
                        setProviderTypeModalOpen(false);
                      }}
                    >
                      <Text
                        style={{
                          color: theme.text,
                          fontWeight: active ? "800" : "600",
                        }}
                      >
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}

            <View style={{ flex: 1 }}>
              {loading ? (
                <View style={{ marginTop: spacing.md, gap: spacing.md }}>
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <View
                      key={`provider-shimmer-${idx}`}
                      style={[
                        styles.providerCard,
                        {
                          borderColor: theme.border,
                          backgroundColor: theme.card,
                        },
                      ]}
                    >
                      <View style={styles.cardHeader}>
                        <ShimmerAvatar theme={theme} size={44} />
                        <View style={{ flex: 1, gap: spacing.xs }}>
                          <ShimmerBlock
                            theme={theme}
                            style={{ height: 14, width: "62%" }}
                          />
                          <ShimmerBlock
                            theme={theme}
                            style={{
                              height: 20,
                              width: "34%",
                              borderRadius: 999,
                            }}
                          />
                          <ShimmerBlock
                            theme={theme}
                            style={{ height: 12, width: "40%" }}
                          />
                        </View>
                        <View
                          style={{ alignItems: "flex-end", gap: spacing.xs }}
                        >
                          <ShimmerBlock
                            theme={theme}
                            style={{ height: 20, width: 62, borderRadius: 999 }}
                          />
                          <ShimmerBlock
                            theme={theme}
                            style={{ height: 12, width: 90 }}
                          />
                        </View>
                      </View>
                      <View
                        style={[
                          styles.cardMetaBlock,
                          { borderTopColor: theme.border },
                        ]}
                      >
                        <ShimmerText theme={theme} lines={2} />
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
              {error ? <Text style={ui.errorText(theme)}>{error}</Text> : null}

              {!loading && !providers.length ? (
                <Text style={ui.caption(theme)}>No providers found.</Text>
              ) : null}

              {providers.map((provider) => {
                return (
                  <TouchableOpacity
                    key={provider._id}
                    activeOpacity={0.9}
                    style={[
                      styles.providerCard,
                      {
                        borderColor: theme.border,
                        backgroundColor: theme.card,
                      },
                    ]}
                    onPress={() => {
                      hapticTap();
                      router.push({
                        pathname: "/(app)/provider-details/[id]",
                        params: { id: String(provider._id) },
                      });
                    }}
                  >
                    <View style={styles.cardHeader}>
                      {provider.imageUrl ? (
                        <Image
                          source={{ uri: provider.imageUrl }}
                          style={[styles.avatar, { borderColor: theme.border }]}
                        />
                      ) : (
                        <View
                          style={[
                            styles.avatarPlaceholder,
                            {
                              borderColor: theme.border,
                              backgroundColor: theme.secondary,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.avatarInitials,
                              { color: theme.text },
                            ]}
                          >
                            {getInitials(provider.name)}
                          </Text>
                        </View>
                      )}
                      <View style={styles.cardMain}>
                        <Text
                          style={[styles.providerName, { color: theme.text }]}
                        >
                          {provider.name}
                        </Text>
                        <View
                          style={[
                            styles.typeChip,
                            {
                              borderColor: theme.border,
                              backgroundColor: theme.secondary,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              ui.caption(theme),
                              { textTransform: "capitalize" },
                            ]}
                          >
                            {provider.providerType}
                          </Text>
                        </View>
                        {provider.hourlyRate === 0 ? (
                          <Text style={[ui.caption(theme), styles.meta]}>
                            Free
                          </Text>
                        ) : provider.hourlyRate ? (
                          <Text style={[ui.caption(theme), styles.meta]}>
                            ₦{Number(provider.hourlyRate).toLocaleString()}/hr
                          </Text>
                        ) : null}
                      </View>
                      <View style={styles.cardRight}>
                        <View
                          style={[
                            styles.statusPill,
                            {
                              backgroundColor: provider.isOpenNow
                                ? theme.success + "18"
                                : theme.error + "18",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.badge,
                              {
                                color: provider.isOpenNow
                                  ? theme.success
                                  : theme.error,
                              },
                            ]}
                          >
                            {provider.isOpenNow ? "Open" : "Closed"}
                          </Text>
                        </View>
                        {provider.distanceKm != null ? (
                          <Text style={[ui.caption(theme), styles.meta]}>
                            {provider.distanceKm} km • ETA ~
                            {Math.max(1, Math.round(provider.distanceKm * 2))}m
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    <View
                      style={[
                        styles.cardMetaBlock,
                        { borderTopColor: theme.border },
                      ]}
                    >
                      {provider.services?.length ? (
                        <Text
                          style={[ui.caption(theme), styles.metaLine]}
                          numberOfLines={1}
                        >
                          Services: {provider.services.slice(0, 2).join(", ")}
                        </Text>
                      ) : null}

                      {provider.products?.length ? (
                        <Text
                          style={[ui.caption(theme), styles.metaLine]}
                          numberOfLines={1}
                        >
                          Products:{" "}
                          {provider.products
                            .slice(0, 2)
                            .map(productPreviewLabel)
                            .filter(Boolean)
                            .join(", ")}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                style={[ui.buttonOutline(theme), styles.viewAllBtn]}
                onPress={() => router.push("/(app)/providers")}
              >
                <Text style={ui.buttonText(theme)}>Browse all providers</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        {user?.accountType === "patient" ? (
          <View
            style={[
              ui.card(theme),
              styles.appointmentsCard,
              { padding: spacing.lg },
            ]}
          >
            <View style={styles.sectionHeaderRow}>
              <Text style={[ui.h2(theme), { fontSize: 16 }]}>
                My appointments
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/(app)/appointments")}
              >
                <Text style={{ color: theme.primary, fontWeight: "700" }}>
                  View all
                </Text>
              </TouchableOpacity>
            </View>

            {appointmentsLoading ? (
              <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
                <ShimmerBlock
                  theme={theme}
                  style={{ height: 54, borderRadius: radii.md }}
                />
                <ShimmerBlock
                  theme={theme}
                  style={{ height: 54, borderRadius: radii.md }}
                />
              </View>
            ) : null}

            {appointmentsError ? (
              <Text style={ui.errorText(theme)}>{appointmentsError}</Text>
            ) : null}

            {!appointmentsLoading && appointments.length === 0 ? (
              <Text style={[ui.caption(theme), { marginTop: spacing.sm }]}>
                No appointments yet.
              </Text>
            ) : null}

            {appointments.slice(0, 2).map((a) => (
              <TouchableOpacity
                key={a._id}
                onPress={() =>
                  router.push({
                    pathname: "/(app)/appointments/[id]",
                    params: { id: String(a._id) },
                  })
                }
                style={[
                  styles.appointmentInlineItem,
                  {
                    borderColor: theme.border,
                    backgroundColor: theme.secondary,
                  },
                ]}
              >
                <Text style={{ color: theme.text, fontWeight: "700" }}>
                  {a.provider?.name || "Provider"}
                </Text>
                <Text style={[ui.caption(theme), { marginTop: spacing.xs }]}>
                  {appointmentStatusLabel(a.status)} ·{" "}
                  {a.status === "confirmed" && a.confirmedStart
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
  container: { paddingBottom: spacing["2xl"] },
  title: { marginBottom: spacing.sm },
  subtitle: { marginBottom: spacing.md },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  headerTitle: { fontWeight: "800", fontSize: 20 },
  headerNotifBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  notifBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  notifBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
  },
  stickyHeader: {
    paddingTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
  },
  stickyHeaderCard: {},
  logoIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoIcon: { width: 28, height: 28, resizeMode: "contain" },
  quickActionsHeader: { marginBottom: spacing.md },
  // Quick actions now use shared `QuickActionsGrid` component.
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
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  appointmentItem: { marginTop: 0 },
  filterLayout: { flexDirection: "column", gap: spacing.md },
  filterSidebar: {
    width: "100%",
    paddingTop: spacing.sm,
    flexDirection: "row",
    gap: spacing.md,
  },
  filterLeft: { flex: 1 },
  filterRight: { flex: 1 },
  providerTypeDropdown: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    height: 42,
  },
  providerTypeDropdownText: { flex: 1, marginRight: spacing.sm },
  openNowRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    height: 42,
  },
  providerTypeInlineMenu: {
    width: "48%",
    marginTop: spacing.xs,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    alignSelf: "flex-start",
  },
  providerTypeInlineOption: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: 12,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-start",
    paddingTop: 84,
    paddingHorizontal: spacing.lg,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: spacing.lg,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  modalItem: {
    width: "48%",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  loadMoreBtn: { marginBottom: spacing["2xl"], alignSelf: "center" },
  searchInput: { marginBottom: spacing.md },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  providerCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  cardMain: { flex: 1 },
  cardRight: { alignItems: "flex-end", marginLeft: spacing.sm },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  providerName: { fontSize: 16, fontWeight: "700" },
  typeChip: {
    alignSelf: "flex-start",
    marginTop: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  statusPill: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  badge: { fontSize: 12, fontWeight: "600" },
  meta: { marginTop: spacing.xs },
  cardMetaBlock: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
  metaLine: { marginTop: spacing.xs },
  viewAllBtn: { marginTop: spacing.lg },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: { fontWeight: "800", fontSize: 13 },
  cardHeader: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 1 },
};
