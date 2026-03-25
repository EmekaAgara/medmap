import { useState, useRef, forwardRef } from 'react';
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

export default function TransactionPinScreen() {
  const { mode = 'set' } = useLocalSearchParams();
  const isChange = mode === 'change';

  const { theme } = useThemeMode();
  const { token } = useAuth();
  const router = useRouter();

  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin]         = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const newRef     = useRef(null);
  const confirmRef = useRef(null);

  const sanitizePin = (t) => t.replace(/\D/g, '').slice(0, 6);

  const validate = () => {
    if (isChange && !currentPin.trim()) return 'Current PIN is required.';
    const pin = newPin.trim();
    if (!pin) return 'New PIN is required.';
    if (!/^\d{4,6}$/.test(pin)) return 'PIN must be 4 to 6 digits.';
    if (confirmPin.trim() !== pin) return 'PINs do not match.';
    if (isChange && currentPin.trim() === pin) return 'New PIN must be different from your current PIN.';
    return null;
  };

  const onSubmit = async () => {
    setError('');
    const err = validate();
    if (err) { setError(err); return; }

    try {
      setLoading(true);
      if (isChange) {
        await apiRequest('/auth/transaction-pin/change', {
          method: 'POST',
          token,
          body: { currentPin: currentPin.trim(), newPin: newPin.trim() },
        });
      } else {
        await apiRequest('/auth/transaction-pin', {
          method: 'POST',
          token,
          body: { pin: newPin.trim() },
        });
      }
      Alert.alert(
        'Success',
        isChange ? 'Your transaction PIN has been changed.' : 'Your transaction PIN has been set.',
        [{ text: 'OK', onPress: () => router.navigate('/(app)/security') }]
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'bottom']}>
      <ScreenHeader title={isChange ? 'Change transaction PIN' : 'Set transaction PIN'} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: layout.screenPaddingHorizontal, paddingBottom: spacing['2xl'] }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Info banner */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: spacing.sm,
            backgroundColor: theme.primary + '18',
            padding: spacing.md,
            borderRadius: 10,
            marginTop: spacing.xl,
            marginBottom: spacing['2xl'],
          }}
        >
          <Ionicons name="shield-checkmark-outline" size={20} color={theme.primary} style={{ marginTop: 1 }} />
          <Text style={{ flex: 1, fontFamily: typography.fontFamilyRegular, fontSize: 13, color: theme.text, lineHeight: 20 }}>
            Your transaction PIN authorises payments, transfers, and other financial actions. Never share it with anyone.
          </Text>
        </View>

        {/* Error */}
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

        {/* Current PIN (change mode only) */}
        {isChange && (
          <PinField
            label="Current PIN"
            value={currentPin}
            onChangeText={(t) => setCurrentPin(sanitizePin(t))}
            show={showCurrent}
            onToggleShow={() => setShowCurrent((v) => !v)}
            onSubmitEditing={() => newRef.current?.focus()}
            returnKeyType="next"
            theme={theme}
          />
        )}

        {/* New PIN */}
        <PinField
          ref={newRef}
          label={isChange ? 'New PIN' : 'Create PIN (4–6 digits)'}
          value={newPin}
          onChangeText={(t) => setNewPin(sanitizePin(t))}
          show={showNew}
          onToggleShow={() => setShowNew((v) => !v)}
          onSubmitEditing={() => confirmRef.current?.focus()}
          returnKeyType="next"
          theme={theme}
        />

        {/* Confirm PIN */}
        <PinField
          ref={confirmRef}
          label="Confirm PIN"
          value={confirmPin}
          onChangeText={(t) => setConfirmPin(sanitizePin(t))}
          show={showConfirm}
          onToggleShow={() => setShowConfirm((v) => !v)}
          onSubmitEditing={onSubmit}
          returnKeyType="done"
          theme={theme}
        />

        {/* Live dot indicator */}
        <PinDots pin={newPin} theme={theme} />

        <TouchableOpacity
          style={[ui.buttonPrimary(theme), { marginTop: spacing['2xl'] }]}
          onPress={onSubmit}
          disabled={loading}
          activeOpacity={0.9}
        >
          {loading
            ? <ActivityIndicator color={theme.primaryForeground} />
            : <Text style={ui.buttonTextPrimary(theme)}>{isChange ? 'Change PIN' : 'Set PIN'}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

const PinField = forwardRef(function PinField(
  { label, value, onChangeText, show, onToggleShow, onSubmitEditing, returnKeyType, theme },
  ref
) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={{ fontFamily: typography.fontFamilyMedium, fontSize: 13, color: theme.subtleText, marginBottom: spacing.xs }}>
        {label}
      </Text>
      <View>
        <TextInput
          ref={ref}
          style={[ui.input(theme), { paddingRight: 48, letterSpacing: show ? 4 : 10, fontSize: 22, textAlign: 'center' }]}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!show}
          keyboardType="number-pad"
          maxLength={6}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType}
          placeholderTextColor={theme.subtleText}
          placeholder="• • • • • •"
        />
        <TouchableOpacity
          onPress={onToggleShow}
          style={{ position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.subtleText} />
        </TouchableOpacity>
      </View>
    </View>
  );
});

function PinDots({ pin, theme }) {
  if (!pin) return null;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.md, marginTop: spacing.sm }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <View
          key={i}
          style={{
            width: 11,
            height: 11,
            borderRadius: 6,
            backgroundColor: i < pin.length ? GOLD : theme.border,
          }}
        />
      ))}
    </View>
  );
}
