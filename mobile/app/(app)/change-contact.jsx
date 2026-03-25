import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeMode, useAuth } from '../_layout';
import ScreenHeader from '../components/ScreenHeader';
import { ui, spacing, typography, layout, brand } from '../../theme/tokens';
import { apiRequest } from '../../src/api/client';

const GOLD = brand.gold;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9]{7,15}$/;

/*
  Email flow — 3 steps:
    1. request   → POST /users/me/change-email          (sends OTP to old email)
    2. verify-old → POST /users/me/change-email/verify-old (sends OTP to new email)
    3. verify-new → POST /users/me/change-email/verify-new (commits the change)

  Phone flow — 2 steps:
    1. request   → POST /users/me/change-phone          (sends OTP to current email)
    2. verify    → POST /users/me/change-phone/verify   (commits the change)
*/

export default function ChangeContactScreen() {
  const { type } = useLocalSearchParams();
  const isEmail = type === 'email';

  const { theme } = useThemeMode();
  const { token, user, updateUser } = useAuth();
  const router = useRouter();

  // step: 'request' | 'verify-old' | 'verify-new' | 'verify' (phone)
  const [step, setStep] = useState('request');
  const [newValue, setNewValue] = useState('');
  const [codeOld, setCodeOld] = useState('');
  const [codeNew, setCodeNew] = useState('');
  const [focusedField, setFocusedField] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Derived UI strings ──────────────────────────────────────────────────────
  const title = isEmail ? 'Change email' : 'Change phone';

  const steps = isEmail
    ? ['New email', 'Verify old', 'Verify new']
    : ['New phone', 'Confirm'];

  const currentStepIndex = isEmail
    ? { request: 0, 'verify-old': 1, 'verify-new': 2 }[step]
    : { request: 0, verify: 1 }[step];

  // ── Handlers ────────────────────────────────────────────────────────────────

  const onRequest = async () => {
    setError('');
    const val = newValue.trim();

    if (!val) {
      setError(`Please enter your new ${isEmail ? 'email address' : 'phone number'}.`);
      return;
    }
    if (isEmail && !EMAIL_REGEX.test(val)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!isEmail && !PHONE_REGEX.test(val)) {
      setError('Please enter a valid phone number (7–15 digits).');
      return;
    }

    try {
      setLoading(true);
      const endpoint = isEmail ? '/users/me/change-email' : '/users/me/change-phone';
      const body = isEmail ? { newEmail: val } : { newPhone: val };
      await apiRequest(endpoint, { method: 'POST', token, body });
      setStep(isEmail ? 'verify-old' : 'verify');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const onVerifyOld = async () => {
    setError('');
    if (!codeOld.trim() || codeOld.trim().length < 6) {
      setError('Please enter the 6-digit code we sent to your current email.');
      return;
    }
    try {
      setLoading(true);
      await apiRequest('/users/me/change-email/verify-old', {
        method: 'POST',
        token,
        body: { code: codeOld.trim() },
      });
      setStep('verify-new');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const onVerifyNew = async () => {
    setError('');
    if (!codeNew.trim() || codeNew.trim().length < 6) {
      setError('Please enter the 6-digit code we sent to your new email.');
      return;
    }
    try {
      setLoading(true);
      const res = await apiRequest('/users/me/change-email/verify-new', {
        method: 'POST',
        token,
        body: { code: codeNew.trim() },
      });
      await updateUser(res.data);
      Alert.alert('Email updated', 'Your email address has been updated successfully.', [
        { text: 'OK', onPress: () => router.navigate({ pathname: '/(app)/(tabs)/profile', params: { r: Date.now() } }) },
      ]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const onVerifyPhone = async () => {
    setError('');
    if (!codeOld.trim() || codeOld.trim().length < 6) {
      setError('Please enter the 6-digit code we sent to your email.');
      return;
    }
    try {
      setLoading(true);
      const res = await apiRequest('/users/me/change-phone/verify', {
        method: 'POST',
        token,
        body: { code: codeOld.trim() },
      });
      await updateUser(res.data);
      Alert.alert('Phone updated', 'Your phone number has been updated successfully.', [
        { text: 'OK', onPress: () => router.navigate({ pathname: '/(app)/(tabs)/profile', params: { r: Date.now() } }) },
      ]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'bottom']}>
      <ScreenHeader title={title} />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: layout.screenPaddingHorizontal,
          paddingBottom: spacing['2xl'],
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Step indicator ── */}
        <StepBar steps={steps} current={currentStepIndex} theme={theme} />

        {/* ── Error ── */}
        {error ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              backgroundColor: theme.error + '18',
              padding: spacing.md,
              borderRadius: 8,
              marginBottom: spacing.lg,
            }}
          >
            <Ionicons name="alert-circle" size={18} color={theme.error} />
            <Text style={[ui.errorText(theme), { flex: 1 }]}>{error}</Text>
          </View>
        ) : null}

        {/* ── Step 1: enter new value ── */}
        {step === 'request' && (
          <StepSection
            heading={isEmail ? 'Enter your new email' : 'Enter your new phone number'}
            hint={
              isEmail
                ? `We'll first send a security code to ${user?.email || 'your current email'} to confirm it's you.`
                : `We'll send a confirmation code to ${user?.email || 'your current email'}.`
            }
            theme={theme}
          >
            <Field
              label={isEmail ? 'New email address' : 'New phone number'}
              name="newValue"
              value={newValue}
              onChangeText={setNewValue}
              placeholder={isEmail ? 'new@email.com' : '+2348000000000'}
              keyboardType={isEmail ? 'email-address' : 'phone-pad'}
              icon={isEmail ? 'mail-outline' : 'call-outline'}
              theme={theme}
              focusedField={focusedField}
              setFocusedField={setFocusedField}
            />
            <PrimaryButton label="Send verification code" loading={loading} onPress={onRequest} theme={theme} />
          </StepSection>
        )}

        {/* ── Step 2 (email): verify old email ── */}
        {step === 'verify-old' && (
          <StepSection
            heading="Check your current email"
            hint={`We sent a 6-digit security code to ${user?.email || 'your current email'}. Enter it below to confirm it's you.`}
            theme={theme}
          >
            <Field
              label="Security code (current email)"
              name="codeOld"
              value={codeOld}
              onChangeText={setCodeOld}
              placeholder="123456"
              keyboardType="number-pad"
              icon="shield-checkmark-outline"
              theme={theme}
              focusedField={focusedField}
              setFocusedField={setFocusedField}
            />
            <PrimaryButton label="Continue" loading={loading} onPress={onVerifyOld} theme={theme} />
            <BackLink onPress={() => { setStep('request'); setCodeOld(''); setError(''); }} theme={theme} label="Change new email address" />
          </StepSection>
        )}

        {/* ── Step 3 (email): verify new email ── */}
        {step === 'verify-new' && (
          <StepSection
            heading="Verify your new email"
            hint={`We sent a 6-digit ownership code to ${newValue.trim()}. Enter it to complete the change.`}
            theme={theme}
          >
            <Field
              label="Ownership code (new email)"
              name="codeNew"
              value={codeNew}
              onChangeText={setCodeNew}
              placeholder="123456"
              keyboardType="number-pad"
              icon="mail-open-outline"
              theme={theme}
              focusedField={focusedField}
              setFocusedField={setFocusedField}
            />
            <PrimaryButton label="Confirm new email" loading={loading} onPress={onVerifyNew} theme={theme} />
            <BackLink onPress={() => { setStep('verify-old'); setCodeNew(''); setError(''); }} theme={theme} label="Resend / re-enter old email code" />
          </StepSection>
        )}

        {/* ── Step 2 (phone): verify ── */}
        {step === 'verify' && (
          <StepSection
            heading="Enter verification code"
            hint={`We sent a 6-digit code to ${user?.email || 'your email'}. Enter it to confirm the phone change.`}
            theme={theme}
          >
            <Field
              label="Verification code"
              name="codeOld"
              value={codeOld}
              onChangeText={setCodeOld}
              placeholder="123456"
              keyboardType="number-pad"
              icon="keypad-outline"
              theme={theme}
              focusedField={focusedField}
              setFocusedField={setFocusedField}
            />
            <PrimaryButton label="Confirm new phone" loading={loading} onPress={onVerifyPhone} theme={theme} />
            <BackLink onPress={() => { setStep('request'); setCodeOld(''); setError(''); }} theme={theme} label="Change phone number" />
          </StepSection>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StepBar({ steps, current, theme }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing['2xl'] }}>
      {steps.map((label, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 0 }}>
          <View style={{ alignItems: 'center' }}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: i < current ? GOLD : i === current ? GOLD : theme.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {i < current ? (
                <Ionicons name="checkmark" size={16} color="#000" />
              ) : (
                <Text style={{ fontFamily: typography.fontFamilyBold, fontSize: 12, color: i <= current ? '#000' : theme.subtleText }}>
                  {i + 1}
                </Text>
              )}
            </View>
            <Text
              style={{
                fontFamily: typography.fontFamilyMedium,
                fontSize: 10,
                color: i <= current ? theme.text : theme.subtleText,
                marginTop: 4,
                textAlign: 'center',
              }}
            >
              {label}
            </Text>
          </View>
          {i < steps.length - 1 && (
            <View style={{ flex: 1, height: 1, backgroundColor: i < current ? GOLD : theme.border, marginHorizontal: spacing.xs, marginBottom: 14 }} />
          )}
        </View>
      ))}
    </View>
  );
}

function StepSection({ heading, hint, children, theme }) {
  return (
    <View>
      <Text style={{ fontFamily: typography.fontFamilySemiBold, fontSize: typography.body.fontSize + 2, color: theme.text, marginBottom: spacing.xs }}>
        {heading}
      </Text>
      <Text style={{ fontFamily: typography.fontFamilyRegular, fontSize: typography.body.fontSize, color: theme.subtleText, marginBottom: spacing.xl, lineHeight: 22 }}>
        {hint}
      </Text>
      {children}
    </View>
  );
}

function PrimaryButton({ label, loading, onPress, theme }) {
  return (
    <TouchableOpacity
      style={[ui.buttonPrimary(theme), { marginTop: spacing.lg }]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.9}
    >
      {loading
        ? <ActivityIndicator color={theme.primaryForeground} />
        : <Text style={ui.buttonTextPrimary(theme)}>{label}</Text>}
    </TouchableOpacity>
  );
}

function BackLink({ onPress, theme, label }) {
  return (
    <TouchableOpacity style={{ marginTop: spacing.lg, alignItems: 'center' }} onPress={onPress} activeOpacity={0.7}>
      <Text style={{ fontFamily: typography.fontFamilyMedium, fontSize: typography.body.fontSize, color: theme.subtleText }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function Field({ label, name, value, onChangeText, placeholder, keyboardType, icon, theme, focusedField, setFocusedField }) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={{ fontFamily: typography.fontFamilyMedium, fontSize: 13, marginBottom: spacing.xs, color: theme.subtleText }}>
        {label}
      </Text>
      <View style={{ position: 'relative' }}>
        <Ionicons
          name={icon}
          size={18}
          color={focusedField === name ? GOLD : theme.subtleText}
          style={{ position: 'absolute', left: 14, top: '50%', marginTop: -9, zIndex: 1 }}
        />
        <TextInput
          style={[ui.input(theme), { paddingLeft: 44 }, focusedField === name && { borderColor: GOLD }]}
          placeholderTextColor={theme.subtleText}
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocusedField(name)}
          onBlur={() => setFocusedField(null)}
          keyboardType={keyboardType || 'default'}
          autoCapitalize="none"
        />
      </View>
    </View>
  );
}
