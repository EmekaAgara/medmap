import { useState } from "react";
import { Link, useRouter } from "expo-router";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiRequest } from "../../lib/api";
import { useAuth, useThemeMode } from "../_layout";
import ScreenHeader from "../components/ScreenHeader";
import { ui, spacing, typography, layout, brand } from "../../theme/tokens";
const LOGO_IMAGE = require("../../assets/icon.png");

export default function LoginScreen() {
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hidePassword, setHidePassword] = useState(true);
  const [focusedField, setFocusedField] = useState(null);
  const router = useRouter();
  const { signIn } = useAuth();
  const { theme } = useThemeMode();

  const onSubmit = async () => {
    const trimmed = emailOrPhone.trim();
    if (!trimmed) {
      setError("Please enter your email or phone.");
      return;
    }
    // If the identifier looks like an email, validate its shape
    if (trimmed.includes("@")) {
      const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
      if (!emailRegex.test(trimmed)) {
        setError("Please enter a valid email address.");
        return;
      }
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    try {
      setFocusedField(null);
      setLoading(true);
      setError("");
      const res = await apiRequest("/auth/login", {
        method: "POST",
        body: { emailOrPhone: trimmed, password },
      });
      if (res && res.data) {
        await signIn(res.data);
      }
      router.replace("/(app)/home");
    } catch (e) {
      // Unverified email — take them straight to the OTP screen
      if (e.status === 403 || e.message?.toLowerCase().includes('verify your email')) {
        router.push({ pathname: '/otp-verification', params: { email: trimmed } });
      } else {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: theme.background }]}
      edges={["top"]}
    >
      <ScreenHeader title="Login" />
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
              Welcome back
            </Text>
            <Text style={[styles.subtitle, { color: theme.subtleText }]}>
              Login to continue with your MedMap account.
            </Text>

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

            <View style={styles.form}>
              <View style={styles.inputWrap}>
                <Text style={[styles.inputLabel, { color: theme.subtleText }]}>
                  Email or phone
                </Text>
                <TextInput
                  style={[
                    ui.input(theme),
                    styles.input,
                    focusedField === "emailOrPhone" && styles.inputActive,
                  ]}
                  placeholder="you@example.com or phone"
                  placeholderTextColor={theme.subtleText}
                  value={emailOrPhone}
                  onChangeText={setEmailOrPhone}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setFocusedField("emailOrPhone")}
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
                  placeholder="Enter your password"
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
                  <Text style={ui.buttonTextPrimary(theme)}>Continue</Text>
                )}
              </TouchableOpacity>

              <Link href="/forgot-password" asChild>
                <TouchableOpacity style={styles.linkWrap}>
                  <Text style={ui.link(theme)}>Forgot password?</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>

          <View style={styles.spacer} />
          <View style={styles.footerRow}>
            <Text style={ui.caption(theme)}>New to MedMap?</Text>
            <Link href="/register" asChild>
              <TouchableOpacity>
                <Text style={ui.link(theme)}>Create account</Text>
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
  spacer: { flex: 1 },
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
  inputLabel: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 13,
    marginBottom: spacing.xs,
  },
  input: {},
  inputActive: {
    borderColor: brand.gold,
  },
  inputRight: {
    paddingRight: 44,
  },
  eyeBtn: {
    position: "absolute",
    right: 18,
    top: 40,
    zIndex: 1,
  },
  primaryButton: { marginTop: spacing.lg },
  linkWrap: { marginTop: spacing.lg, alignItems: "center" },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  logoImageWrap: {
    alignItems: "left",
    marginBottom: spacing.md,
  },
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: 24,
  },
  logoWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
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
    marginBottom: spacing.lg,
  },
};
