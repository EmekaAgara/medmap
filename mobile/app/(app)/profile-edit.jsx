import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import { useThemeMode, useAuth } from "../_layout";
import ScreenHeader from "../components/ScreenHeader";
import { ui, spacing, typography, layout, brand } from "../../theme/tokens";
import { apiRequest } from "../../src/api/client";

const GOLD = brand.gold;

export default function EditProfileScreen() {
  const { theme } = useThemeMode();
  const { token, updateUser } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState(null);
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [dobDate, setDobDate] = useState(null);
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [accountType, setAccountType] = useState("patient");
  const [accountTypeOpen, setAccountTypeOpen] = useState(false);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest("/users/me", { method: "GET", token });
        const p = res.data;
        setProfile(p);
        setFullName(p.fullName || "");
        setBio(p.bio || "");
        setAddress(p.address || "");
        setCity(p.city || "");
        setCountry(p.country || "");
        setAccountType(p.accountType || "patient");
        if (p.location?.coordinates?.length === 2) {
          setLongitude(String(p.location.coordinates[0]));
          setLatitude(String(p.location.coordinates[1]));
        }
        if (p.dateOfBirth) {
          setDobDate(new Date(p.dateOfBirth));
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setFetching(false);
      }
    })();
  }, [token]);

  const onDateChange = (event, selectedDate) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }
    if (event.type === "dismissed") return;
    if (selectedDate) {
      setDobDate(selectedDate);
    }
  };

  const onSave = async () => {
    setError("");
    setNotice("");

    if (!fullName.trim()) {
      setError("Full name is required.");
      return;
    }

    if (bio.trim().length > 300) {
      setError("Bio cannot exceed 300 characters.");
      return;
    }

    try {
      setLoading(true);
      const originalType = profile?.accountType || "patient";
      const requestedType = accountType;
      const res = await apiRequest("/users/me", {
        method: "PUT",
        token,
        body: {
          fullName: fullName.trim(),
          bio: bio.trim(),
          address: address.trim(),
          city: city.trim(),
          country: country.trim(),
          accountType,
          ...(dobDate ? { dateOfBirth: dobDate.toISOString() } : {}),
        },
      });
      if (latitude.trim() && longitude.trim()) {
        await apiRequest("/users/me/location", {
          method: "PUT",
          token,
          body: {
            latitude: Number(latitude),
            longitude: Number(longitude),
          },
        });
      }
      if (requestedType !== originalType && res?.data?.accountTypeChangeStatus === "pending") {
        setNotice("Your profile type change request has been submitted and is pending admin approval.");
      }
      await updateUser(res.data);
      router.navigate({
        pathname: "/(app)/(tabs)/profile",
        params: { r: Date.now() },
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: theme.background,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator color={theme.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.background }}
      edges={["top"]}
    >
      <ScreenHeader title="Edit profile" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: layout.screenPaddingHorizontal,
            paddingBottom: spacing["2xl"],
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {error ? (
            <Text
              style={[
                ui.errorText(theme),
                { marginBottom: spacing.lg, textAlign: "center" },
              ]}
            >
              {error}
            </Text>
          ) : null}
          {notice ? (
            <Text
              style={[
                ui.caption(theme),
                { marginBottom: spacing.lg, textAlign: "center", color: theme.success },
              ]}
            >
              {notice}
            </Text>
          ) : null}

          {/* ── Contact information ── */}
          <View style={{ marginTop: spacing.lg, marginBottom: spacing.xl }}>
            <Text
              style={{
                fontFamily: typography.fontFamilySemiBold,
                fontSize: 11,
                letterSpacing: 0.8,
                color: theme.subtleText,
                marginBottom: spacing.sm,
              }}
            >
              CONTACT INFORMATION
            </Text>
            <View style={[ui.card(theme), { padding: 0, overflow: "hidden" }]}>
              <ContactRow
                icon="mail-outline"
                label="Email"
                value={profile?.email || "—"}
                onPress={() =>
                  router.push({
                    pathname: "/(app)/change-contact",
                    params: { type: "email" },
                  })
                }
                theme={theme}
              />
              <ContactRow
                icon="call-outline"
                label="Phone"
                value={profile?.phone || "—"}
                onPress={() =>
                  router.push({
                    pathname: "/(app)/change-contact",
                    params: { type: "phone" },
                  })
                }
                theme={theme}
                isLast
              />
            </View>
          </View>

          <View style={{ marginBottom: spacing.xs }}>
            <Text
              style={{
                fontFamily: typography.fontFamilySemiBold,
                fontSize: 11,
                letterSpacing: 0.8,
                color: theme.subtleText,
                marginBottom: spacing.sm,
              }}
            >
              PERSONAL INFORMATION
            </Text>
          </View>

          <View>
            <View style={{ marginBottom: spacing.lg }}>
              <Text
                style={{
                  fontFamily: typography.fontFamilyMedium,
                  fontSize: 13,
                  marginBottom: spacing.xs,
                  color: theme.subtleText,
                }}
              >
                Who are you
              </Text>
              <Pressable
                onPress={() => setAccountTypeOpen((prev) => !prev)}
                style={[
                  ui.input(theme),
                  {
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  },
                ]}
              >
                <Text style={{ color: theme.text }}>
                  {{
                    patient: "Patient",
                    doctor: "Doctor",
                    hospital_admin: "Hospital admin",
                    pharmacy_admin: "Pharmacy admin",
                  }[accountType] || "Select"}
                </Text>
                <Ionicons
                  name={
                    accountTypeOpen
                      ? "chevron-up-outline"
                      : "chevron-down-outline"
                  }
                  size={18}
                  color={theme.subtleText}
                />
              </Pressable>
              {accountTypeOpen ? (
                <View
                  style={[
                    ui.card(theme),
                    { marginTop: spacing.xs, padding: 0, overflow: "hidden" },
                  ]}
                >
                  {[
                    ["patient", "Patient"],
                    ["doctor", "Doctor"],
                    ["hospital_admin", "Hospital admin"],
                    ["pharmacy_admin", "Pharmacy admin"],
                  ].map(([value, label], idx, arr) => (
                    <Pressable
                      key={value}
                      onPress={() => {
                        setAccountType(value);
                        setAccountTypeOpen(false);
                      }}
                      style={{
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.md,
                        borderBottomWidth: idx < arr.length - 1 ? 1 : 0,
                        borderBottomColor: theme.border,
                      }}
                    >
                      <Text
                        style={{
                          color: accountType === value ? GOLD : theme.text,
                          fontFamily: typography.fontFamilyMedium,
                        }}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
            <Field
              label="Full name"
              name="fullName"
              value={fullName}
              onChangeText={setFullName}
              placeholder="John Doe"
              theme={theme}
              focusedField={focusedField}
              setFocusedField={setFocusedField}
            />
            <Field
              label="Bio"
              name="bio"
              value={bio}
              onChangeText={setBio}
              placeholder="A short bio about yourself"
              theme={theme}
              focusedField={focusedField}
              setFocusedField={setFocusedField}
              multiline
              inputStyle={{
                height: 80,
                paddingTop: spacing.md,
                textAlignVertical: "top",
              }}
            />
            <DatePickerField
              label="Date of birth"
              value={dobDate}
              onPress={() => setShowDatePicker(true)}
              theme={theme}
            />
            <Field
              label="Address"
              name="address"
              value={address}
              onChangeText={setAddress}
              placeholder="123 Main Street"
              theme={theme}
              focusedField={focusedField}
              setFocusedField={setFocusedField}
            />
            <Field
              label="City"
              name="city"
              value={city}
              onChangeText={setCity}
              placeholder="Lagos"
              theme={theme}
              focusedField={focusedField}
              setFocusedField={setFocusedField}
            />
            <Field
              label="Country"
              name="country"
              value={country}
              onChangeText={setCountry}
              placeholder="Nigeria"
              theme={theme}
              focusedField={focusedField}
              setFocusedField={setFocusedField}
            />
            <Field
              label="Latitude (optional)"
              name="latitude"
              value={latitude}
              onChangeText={setLatitude}
              placeholder="e.g. 6.5244"
              theme={theme}
              focusedField={focusedField}
              setFocusedField={setFocusedField}
            />
            <Field
              label="Longitude (optional)"
              name="longitude"
              value={longitude}
              onChangeText={setLongitude}
              placeholder="e.g. 3.3792"
              theme={theme}
              focusedField={focusedField}
              setFocusedField={setFocusedField}
            />
          </View>

          <TouchableOpacity
            style={[ui.buttonPrimary(theme), { marginTop: spacing["2xl"] }]}
            onPress={onSave}
            disabled={loading}
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator color={theme.primaryForeground} />
            ) : (
              <Text style={ui.buttonTextPrimary(theme)}>Save changes</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Android date picker ── */}
      {Platform.OS === "android" && showDatePicker && (
        <DateTimePicker
          value={dobDate || new Date(2000, 0, 1)}
          mode="date"
          display="default"
          onChange={onDateChange}
          maximumDate={new Date()}
          minimumDate={new Date(1900, 0, 1)}
        />
      )}

      {/* ── iOS date picker modal ── */}
      {Platform.OS === "ios" && (
        <Modal
          visible={showDatePicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <Pressable
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }}
            onPress={() => setShowDatePicker(false)}
          />
          <View
            style={{
              backgroundColor: theme.card,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingBottom: 32,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                borderBottomWidth: 1,
                borderBottomColor: theme.border,
              }}
            >
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <Text
                  style={{
                    fontFamily: typography.fontFamilyRegular,
                    fontSize: 15,
                    color: theme.subtleText,
                  }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <Text
                style={{
                  fontFamily: typography.fontFamilySemiBold,
                  fontSize: 15,
                  color: theme.text,
                }}
              >
                Date of birth
              </Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <Text
                  style={{
                    fontFamily: typography.fontFamilySemiBold,
                    fontSize: 15,
                    color: GOLD,
                  }}
                >
                  Done
                </Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={dobDate || new Date(2000, 0, 1)}
              mode="date"
              display="spinner"
              onChange={onDateChange}
              maximumDate={new Date()}
              minimumDate={new Date(1900, 0, 1)}
              style={{ height: 200 }}
            />
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

function Field({
  label,
  name,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  inputStyle,
  theme,
  focusedField,
  setFocusedField,
}) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text
        style={{
          fontFamily: typography.fontFamilyMedium,
          fontSize: 13,
          marginBottom: spacing.xs,
          color: theme.subtleText,
        }}
      >
        {label}
      </Text>
      <TextInput
        style={[
          ui.input(theme),
          focusedField === name && { borderColor: GOLD },
          inputStyle,
        ]}
        placeholderTextColor={theme.subtleText}
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocusedField(name)}
        onBlur={() => setFocusedField(null)}
        keyboardType={keyboardType || "default"}
        multiline={multiline}
        autoCapitalize="words"
      />
    </View>
  );
}

function DatePickerField({ label, value, onPress, theme }) {
  const dd = value ? String(value.getDate()).padStart(2, "0") : null;
  const mm = value ? String(value.getMonth() + 1).padStart(2, "0") : null;
  const yyyy = value ? value.getFullYear() : null;
  const display = value ? `${dd}/${mm}/${yyyy}` : null;

  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text
        style={{
          fontFamily: typography.fontFamilyMedium,
          fontSize: 13,
          marginBottom: spacing.xs,
          color: theme.subtleText,
        }}
      >
        {label}
      </Text>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={[
          ui.input(theme),
          {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          },
        ]}
      >
        <Text
          style={{
            fontFamily: typography.fontFamilyRegular,
            fontSize: 15,
            color: display ? theme.text : theme.subtleText,
            flex: 1,
          }}
        >
          {display || "Select date"}
        </Text>
        <Ionicons name="calendar-outline" size={18} color={theme.subtleText} />
      </TouchableOpacity>
    </View>
  );
}

function ContactRow({ icon, label, value, onPress, theme, isLast }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: theme.border,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          backgroundColor: theme.secondary,
          alignItems: "center",
          justifyContent: "center",
          marginRight: spacing.md,
        }}
      >
        <Ionicons name={icon} size={16} color={theme.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: typography.fontFamilyMedium,
            fontSize: 12,
            color: theme.subtleText,
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            fontFamily: typography.fontFamilyMedium,
            fontSize: 14,
            color: theme.text,
            marginTop: 2,
          }}
        >
          {value}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.subtleText} />
    </TouchableOpacity>
  );
}
