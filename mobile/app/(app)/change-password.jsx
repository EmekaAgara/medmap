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
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeMode, useAuth } from '../_layout';
import ScreenHeader from '../components/ScreenHeader';
import { ui, spacing, typography, layout, brand } from '../../theme/tokens';
import { apiRequest } from '../../src/api/client';

const GOLD = brand.gold;

export default function ChangePasswordScreen() {
  const { theme } = useThemeMode();
  const { token } = useAuth();
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [focusedField, setFocusedField] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const SECURE_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

  const onSave = async () => {
    setError('');

    if (!currentPassword.trim()) {
      setError('Please enter your current password.');
      return;
    }
    if (!newPassword.trim()) {
      setError('Please enter a new password.');
      return;
    }
    if (!SECURE_PASSWORD.test(newPassword)) {
      setError('New password must be at least 8 characters and include uppercase, lowercase, and a number.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (currentPassword === newPassword) {
      setError('New password must be different from your current password.');
      return;
    }

    try {
      setLoading(true);
      await apiRequest('/auth/change-password', {
        method: 'POST',
        token,
        body: { currentPassword, newPassword },
      });
      Alert.alert('Password changed', 'Your password has been updated successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={ui.screen(theme)} edges={['top', 'bottom']}>
      <ScreenHeader title="Change password" />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: layout.screenPaddingHorizontal, paddingBottom: spacing['2xl'] }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.hint, { color: theme.subtleText }]}>
          Enter your current password then choose a new one. Your new password must be at least 8 characters with uppercase, lowercase and a number.
        </Text>

        {error ? (
          <Text style={[ui.errorText(theme), styles.errorBanner]}>{error}</Text>
        ) : null}

        <View style={{ marginTop: spacing.xl }}>
          <PasswordField
            label="Current password"
            name="current"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Enter current password"
            show={showCurrent}
            onToggleShow={() => setShowCurrent((v) => !v)}
            theme={theme}
            focusedField={focusedField}
            setFocusedField={setFocusedField}
          />
          <PasswordField
            label="New password"
            name="new"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Enter new password"
            show={showNew}
            onToggleShow={() => setShowNew((v) => !v)}
            theme={theme}
            focusedField={focusedField}
            setFocusedField={setFocusedField}
          />
          <PasswordField
            label="Confirm new password"
            name="confirm"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Re-enter new password"
            show={showConfirm}
            onToggleShow={() => setShowConfirm((v) => !v)}
            theme={theme}
            focusedField={focusedField}
            setFocusedField={setFocusedField}
          />
        </View>

        <TouchableOpacity
          style={[ui.buttonPrimary(theme), { marginTop: spacing['2xl'] }]}
          onPress={onSave}
          disabled={loading}
          activeOpacity={0.9}
        >
          {loading
            ? <ActivityIndicator color={theme.primaryForeground} />
            : <Text style={ui.buttonTextPrimary(theme)}>Update password</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function PasswordField({ label, name, value, onChangeText, placeholder, show, onToggleShow, theme, focusedField, setFocusedField }) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={[styles.label, { color: theme.subtleText }]}>{label}</Text>
      <View style={[
        ui.input(theme),
        styles.passwordWrap,
        focusedField === name && { borderColor: GOLD },
      ]}>
        <TextInput
          style={[styles.passwordInput, { color: theme.text, fontFamily: typography.fontFamilyRegular }]}
          placeholderTextColor={theme.subtleText}
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!show}
          autoCapitalize="none"
          onFocus={() => setFocusedField(name)}
          onBlur={() => setFocusedField(null)}
        />
        <TouchableOpacity onPress={onToggleShow} hitSlop={8} style={styles.eyeBtn}>
          <Ionicons
            name={show ? 'eye-outline' : 'eye-off-outline'}
            size={20}
            color={theme.subtleText}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = {
  hint: {
    marginTop: spacing.lg,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 13,
    lineHeight: 20,
  },
  errorBanner: {
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  label: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 13,
    marginBottom: spacing.xs,
  },
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 0,
  },
  passwordInput: {
    flex: 1,
    fontSize: 14,
    height: '100%',
  },
  eyeBtn: {
    paddingLeft: spacing.sm,
  },
};
