import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiRequest } from '../../lib/api';
import ScreenHeader from '../components/ScreenHeader';
import { useThemeMode } from '../_layout';
import { ui, spacing, radii, layout, typography } from '../../theme/tokens';

export default function OtpVerificationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const emailFromParams = typeof params.email === 'string' ? params.email : '';
  const [email, setEmail] = useState(emailFromParams);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(60);
  const timerRef = useRef(null);
  const { theme } = useThemeMode();

  // Countdown timer for resend cooldown
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(timerRef.current); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const onResend = async () => {
    if (countdown > 0 || !email) return;
    try {
      setResending(true);
      setError('');
      await apiRequest('/auth/login/request-otp', {
        method: 'POST',
        body: { emailOrPhone: email },
      });
      setCountdown(60);
      timerRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) { clearInterval(timerRef.current); return 0; }
          return c - 1;
        });
      }, 1000);
      Alert.alert('Code sent', 'A new verification code has been sent to your email.');
    } catch (e) {
      // Fall back to email-verification resend if the account is not yet verified
      try {
        await apiRequest('/auth/verify-email/resend', {
          method: 'POST',
          body: { email },
        });
        setCountdown(60);
        Alert.alert('Code sent', 'A new verification code has been sent to your email.');
      } catch {
        setError('Could not resend code. Please try again.');
      }
    } finally {
      setResending(false);
    }
  };

  const onSubmit = async () => {
    try {
      setLoading(true);
      setError('');
      await apiRequest('/auth/verify-email', {
        method: 'POST',
        body: { email, code },
      });
      Alert.alert('Email verified', 'Your email has been successfully verified.', [
        {
          text: 'OK',
          onPress: () => router.replace('/login'),
        },
      ]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <ScreenHeader title="Verify email" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={[styles.card, { borderColor: theme.border }]}>
            <View style={[styles.iconWrap, { backgroundColor: theme.secondary }]}>
              <Ionicons name="mail-open-outline" size={32} color={theme.primary} />
            </View>
            <Text style={[ui.body(theme), styles.hint]}>
              We sent a verification code to your email. Enter it below.
            </Text>
            {error ? (
              <View style={[styles.errorWrap, { backgroundColor: theme.error + '18' }]}>
                <Ionicons name="alert-circle" size={18} color={theme.error} />
                <Text style={[ui.errorText(theme), styles.errorText]}>{error}</Text>
              </View>
            ) : null}
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={20} color={theme.subtleText} style={styles.inputIcon} />
              <TextInput
                style={[ui.input(theme), styles.input]}
                placeholder="Email"
                placeholderTextColor={theme.subtleText}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>
            <View style={styles.inputWrap}>
              <Ionicons name="keypad-outline" size={20} color={theme.subtleText} style={styles.inputIcon} />
              <TextInput
                style={[ui.input(theme), styles.input]}
                placeholder="Verification code"
                placeholderTextColor={theme.subtleText}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
              />
            </View>
            <TouchableOpacity
              style={[ui.buttonPrimary(theme), styles.primaryButton]}
              onPress={onSubmit}
              disabled={loading}
              activeOpacity={0.9}
            >
              {loading
                ? <ActivityIndicator color={theme.primaryForeground} />
                : <Text style={ui.buttonTextPrimary(theme)}>Verify</Text>}
            </TouchableOpacity>

            {/* Resend code */}
            <TouchableOpacity
              onPress={onResend}
              disabled={countdown > 0 || resending}
              activeOpacity={0.7}
              style={{ marginTop: spacing.lg, alignItems: 'center' }}
            >
              {resending ? (
                <ActivityIndicator size="small" color={theme.subtleText} />
              ) : (
                <Text style={{ fontFamily: typography.fontFamilyMedium, fontSize: 13, color: countdown > 0 ? theme.subtleText : theme.text }}>
                  {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code'}
                </Text>
              )}
            </TouchableOpacity>
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
    paddingTop: spacing['2xl'],
    paddingBottom: spacing['3xl'],
  },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.xl,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  hint: {
    textAlign: 'center',
    marginBottom: spacing.xl,
    opacity: 0.9,
  },
  errorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.lg,
  },
  errorText: { flex: 1 },
  inputWrap: { position: 'relative', marginBottom: spacing.lg },
  inputIcon: {
    position: 'absolute',
    left: 14,
    top: 16,
    zIndex: 1,
  },
  input: { paddingLeft: 44 },
  primaryButton: { marginTop: spacing.sm },
};
