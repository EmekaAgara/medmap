import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiRequest } from '../../lib/api';
import ScreenHeader from '../components/ScreenHeader';
import { useThemeMode } from '../_layout';
import { ui, spacing, radii, layout } from '../../theme/tokens';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const { theme } = useThemeMode();

  const onSubmit = async () => {
    try {
      setLoading(true);
      setError('');
      setMessage('');
      await apiRequest('/auth/password/forgot', {
        method: 'POST',
        body: { email },
      });
      setMessage('We have emailed you a reset code.');
      router.replace({ pathname: '/reset-password', params: { email } });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <ScreenHeader title="Forgot password" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={[styles.card, { borderColor: theme.border }]}>
            <View style={[styles.iconWrap, { backgroundColor: theme.secondary }]}>
              <Ionicons name="key-outline" size={32} color={theme.primary} />
            </View>
            <Text style={[ui.body(theme), styles.hint]}>
              Enter your email and we'll send you a code to reset your password.
            </Text>
            {error ? (
              <View style={[styles.msgWrap, { backgroundColor: theme.error + '18' }]}>
                <Ionicons name="alert-circle" size={18} color={theme.error} />
                <Text style={[ui.errorText(theme), styles.msgText]}>{error}</Text>
              </View>
            ) : null}
            {message ? (
              <View style={[styles.msgWrap, { backgroundColor: theme.success + '18' }]}>
                <Ionicons name="checkmark-circle" size={18} color={theme.success} />
                <Text style={[ui.successText(theme), styles.msgText]}>{message}</Text>
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
            <TouchableOpacity
              style={[ui.buttonPrimary(theme), styles.primaryButton]}
              onPress={onSubmit}
              disabled={loading}
              activeOpacity={0.9}
            >
              <Text style={ui.buttonTextPrimary(theme)}>
                {loading ? 'Sending...' : 'Send code'}
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
  msgWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.lg,
  },
  msgText: { flex: 1 },
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
