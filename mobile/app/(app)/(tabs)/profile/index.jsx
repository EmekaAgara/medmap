import { useState, useCallback, useEffect, useRef } from "react";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Dimensions,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useAuth, useThemeMode } from "../../../_layout";
import {
  ui,
  spacing,
  typography,
  radii,
  layout,
  brand,
} from "../../../../theme/tokens";
import { apiRequest, apiUpload } from "../../../../src/api/client";

export default function ProfileScreen() {
  const { token, updateUser, signOut } = useAuth();
  const { theme, mode, toggleTheme } = useThemeMode();
  const router = useRouter();
  const isDark = mode === "dark";

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [error, setError] = useState("");
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const [fullImageVisible, setFullImageVisible] = useState(false);
  const avatarRef = useRef(null);

  const { r } = useLocalSearchParams();
  const lastR = useRef("");

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await apiRequest("/users/me", { method: "GET", token });
      setProfile(res.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Load once on mount
  useEffect(() => {
    fetchProfile();
  }, []);

  // Re-fetch only when an explicit refresh token is passed (from profile-edit or KYC submit)
  useFocusEffect(
    useCallback(() => {
      if (r && String(r) !== lastR.current) {
        lastR.current = String(r);
        fetchProfile();
      }
    }, [r, fetchProfile]),
  );

  const initials =
    profile?.fullName
      ?.split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  const openDropdown = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    avatarRef.current?.measureInWindow((x, y, width, height) => {
      setDropdownPos({ top: y + height - 8, left: x + width - 8 });
      setDropdownVisible(true);
    });
  };

  const pickAndUploadAvatar = async () => {
    setDropdownVisible(false);
    await new Promise((r) => setTimeout(r, 150));
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Please allow access to your photo library.",
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      setUploading(true);
      const formData = new FormData();
      formData.append("avatar", {
        uri: asset.uri,
        type: asset.mimeType || "image/jpeg",
        name: `avatar_${Date.now()}.jpg`,
      });
      const res = await apiUpload("/users/me/avatar", { formData, token });
      setProfile(res.data);
      await updateUser({ avatarUrl: res.data.avatarUrl });
    } catch (e) {
      Alert.alert("Upload failed", e.message);
    } finally {
      setUploading(false);
    }
  };

  const removeAvatar = () => {
    setDropdownVisible(false);
    Alert.alert("Remove photo", "Remove your profile photo?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            setUploading(true);
            const res = await apiRequest("/users/me/avatar", {
              method: "DELETE",
              token,
            });
            setProfile(res.data);
            await updateUser({ avatarUrl: null });
          } catch (e) {
            Alert.alert("Error", e.message);
          } finally {
            setUploading(false);
          }
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete account",
      "Your account will be deactivated immediately and permanently deleted after 30 days.\n\nYou can reactivate it any time within those 30 days by logging back in.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Deactivate",
          style: "destructive",
          onPress: async () => {
            try {
              setDeletingAccount(true);
              await apiRequest("/users/me", { method: "DELETE", token });
              await signOut();
            } catch (e) {
              setDeletingAccount(false);
              Alert.alert("Error", e.message);
            }
          },
        },
      ],
    );
  };

  const formatDate = (iso) => {
    if (!iso) return null;
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.background }}
      edges={["top"]}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: spacing["3xl"] }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={theme.primary} />
          </View>
        ) : (
          <>
            {/* ── Hero ── */}
            <View style={styles.heroSection}>
              <TouchableOpacity
                ref={avatarRef}
                onPress={openDropdown}
                activeOpacity={0.85}
                disabled={uploading}
                style={styles.avatarContainer}
              >
                {profile?.avatarUrl ? (
                  <Image
                    source={{ uri: profile.avatarUrl }}
                    style={[styles.avatar, { borderColor: theme.border }]}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={[
                      styles.avatar,
                      styles.avatarFallback,
                      {
                        backgroundColor: theme.secondary,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.avatarInitials, { color: theme.text }]}
                    >
                      {initials}
                    </Text>
                  </View>
                )}
                <View
                  style={[
                    styles.cameraChip,
                    { backgroundColor: theme.primary },
                  ]}
                >
                  {uploading ? (
                    <ActivityIndicator
                      size={10}
                      color={theme.primaryForeground}
                    />
                  ) : (
                    <Ionicons
                      name="camera"
                      size={12}
                      color={theme.primaryForeground}
                    />
                  )}
                </View>
              </TouchableOpacity>

              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Text style={[styles.name, { color: theme.text }]}>
                  {profile?.fullName || "—"}
                </Text>
                {profile?.kycStatus === "approved" ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={theme.success}
                  />
                ) : null}
              </View>
              <Text style={[styles.email, { color: theme.subtleText }]}>
                {profile?.email || "—"}
              </Text>

              {profile?.bio ? (
                <Text style={[styles.bio, { color: theme.subtleText }]}>
                  {profile.bio}
                </Text>
              ) : null}

              {profile?.accountType ? (
                <View
                  style={[styles.badge, { backgroundColor: theme.secondary }]}
                >
                  <Text style={[styles.badgeText, { color: theme.subtleText }]}>
                    {String(profile.accountType).replace("_", " ")} account
                  </Text>
                </View>
              ) : null}

              {profile?.accountTypeChangeStatus === "pending" &&
              profile?.pendingAccountType ? (
                <View style={[styles.badge, { backgroundColor: brand.goldBg }]}>
                  <Ionicons name="time-outline" size={12} color={brand.gold} />
                  <Text style={[styles.badgeText, { color: brand.gold }]}>
                    Change pending admin approval:{" "}
                    {String(profile.pendingAccountType).replace("_", " ")}
                  </Text>
                </View>
              ) : null}

              {profile?.accountTypeChangeStatus === "rejected" ? (
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: theme.error + "18" },
                  ]}
                >
                  <Ionicons
                    name="close-circle-outline"
                    size={12}
                    color={theme.error}
                  />
                  <Text style={[styles.badgeText, { color: theme.error }]}>
                    Profile type change rejected
                  </Text>
                </View>
              ) : null}

              {(() => {
                const isApproved = profile?.kycStatus === "approved";
                const isSubmitted = profile?.kycStep === "submitted";
                const isRejected = profile?.kycStatus === "rejected";
                const accountTypeLabel = profile?.accountType
                  ? String(profile.accountType).replace("_", " ")
                  : "patient";
                const badgeColor = isApproved
                  ? theme.success
                  : isSubmitted
                    ? brand.gold
                    : isRejected
                      ? theme.error
                      : theme.subtleText;
                const badgeBg = isApproved
                  ? theme.success + "18"
                  : isSubmitted
                    ? brand.goldBg
                    : isRejected
                      ? theme.error + "18"
                      : theme.secondary;
                const badgeIcon = isApproved
                  ? "shield-checkmark"
                  : isSubmitted
                    ? "time-outline"
                    : isRejected
                      ? "close-circle-outline"
                      : "shield-outline";
                const badgeLabel = isApproved
                  ? `${accountTypeLabel} account is verified`
                  : isSubmitted
                    ? `Verifying your ${accountTypeLabel} account`
                    : isRejected
                      ? `${accountTypeLabel} account verification rejected`
                      : `Verify your ${accountTypeLabel} account`;
                return (
                  <TouchableOpacity
                    onPress={() => router.push("/(app)/kyc")}
                    activeOpacity={0.8}
                    style={[styles.badge, { backgroundColor: badgeBg }]}
                  >
                    <Ionicons name={badgeIcon} size={12} color={badgeColor} />
                    <Text style={[styles.badgeText, { color: badgeColor }]}>
                      {badgeLabel}
                    </Text>
                  </TouchableOpacity>
                );
              })()}

              <TouchableOpacity
                style={[styles.editBtn, { borderColor: theme.border }]}
                onPress={() => router.push("/(app)/profile-edit")}
                activeOpacity={0.8}
              >
                <Ionicons name="pencil-outline" size={14} color={theme.text} />
                <Text style={[styles.editBtnText, { color: theme.text }]}>
                  Edit profile
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.editBtn,
                  { borderColor: theme.border, marginTop: spacing.sm },
                ]}
                onPress={() => router.push("/(app)/wallet")}
                activeOpacity={0.8}
              >
                <Ionicons name="wallet-outline" size={14} color={theme.text} />
                <Text style={[styles.editBtnText, { color: theme.text }]}>
                  MedMap wallet
                </Text>
              </TouchableOpacity>
              {profile?.accountType && profile.accountType !== "patient" ? (
                <TouchableOpacity
                  style={[
                    styles.editBtn,
                    { borderColor: theme.border, marginTop: spacing.sm },
                  ]}
                  onPress={() => router.push("/(app)/provider-listing")}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="briefcase-outline"
                    size={14}
                    color={theme.text}
                  />
                  <Text style={[styles.editBtnText, { color: theme.text }]}>
                    Manage provider listing
                  </Text>
                </TouchableOpacity>
              ) : null}
              {profile?.accountType === "patient" ? (
                <TouchableOpacity
                  style={[
                    styles.editBtn,
                    { borderColor: theme.border, marginTop: spacing.sm },
                  ]}
                  onPress={() => router.push("/(app)/appointments")}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={14}
                    color={theme.text}
                  />
                  <Text style={[styles.editBtnText, { color: theme.text }]}>
                    My appointments
                  </Text>
                </TouchableOpacity>
              ) : null}
              {profile?.accountType === "patient" ? (
                <TouchableOpacity
                  style={[
                    styles.editBtn,
                    { borderColor: theme.border, marginTop: spacing.sm },
                  ]}
                  onPress={() => router.push("/(app)/orders")}
                  activeOpacity={0.8}
                >
                  <Ionicons name="bag-outline" size={14} color={theme.text} />
                  <Text style={[styles.editBtnText, { color: theme.text }]}>
                    My orders
                  </Text>
                </TouchableOpacity>
              ) : null}
              {profile?.accountType === "patient" ? (
                <TouchableOpacity
                  style={[
                    styles.editBtn,
                    { borderColor: theme.border, marginTop: spacing.sm },
                  ]}
                  onPress={() => router.push("/(app)/medical-timeline")}
                  activeOpacity={0.8}
                >
                  <Ionicons name="pulse-outline" size={14} color={theme.text} />
                  <Text style={[styles.editBtnText, { color: theme.text }]}>
                    Medical timeline
                  </Text>
                </TouchableOpacity>
              ) : null}
              {profile?.accountType === "patient" ? (
                <TouchableOpacity
                  style={[
                    styles.editBtn,
                    { borderColor: theme.border, marginTop: spacing.sm },
                  ]}
                  onPress={() => router.push("/(app)/medical-profile")}
                  activeOpacity={0.8}
                >
                  <Ionicons name="clipboard-outline" size={14} color={theme.text} />
                  <Text style={[styles.editBtnText, { color: theme.text }]}>
                    Medical profile
                  </Text>
                </TouchableOpacity>
              ) : null}
              {profile?.accountType && profile.accountType !== "patient" ? (
                <TouchableOpacity
                  style={[
                    styles.editBtn,
                    { borderColor: theme.border, marginTop: spacing.sm },
                  ]}
                  onPress={() => router.push("/(app)/provider-appointments")}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={14}
                    color={theme.text}
                  />
                  <Text style={[styles.editBtnText, { color: theme.text }]}>
                    Appointment requests
                  </Text>
                </TouchableOpacity>
              ) : null}
              {profile?.accountType && profile.accountType !== "patient" ? (
                <TouchableOpacity
                  style={[
                    styles.editBtn,
                    { borderColor: theme.border, marginTop: spacing.sm },
                  ]}
                  onPress={() => router.push("/(app)/provider-orders")}
                  activeOpacity={0.8}
                >
                  <Ionicons name="bag-outline" size={14} color={theme.text} />
                  <Text style={[styles.editBtnText, { color: theme.text }]}>
                    Sales & orders
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* ── Incomplete profile warning ── */}
            <IncompleteProfileBanner
              profile={profile}
              theme={theme}
              router={router}
            />

            {/* ── Identity ── */}
            <Section label="IDENTITY">
              <SettingsCard theme={theme}>
                {/* KYC row — always first, always tappable */}
                {(() => {
                  const isApproved = profile?.kycStatus === "approved";
                  const isSubmitted = profile?.kycStep === "submitted";
                  const isRejected = profile?.kycStatus === "rejected";
                  const kycColor = isApproved
                    ? theme.success
                    : isSubmitted
                      ? brand.gold
                      : isRejected
                        ? theme.error
                        : theme.subtleText;
                  return (
                    <SettingsRow
                      icon={
                        isApproved
                          ? "shield-checkmark-outline"
                          : isSubmitted
                            ? "time-outline"
                            : isRejected
                              ? "close-circle-outline"
                              : "shield-outline"
                      }
                      iconColor={kycColor}
                      label="Identity verification"
                      sublabel={
                        isApproved
                          ? "Your identity has been verified"
                          : isSubmitted
                            ? "Under review — check status"
                            : isRejected
                              ? "Rejected — tap to resubmit"
                              : "Complete KYC to unlock all features"
                      }
                      labelColor={
                        isApproved
                          ? theme.success
                          : isRejected
                            ? theme.error
                            : theme.text
                      }
                      theme={theme}
                      onPress={() => router.push("/(app)/kyc")}
                      showChevron
                    />
                  );
                })()}

                {/* Rejection reason callout — only when rejected with a reason */}
                {profile?.kycStatus === "rejected" &&
                profile?.kycRejectionReason ? (
                  <TouchableOpacity
                    onPress={() => router.push("/(app)/kyc")}
                    activeOpacity={0.8}
                    style={{
                      flexDirection: "row",
                      gap: spacing.sm,
                      backgroundColor: theme.error + "10",
                      borderTopWidth: 1,
                      borderTopColor: theme.error + "30",
                      padding: spacing.lg,
                    }}
                  >
                    <Ionicons
                      name="alert-circle-outline"
                      size={16}
                      color={theme.error}
                      style={{ marginTop: 1 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontFamily: typography.fontFamilySemiBold,
                          fontSize: 12,
                          color: theme.error,
                          marginBottom: 2,
                        }}
                      >
                        Rejection reason
                      </Text>
                      <Text
                        style={{
                          fontFamily: typography.fontFamilyRegular,
                          fontSize: 12,
                          color: theme.error,
                          lineHeight: 18,
                        }}
                      >
                        {profile.kycRejectionReason}
                      </Text>
                      <Text
                        style={{
                          fontFamily: typography.fontFamilySemiBold,
                          fontSize: 11,
                          color: theme.error,
                          marginTop: spacing.xs,
                        }}
                      >
                        Tap to resubmit →
                      </Text>
                    </View>
                  </TouchableOpacity>
                ) : null}
                <InfoRow
                  icon="call-outline"
                  label="Phone"
                  value={profile?.phone}
                  theme={theme}
                />
                <InfoRow
                  icon="calendar-outline"
                  label="Date of birth"
                  value={formatDate(profile?.dateOfBirth)}
                  theme={theme}
                />
                <InfoRow
                  icon="location-outline"
                  label="Address"
                  value={profile?.address}
                  theme={theme}
                />
                <InfoRow
                  icon="business-outline"
                  label="City"
                  value={profile?.city}
                  theme={theme}
                />
                <InfoRow
                  icon="globe-outline"
                  label="Country"
                  value={profile?.country}
                  theme={theme}
                  isLast={!memberSince}
                />
                {memberSince ? (
                  <InfoRow
                    icon="time-outline"
                    label="Member since"
                    value={memberSince}
                    theme={theme}
                    isLast
                  />
                ) : null}
              </SettingsCard>
            </Section>

            {/* ── Appearance ── */}
            <Section label="APPEARANCE">
              <SettingsCard theme={theme}>
                <SettingsRow
                  icon={isDark ? "sunny-outline" : "moon-outline"}
                  label={isDark ? "Light mode" : "Dark mode"}
                  theme={theme}
                  isLast
                  right={
                    <Switch
                      value={isDark}
                      onValueChange={toggleTheme}
                      trackColor={{ false: theme.border, true: theme.primary }}
                      thumbColor={theme.primaryForeground}
                      style={{
                        transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }],
                      }}
                    />
                  }
                />
              </SettingsCard>
            </Section>

            {/* ── Security ── */}
            <Section label="SECURITY">
              <SettingsCard theme={theme}>
                <SettingsRow
                  icon="shield-outline"
                  label="Security centre"
                  sublabel="PIN, sessions & login history"
                  theme={theme}
                  onPress={() => router.push("/(app)/security")}
                  showChevron
                />
                <SettingsRow
                  icon="lock-closed-outline"
                  label="Change password"
                  theme={theme}
                  onPress={() => router.push("/(app)/change-password")}
                  showChevron
                />
                <SettingsRow
                  icon="finger-print-outline"
                  label="Two-factor authentication"
                  theme={theme}
                  onPress={() =>
                    Alert.alert(
                      "Coming soon",
                      "Two-factor authentication will be available in a future update.",
                    )
                  }
                  showChevron
                  isLast
                />
              </SettingsCard>
            </Section>

            {/* ── Notifications ── */}
            <Section label="NOTIFICATIONS">
              <SettingsCard theme={theme}>
                <SettingsRow
                  icon="notifications-outline"
                  label="Push notifications"
                  theme={theme}
                  isLast
                  right={
                    <Switch
                      value={true}
                      onValueChange={() =>
                        Alert.alert(
                          "Coming soon",
                          "Notification preferences will be available soon.",
                        )
                      }
                      trackColor={{ false: theme.border, true: theme.primary }}
                      thumbColor={theme.primaryForeground}
                      style={{
                        transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }],
                      }}
                    />
                  }
                />
              </SettingsCard>
            </Section>

            {/* ── Support ── */}
            <Section label="SUPPORT">
              <SettingsCard theme={theme}>
                <SettingsRow
                  icon="help-circle-outline"
                  label="Help centre"
                  theme={theme}
                  onPress={() =>
                    Alert.alert("Help", "Visit medmap.app/help for support.")
                  }
                  showChevron
                />
                <SettingsRow
                  icon="document-text-outline"
                  label="Privacy policy"
                  theme={theme}
                  onPress={() =>
                    Alert.alert(
                      "Privacy",
                      "Visit medmap.app/privacy to read our policy.",
                    )
                  }
                  showChevron
                />
                <SettingsRow
                  icon="shield-outline"
                  label="Terms of service"
                  theme={theme}
                  onPress={() =>
                    Alert.alert(
                      "Terms",
                      "Visit medmap.app/terms to read our terms.",
                    )
                  }
                  showChevron
                  isLast
                />
              </SettingsCard>
            </Section>

            {/* ── Error ── */}
            {error ? (
              <Text
                style={[
                  ui.errorText(theme),
                  {
                    textAlign: "center",
                    marginHorizontal: layout.screenPaddingHorizontal,
                    marginTop: spacing.lg,
                  },
                ]}
              >
                {error}
              </Text>
            ) : null}

            {/* ── Account actions ── */}
            <Section label="ACCOUNT">
              <SettingsCard theme={theme}>
                <SettingsRow
                  icon="log-out-outline"
                  label="Logout"
                  theme={theme}
                  onPress={() =>
                    Alert.alert("Logout", "Are you sure you want to log out?", [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Logout",
                        style: "destructive",
                        onPress: signOut,
                      },
                    ])
                  }
                  showChevron
                  isLast
                />
              </SettingsCard>
            </Section>

            {/* ── Danger zone ── */}
            <Section label="DANGER ZONE">
              <SettingsCard theme={theme}>
                <SettingsRow
                  icon="trash-outline"
                  label={
                    deletingAccount ? "Deactivating…" : "Deactivate account"
                  }
                  theme={theme}
                  onPress={handleDeleteAccount}
                  labelColor={theme.error}
                  iconColor={theme.error}
                  isLast
                />
              </SettingsCard>
            </Section>
          </>
        )}
      </ScrollView>
      {/* ── Avatar dropdown ── */}
      <Modal
        visible={dropdownVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDropdownVisible(false)}
      >
        {/* Full-screen dismiss area */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setDropdownVisible(false)}
        />

        {/* Dropdown card anchored near avatar */}
        <View
          style={[
            styles.dropdown,
            {
              top: dropdownPos.top,
              left: dropdownPos.left,
              backgroundColor: theme.card,
              borderColor: theme.border,
              shadowColor: "#000",
            },
          ]}
        >
          {/* Small caret pointing up-left toward the avatar */}
          <View
            style={[styles.dropdownCaret, { borderBottomColor: theme.border }]}
          />
          <View
            style={[
              styles.dropdownCaretInner,
              { borderBottomColor: theme.card },
            ]}
          />

          {/* View full photo */}
          {profile?.avatarUrl ? (
            <TouchableOpacity
              style={styles.dropdownRow}
              activeOpacity={0.7}
              onPress={() => {
                setDropdownVisible(false);
                setFullImageVisible(true);
              }}
            >
              <Ionicons name="expand-outline" size={15} color={theme.text} />
              <Text style={[styles.dropdownRowText, { color: theme.text }]}>
                View photo
              </Text>
            </TouchableOpacity>
          ) : null}

          {/* Change / Upload photo */}
          <TouchableOpacity
            style={[
              styles.dropdownRow,
              profile?.avatarUrl && styles.dropdownRowBorder,
              { borderColor: theme.border },
            ]}
            activeOpacity={0.7}
            onPress={pickAndUploadAvatar}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator size={14} color={theme.text} />
            ) : (
              <Ionicons name="camera-outline" size={15} color={theme.text} />
            )}
            <Text style={[styles.dropdownRowText, { color: theme.text }]}>
              {profile?.avatarUrl ? "Change photo" : "Upload photo"}
            </Text>
          </TouchableOpacity>

          {/* Remove photo */}
          {profile?.avatarUrl ? (
            <TouchableOpacity
              style={[
                styles.dropdownRow,
                styles.dropdownRowBorder,
                { borderColor: theme.border },
              ]}
              activeOpacity={0.7}
              onPress={removeAvatar}
              disabled={uploading}
            >
              <Ionicons name="trash-outline" size={15} color={theme.error} />
              <Text style={[styles.dropdownRowText, { color: theme.error }]}>
                Remove photo
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </Modal>

      {/* ── Full image viewer ── */}
      <Modal
        visible={fullImageVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFullImageVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          <Pressable
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
            onPress={() => setFullImageVisible(false)}
          >
            {profile?.avatarUrl ? (
              <Image
                source={{ uri: profile.avatarUrl }}
                style={{
                  width: Dimensions.get("window").width,
                  height: Dimensions.get("window").width,
                }}
                resizeMode="contain"
              />
            ) : null}
          </Pressable>
          <TouchableOpacity
            onPress={() => setFullImageVisible(false)}
            style={styles.fullImageClose}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ── Incomplete profile banner ── */

function IncompleteProfileBanner({ profile, theme, router }) {
  if (!profile) return null;

  const missing = [];
  if (!profile.dateOfBirth) missing.push("dob");
  if (!profile.address) missing.push("address");
  if (!profile.city) missing.push("city");
  if (!profile.country) missing.push("country");

  if (missing.length === 0) return null;

  return (
    <TouchableOpacity
      style={[
        styles.incompleteBanner,
        {
          backgroundColor: theme.secondary,
          borderColor: brand.gold,
        },
      ]}
      onPress={() => router.push("/(app)/profile-edit")}
      activeOpacity={0.8}
    >
      <Ionicons name="warning-outline" size={18} color={brand.gold} />
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        <Text style={[styles.bannerTitle, { color: theme.text }]}>
          Complete your profile
        </Text>
        <Text style={[styles.bannerSub, { color: theme.subtleText }]}>
          Missing:{" "}
          {missing.map((f, i) => (
            <Text key={f}>
              {f}
              {i < missing.length - 1 ? ", " : ""}
            </Text>
          ))}
          . Tap to fill in.
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.subtleText} />
    </TouchableOpacity>
  );
}

/* ── Small layout helpers ── */

function Section({ label, children }) {
  const { theme } = useThemeMode();
  return (
    <View
      style={[
        styles.section,
        { paddingHorizontal: layout.screenPaddingHorizontal },
      ]}
    >
      {label ? (
        <Text style={[styles.sectionLabel, { color: theme.subtleText }]}>
          {label}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

function SettingsCard({ theme, children }) {
  return (
    <View
      style={[
        ui.card(theme),
        { padding: 0, overflow: "hidden", borderRadius: radii.xs },
      ]}
    >
      {children}
    </View>
  );
}

function SettingsRow({
  icon,
  label,
  sublabel,
  theme,
  onPress,
  right,
  showChevron,
  isLast,
  labelColor,
  iconColor,
}) {
  const content = (
    <View
      style={[
        styles.settingsRow,
        { borderBottomColor: theme.border },
        isLast && { borderBottomWidth: 0 },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: theme.secondary }]}>
        <Ionicons name={icon} size={16} color={iconColor || theme.subtleText} />
      </View>
      <View style={{ flex: 1, justifyContent: "center" }}>
        <Text
          style={[styles.settingsLabel, { color: labelColor || theme.text }]}
        >
          {label}
        </Text>
        {sublabel ? (
          <Text
            style={{
              fontFamily: typography.fontFamilyRegular,
              fontSize: 11,
              color: theme.subtleText,
              marginTop: 1,
            }}
          >
            {sublabel}
          </Text>
        ) : null}
      </View>
      {right ? right : null}
      {showChevron ? (
        <Ionicons name="chevron-forward" size={16} color={theme.subtleText} />
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

function InfoRow({ icon, label, value, theme, isLast }) {
  return (
    <View
      style={[
        styles.infoRow,
        { borderBottomColor: theme.border },
        isLast && { borderBottomWidth: 0 },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: theme.secondary }]}>
        <Ionicons name={icon} size={15} color={theme.subtleText} />
      </View>
      <View style={styles.infoContent}>
        <Text style={[styles.infoLabel, { color: theme.subtleText }]}>
          {label}
        </Text>
        <Text
          style={[
            styles.infoValue,
            { color: value ? theme.text : theme.subtleText },
          ]}
        >
          {value || "—"}
        </Text>
      </View>
    </View>
  );
}

const styles = {
  pageHeader: {
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  pageTitle: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 22,
  },
  pageSub: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    marginTop: 2,
  },
  loadingBox: {
    paddingVertical: spacing["3xl"],
    alignItems: "center",
  },
  heroSection: {
    alignItems: "center",
    paddingTop: spacing["2xl"],
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingBottom: spacing.xl,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 28,
  },
  cameraChip: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 20,
    textAlign: "center",
  },
  email: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: 13,
    marginTop: 4,
    textAlign: "center",
  },
  bio: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: 13,
    marginTop: spacing.sm,
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 280,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
    marginTop: spacing.md,
  },
  badgeText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 11,
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  editBtnText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 13,
  },
  section: {
    marginTop: spacing.xl,
  },
  sectionLabel: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    gap: spacing.md,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsLabel: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: 14,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    gap: spacing.md,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 11,
    marginBottom: 2,
  },
  infoValue: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: 14,
  },
  textLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: spacing.sm,
  },
  textLinkText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 13,
  },
  dropdown: {
    position: "absolute",
    width: 172,
    borderRadius: radii.sm,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 10,
    overflow: "visible",
  },
  dropdownCaret: {
    position: "absolute",
    top: -8,
    left: 12,
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  dropdownCaretInner: {
    position: "absolute",
    top: -6,
    left: 13,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 7,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  dropdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
  },
  dropdownRowBorder: {
    borderTopWidth: 1,
  },
  dropdownRowText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 13,
  },
  fullImageClose: {
    position: "absolute",
    top: 52,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  incompleteBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: layout.screenPaddingHorizontal,
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radii.xs,
    borderWidth: 1,
  },
  bannerTitle: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 13,
    marginBottom: 3,
  },
  bannerSub: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    lineHeight: 17,
  },
};
