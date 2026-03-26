import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
} from "react-native";
import * as Location from "expo-location";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useThemeMode, useAuth } from "../../../_layout";
import { apiRequest } from "../../../../src/api/client";
import {
  ui,
  spacing,
  radii,
  typography,
  layout,
} from "../../../../theme/tokens";
import ScreenHeader from "../../../components/ScreenHeader";
import { ShimmerBlock, ShimmerText } from "../../../components/Shimmer";

/**
 * Urgent care: open-now providers first, distance when location on, oversized call actions.
 */
export default function UrgentCareScreen() {
  const { theme } = useThemeMode();
  const { token } = useAuth();
  const router = useRouter();
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userCoords, setUserCoords] = useState(null);
  const radiusKmRef = useRef(25);
  const emergencyContacts = [
    { num: "112", label: "Emergency", sub: "National emergency line" },
    { num: "199", label: "FRSC", sub: "Road traffic emergency" },
    {
      num: "122",
      label: "Ambulance",
      sub: "Medical emergency (where available)",
    },
    { num: "767", label: "LASEMA", sub: "Lagos emergency response line" },
  ];

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      params.set("limit", "30");
      params.set("openNow", "true");
      if (userCoords) {
        params.set("latitude", String(userCoords.latitude));
        params.set("longitude", String(userCoords.longitude));
        params.set("radiusKm", String(radiusKmRef.current));
      }
      const res = await apiRequest(`/providers?${params.toString()}`, {
        method: "GET",
        token,
      });
      const list = res.data || [];
      const openFirst = [...list].sort((a, b) => {
        if (a.isOpenNow === b.isOpenNow) {
          const da = a.distanceKm ?? 9999;
          const db = b.distanceKm ?? 9999;
          return da - db;
        }
        return b.isOpenNow ? 1 : -1;
      });
      setProviders(openFirst);
    } catch (e) {
      setError(e.message || "Could not load");
    } finally {
      setLoading(false);
    }
  }, [token, userCoords]);

  useEffect(() => {
    load();
  }, [load]);

  const ensureLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Location",
          "Enable location to sort by nearest open providers.",
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setUserCoords({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
    } catch (e) {
      setError(e.message || "Location error");
    }
  };

  useEffect(() => {
    ensureLocation();
  }, []);

  const call = async (phone) => {
    if (!phone) return;
    const url = `tel:${phone}`;
    if (await Linking.canOpenURL(url)) await Linking.openURL(url);
  };

  const callEmergency = async (num, label) => {
    const url = `tel:${num}`;
    Alert.alert(
      "Emergency",
      `Call ${label} (${num})? For life-threatening emergencies use your local emergency number.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Call", onPress: () => Linking.openURL(url) },
      ],
    );
  };

  const getInitials = (name = "") =>
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "P";

  const getEtaText = (distanceKm) => {
    if (distanceKm == null || Number.isNaN(Number(distanceKm)))
      return "ETA unavailable";
    const minutes = Math.max(3, Math.round((Number(distanceKm) / 35) * 60));
    return `ETA ${minutes} min`;
  };

  return (
    <SafeAreaView style={ui.screen(theme)} edges={["top"]}>
      <ScreenHeader
        title="Urgent care"
        onBack={() => router.back()}
        style={{ marginTop: spacing.sm }}
      />
      <ScrollView
        contentContainerStyle={{
          paddingBottom: spacing["2xl"],
          paddingHorizontal: layout.screenPaddingHorizontal,
        }}
      >
        <Text
          style={[
            ui.caption(theme),
            { marginBottom: spacing.md, marginTop: spacing.xs },
          ]}
        >
          Open providers first. This is not a substitute for emergency services.
        </Text>

        <Text style={[styles.sectionLabel, { color: theme.subtleText }]}>
          EMERGENCY CONTACTS
        </Text>
        <View style={[ui.card(theme), styles.sectionCard]}>
          {emergencyContacts.map((contact, idx) => (
            <TouchableOpacity
              key={contact.num}
              style={[
                styles.rowBtn,
                idx < emergencyContacts.length - 1
                  ? { borderBottomWidth: 1, borderBottomColor: theme.border }
                  : { borderBottomWidth: 0 },
              ]}
              onPress={() =>
                callEmergency(contact.num, `Nigeria ${contact.label}`)
              }
            >
              <Text style={[styles.rowTitle, { color: theme.text }]}>
                {contact.num} · {contact.label}
              </Text>
              <Text style={[styles.rowSub, { color: theme.subtleText }]}>
                {contact.sub}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text
          style={[
            styles.sectionLabel,
            { color: theme.subtleText, marginTop: spacing.lg },
          ]}
        >
          OPEN PROVIDERS NEAR YOU
        </Text>

        {loading ? (
          <View style={{ gap: spacing.sm }}>
            {Array.from({ length: 3 }).map((_, idx) => (
              <View
                key={`urgent-shimmer-${idx}`}
                style={[ui.card(theme), { padding: spacing.md }]}
              >
                <ShimmerBlock
                  theme={theme}
                  style={{ height: 14, width: "48%", marginBottom: spacing.xs }}
                />
                <ShimmerText theme={theme} lines={2} />
              </View>
            ))}
          </View>
        ) : null}
        {error ? <Text style={ui.errorText(theme)}>{error}</Text> : null}

        {!loading && providers.length === 0 ? (
          <Text style={ui.caption(theme)}>
            No open providers match. Try widening search from Home.
          </Text>
        ) : null}

        {providers.map((p) => (
          <View
            key={p._id}
            style={[
              ui.card(theme),
              styles.sectionCard,
              styles.providerCard,
              { borderColor: theme.border },
            ]}
          >
            <TouchableOpacity
              style={[styles.providerRow, { borderBottomColor: theme.border }]}
              onPress={() => router.push(`/(app)/provider-details/${p._id}`)}
              activeOpacity={0.85}
            >
              <View
                style={[styles.avatar, { backgroundColor: theme.secondary }]}
              >
                <Text style={[styles.avatarText, { color: theme.text }]}>
                  {getInitials(p.name)}
                </Text>
              </View>
              <View style={styles.providerMeta}>
                <Text
                  style={[styles.rowTitle, { color: theme.text }]}
                  numberOfLines={1}
                >
                  {p.name}
                </Text>
                <Text
                  style={[styles.rowSub, { color: theme.subtleText }]}
                  numberOfLines={1}
                >
                  {p.providerType} · {p.isOpenNow ? "Open now" : "Closed"}
                </Text>
                <Text style={[styles.rowSub, { color: theme.subtleText }]}>
                  {p.distanceKm != null
                    ? `${Number(p.distanceKm).toFixed(1)} km`
                    : "Distance unavailable"}{" "}
                  · {getEtaText(p.distanceKm)}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.rowBtn, styles.callRow]}
              onPress={() => call(p.phone)}
              activeOpacity={0.85}
            >
              <Text style={[styles.rowTitle, { color: theme.text }]}>
                {p.phone ? `Call ${p.phone}` : "Phone unavailable"}
              </Text>
              <Text style={[styles.rowSub, { color: theme.subtleText }]}>
                Tap to contact provider
              </Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = {
  sectionLabel: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  sectionCard: {
    padding: 0,
    overflow: "hidden",
    borderRadius: radii.xs,
  },
  rowBtn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
  },
  rowTitle: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 14,
  },
  rowSub: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    marginTop: 2,
  },
  providerCard: {
    marginBottom: spacing.md,
    borderWidth: 2,
  },
  providerRow: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
  },
  providerMeta: {
    flex: 1,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  avatarText: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 14,
  },
  callRow: {
    borderBottomWidth: 0,
  },
};
