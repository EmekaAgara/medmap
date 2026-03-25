import { useState } from "react";
import { Link, useRouter } from "expo-router";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiRequest } from "../../lib/api";
import ScreenHeader from "../components/ScreenHeader";
import { useThemeMode } from "../_layout";
import { ui, spacing, typography, layout } from "../../theme/tokens";
const LOGO_IMAGE = require("../../assets/icon.png");

export default function RegisterScreen() {
  const ACCOUNT_TYPES = [
    { value: "patient", label: "Patient" },
    { value: "doctor", label: "Doctor" },
    { value: "hospital_admin", label: "Hospital admin" },
    { value: "pharmacy_admin", label: "Pharmacy admin" },
  ];
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [accountType, setAccountType] = useState("patient");
  const [accountTypeOpen, setAccountTypeOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hidePassword, setHidePassword] = useState(true);
  const [focusedField, setFocusedField] = useState(null);
  const router = useRouter();
  const { theme } = useThemeMode();

  const onSubmit = async () => {
    // basic client-side validation so incomplete/invalid data is not sent
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName) {
      setError("Please enter your full name.");
      return;
    }

    if (!trimmedEmail) {
      setError("Please enter your email.");
      return;
    }

    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!trimmedPhone) {
      setError("Please enter your phone number.");
      return;
    }

    // basic phone validation: digits only, 8–15 characters
    const phoneDigits = trimmedPhone.replace(/[^\d]/g, "");
    if (phoneDigits.length < 8 || phoneDigits.length > 15) {
      setError("Please enter a valid phone number.");
      return;
    }

    // simple "secure password" rule: min 8 chars, upper, lower, number
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(password)) {
      setError(
        "Password must be at least 8 characters and include upper, lower, and a number.",
      );
      return;
    }

    if (!confirmPassword) {
      setError("Please confirm your password.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setFocusedField(null);
      setLoading(true);
      setError("");

      // Backend should treat this as "start registration" and only
      // fully activate the account after email/OTP verification.
      await apiRequest("/auth/register", {
        method: "POST",
        body: {
          fullName: trimmedName,
          email: trimmedEmail,
          phone: trimmedPhone,
          password,
          accountType,
        },
      });

      // Email verification step – user must verify before using the app
      router.replace({ pathname: "/otp-verification", params: { email: trimmedEmail } });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: theme.background }]}
      edges={["top"]}
    >
      <ScreenHeader title="Create account" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.body}>
            <View style={styles.logoImageWrap}>
              <Image
                source={LOGO_IMAGE}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={[styles.title, { color: theme.text }]}>
              Create your MedMap account
            </Text>
            <Text style={[styles.subtitle, { color: theme.subtleText }]}>
              Join nearby lenders and borrowers in a few simple steps.
            </Text>

            <View style={styles.form}>
              {error ? (
                <View
                  style={[
                    styles.errorWrap,
                    { backgroundColor: theme.error + "18" },
                  ]}
                >
                  <Ionicons name="alert-circle" size={18} color={theme.error} />
                  <Text style={[ui.errorText(theme), styles.errorText]}>
                    {error}
                  </Text>
                </View>
              ) : null}

              <View style={styles.inputWrap}>
                <Text style={[styles.inputLabel, { color: theme.subtleText }]}>
                  Who are you
                </Text>
                <Pressable
                  onPress={() => setAccountTypeOpen((prev) => !prev)}
                  style={[ui.input(theme), styles.dropdownTrigger]}
                >
                  <Text style={{ color: theme.text }}>
                    {ACCOUNT_TYPES.find((item) => item.value === accountType)?.label || "Select"}
                  </Text>
                  <Ionicons
                    name={accountTypeOpen ? "chevron-up-outline" : "chevron-down-outline"}
                    size={18}
                    color={theme.subtleText}
                  />
                </Pressable>
                {accountTypeOpen ? (
                  <View style={[styles.dropdownMenu, { borderColor: theme.border, backgroundColor: theme.card }]}>
                    {ACCOUNT_TYPES.map((type, idx) => (
                      <Pressable
                        key={type.value}
                        onPress={() => {
                          setAccountType(type.value);
                          setAccountTypeOpen(false);
                        }}
                        style={[
                          styles.dropdownItem,
                          idx < ACCOUNT_TYPES.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border },
                        ]}
                      >
                        <Text
                          style={{
                            color: accountType === type.value ? theme.primary : theme.text,
                            fontFamily: typography.fontFamilyMedium,
                          }}
                        >
                          {type.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>

              <View style={styles.inputWrap}>
                <Text style={[styles.inputLabel, { color: theme.subtleText }]}>
                  Full name
                </Text>
                <TextInput
                  style={[
                    ui.input(theme),
                    styles.input,
                    focusedField === "fullName" && styles.inputActive,
                  ]}
                  placeholder="Enter your full name"
                  placeholderTextColor={theme.subtleText}
                  value={fullName}
                  onChangeText={setFullName}
                  onFocus={() => setFocusedField("fullName")}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
              <View style={styles.inputWrap}>
                <Text style={[styles.inputLabel, { color: theme.subtleText }]}>
                  Email
                </Text>
                <TextInput
                  style={[
                    ui.input(theme),
                    styles.input,
                    focusedField === "email" && styles.inputActive,
                  ]}
                  placeholder="you@example.com"
                  placeholderTextColor={theme.subtleText}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  onFocus={() => setFocusedField("email")}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
              <View style={styles.inputWrap}>
                <Text style={[styles.inputLabel, { color: theme.subtleText }]}>
                  Phone number
                </Text>
                <TextInput
                  style={[
                    ui.input(theme),
                    styles.input,
                    focusedField === "phone" && styles.inputActive,
                  ]}
                  placeholder="Enter your phone number"
                  placeholderTextColor={theme.subtleText}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  onFocus={() => setFocusedField("phone")}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
              <View style={styles.inputWrap}>
                <Text style={[styles.inputLabel, { color: theme.subtleText }]}>
                  Password
                </Text>
                <TextInput
                  style={[
                    ui.input(theme),
                    styles.input,
                    styles.inputRight,
                    focusedField === "password" && styles.inputActive,
                  ]}
                  placeholder="Create a password"
                  placeholderTextColor={theme.subtleText}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={hidePassword}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setHidePassword(!hidePassword)}
                  hitSlop={12}
                >
                  <Ionicons
                    name={hidePassword ? "eye-outline" : "eye-off-outline"}
                    size={20}
                    color={theme.subtleText}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.inputWrap}>
                <Text style={[styles.inputLabel, { color: theme.subtleText }]}>
                  Confirm password
                </Text>
                <TextInput
                  style={[
                    ui.input(theme),
                    styles.input,
                    styles.inputRight,
                    focusedField === "confirmPassword" && styles.inputActive,
                  ]}
                  placeholder="Re-enter your password"
                  placeholderTextColor={theme.subtleText}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={hidePassword}
                  onFocus={() => setFocusedField("confirmPassword")}
                  onBlur={() => setFocusedField(null)}
                />
              </View>

              <TouchableOpacity
                style={[ui.buttonPrimary(theme), styles.primaryButton]}
                onPress={onSubmit}
                disabled={loading}
                activeOpacity={0.9}
              >
                {loading ? (
                  <ActivityIndicator
                    size="small"
                    color={theme.primaryForeground}
                  />
                ) : (
                  <Text style={ui.buttonTextPrimary(theme)}>
                    Create account
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.spacer} />
          <View style={styles.footerRow}>
            <Text style={ui.caption(theme)}>Already have an account?</Text>
            <Link href="/login" asChild>
              <TouchableOpacity>
                <Text style={ui.link(theme)}>Login</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = {
  safe: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingBottom: spacing["3xl"],
  },
  body: {
    paddingTop: spacing["3xl"],
  },
  logoImageWrap: {
    alignItems: "left",
    marginBottom: spacing.lg,
  },
  logoImage: {
    width: 80,
    height: 80,
    // borderRadius: 24,
  },
  form: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  errorWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.lg,
  },
  errorText: { flex: 1 },
  inputWrap: { marginBottom: spacing.lg },
  dropdownTrigger: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dropdownMenu: {
    marginTop: spacing.xs,
    borderWidth: 1,
    borderRadius: 10,
    overflow: "hidden",
  },
  dropdownItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  inputLabel: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 13,
    marginBottom: spacing.xs,
  },
  input: {},
  inputActive: {
    borderColor: "rgba(212,175,55,0.9)",
  },
  inputRight: { paddingRight: 44 },
  eyeBtn: {
    position: "absolute",
    right: 18,
    top: 40,
    zIndex: 1,
  },
  primaryButton: { marginTop: spacing.lg },
  spacer: { flex: 1 },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  logoWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  logoText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 18,
    letterSpacing: 0.3,
  },
  title: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 22,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: 14,
    opacity: 0.8,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
};
