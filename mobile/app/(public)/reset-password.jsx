import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiRequest } from '../../lib/api';
import ScreenHeader from '../components/ScreenHeader';
import { useThemeMode } from '../_layout';
import { ui, spacing, radii, layout } from '../../theme/tokens';

export default function ResetPasswordScreen() {
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hidePassword, setHidePassword] = useState(true);
  const router = useRouter();
  const params = useLocalSearchParams();
  const emailFromParams = typeof params.email === 'string' ? params.email : '';
  const [email, setEmail] = useState(emailFromParams);
  const { theme } = useThemeMode();

  const onSubmit = async () => {
    try {
      setLoading(true);
      setError('');
      await apiRequest('/auth/password/reset', {
        method: 'POST',
        body: { email, code, newPassword: password },
      });
      router.replace('/login');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <ScreenHeader title="Reset password" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, { borderColor: theme.border }]}>
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
              placeholder="Reset code"
              placeholderTextColor={theme.subtleText}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
            />
          </View>
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={20} color={theme.subtleText} style={styles.inputIcon} />
            <TextInput
              style={[ui.input(theme), styles.input, styles.inputRight]}
              placeholder="New password"
              placeholderTextColor={theme.subtleText}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={hidePassword}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setHidePassword(!hidePassword)}
              hitSlop={12}
            >
              <Ionicons
                name={hidePassword ? 'eye-outline' : 'eye-off-outline'}
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
            <Text style={ui.buttonTextPrimary(theme)}>
              {loading ? 'Updating...' : 'Update password'}
            </Text>
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
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingBottom: spacing['2xl'],
  },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.xl,
    marginTop: spacing.lg,
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
  inputRight: { paddingRight: 44 },
  eyeBtn: {
    position: 'absolute',
    right: 14,
    top: 14,
    zIndex: 1,
  },
  primaryButton: { marginTop: spacing.sm },
};
