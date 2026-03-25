import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeMode, useAuth } from '../_layout';
import ScreenHeader from '../components/ScreenHeader';
import { ui, spacing, typography, radii, layout, brand } from '../../theme/tokens';
import { apiRequest } from '../../src/api/client';

const GOLD = brand.gold;

export default function SecurityScreen() {
  const { theme } = useThemeMode();
  const { token, deviceId } = useAuth();
  const router = useRouter();

  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [revoking, setRevoking] = useState(null); // deviceId being revoked

  const fetchSecurity = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiRequest('/users/me/security', { method: 'GET', token });
      setData(res.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { fetchSecurity(); }, [fetchSecurity]));

  const handleRevoke = (sessionDeviceId, isCurrent) => {
    if (isCurrent) {
      Alert.alert('This device', 'You cannot revoke the session for your current device here. Use "Log out" from the profile screen instead.');
      return;
    }
    Alert.alert(
      'Revoke session',
      'This device will be signed out and will need to log in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            try {
              setRevoking(sessionDeviceId);
              await apiRequest(`/users/me/sessions/${sessionDeviceId}`, { method: 'DELETE', token });
              setData((prev) => ({
                ...prev,
                sessions: prev.sessions.filter((s) => s.deviceId !== sessionDeviceId),
              }));
            } catch (e) {
              Alert.alert('Error', e.message);
            } finally {
              setRevoking(null);
            }
          },
        },
      ]
    );
  };

  const handleRevokeAll = () => {
    const others = data?.sessions?.filter((s) => !s.isCurrent) || [];
    if (others.length === 0) {
      Alert.alert('No other sessions', 'There are no other active sessions to revoke.');
      return;
    }
    Alert.alert(
      'Sign out all other devices',
      `This will sign out ${others.length} other device${others.length > 1 ? 's' : ''}. They will need to log in again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out all',
          style: 'destructive',
          onPress: async () => {
            try {
              setRevoking('all');
              await apiRequest('/users/me/sessions', {
                method: 'DELETE',
                token,
                body: { currentDeviceId: deviceId },
              });
              setData((prev) => ({
                ...prev,
                sessions: prev.sessions.filter((s) => s.isCurrent),
              }));
            } catch (e) {
              Alert.alert('Error', e.message);
            } finally {
              setRevoking(null);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'bottom']}>
      <ScreenHeader title="Security" />

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={theme.primary} />
        </View>
      ) : error ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: layout.screenPaddingHorizontal }}>
          <Text style={[ui.errorText(theme), { textAlign: 'center' }]}>{error}</Text>
          <TouchableOpacity onPress={fetchSecurity} style={{ marginTop: spacing.lg }}>
            <Text style={{ color: theme.primary, fontFamily: typography.fontFamilyMedium }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: layout.screenPaddingHorizontal, paddingBottom: spacing['3xl'] }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Transaction PIN ── */}
          <Section label="TRANSACTION PIN">
            <Card theme={theme}>
              <SettingsRow
                icon="keypad-outline"
                label={data?.hasPIN ? 'Change transaction PIN' : 'Set transaction PIN'}
                sublabel={data?.hasPIN ? 'Update your financial security PIN' : 'Required to authorise payments and transfers'}
                theme={theme}
                showChevron
                accent={!data?.hasPIN}
                onPress={() =>
                  router.push({
                    pathname: '/(app)/transaction-pin',
                    params: { mode: data?.hasPIN ? 'change' : 'set' },
                  })
                }
                isLast
              />
            </Card>
            {!data?.hasPIN && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  backgroundColor: GOLD + '20',
                  padding: spacing.md,
                  borderRadius: 8,
                  marginTop: spacing.sm,
                }}
              >
                <Ionicons name="warning-outline" size={16} color={GOLD} />
                <Text style={{ flex: 1, fontFamily: typography.fontFamilyMedium, fontSize: 12, color: theme.text }}>
                  Set a transaction PIN to protect your financial actions.
                </Text>
              </View>
            )}
          </Section>

          {/* ── Active Sessions ── */}
          <Section label={`ACTIVE SESSIONS  ·  ${data?.sessions?.length ?? 0}`}>
            <Card theme={theme}>
              {data?.sessions?.length === 0 ? (
                <EmptyRow label="No active sessions found" theme={theme} />
              ) : (
                data.sessions.map((s, i) => (
                  <SessionRow
                    key={s.id}
                    session={s}
                    isLast={i === data.sessions.length - 1}
                    revoking={revoking === s.deviceId}
                    onRevoke={() => handleRevoke(s.deviceId, s.isCurrent)}
                    theme={theme}
                  />
                ))
              )}
            </Card>

            {(data?.sessions?.filter((s) => !s.isCurrent)?.length ?? 0) > 0 && (
              <TouchableOpacity
                onPress={handleRevokeAll}
                disabled={revoking === 'all'}
                style={{
                  marginTop: spacing.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.sm,
                  padding: spacing.md,
                  borderRadius: radii.xs,
                  borderWidth: 1,
                  borderColor: theme.error + '60',
                }}
              >
                {revoking === 'all' ? (
                  <ActivityIndicator size={14} color={theme.error} />
                ) : (
                  <Ionicons name="log-out-outline" size={16} color={theme.error} />
                )}
                <Text style={{ fontFamily: typography.fontFamilyMedium, fontSize: 13, color: theme.error }}>
                  Sign out all other devices
                </Text>
              </TouchableOpacity>
            )}
          </Section>

          {/* ── Login History ── */}
          <Section label={`LOGIN HISTORY  ·  LAST ${Math.min(data?.loginHistory?.length ?? 0, 20)}`}>
            <Card theme={theme}>
              {data?.loginHistory?.length === 0 ? (
                <EmptyRow label="No login history found" theme={theme} />
              ) : (
                data.loginHistory.map((e, i) => (
                  <LoginEventRow
                    key={e.id}
                    event={e}
                    isLast={i === data.loginHistory.length - 1}
                    theme={theme}
                  />
                ))
              )}
            </Card>
          </Section>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ label, children }) {
  const { theme } = useThemeMode();
  return (
    <View style={{ marginTop: spacing.xl }}>
      <Text style={{ fontFamily: typography.fontFamilySemiBold, fontSize: 11, letterSpacing: 0.8, color: theme.subtleText, marginBottom: spacing.sm }}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function Card({ theme, children }) {
  return (
    <View style={[ui.card(theme), { padding: 0, overflow: 'hidden', borderRadius: radii.xs }]}>
      {children}
    </View>
  );
}

function SettingsRow({ icon, label, sublabel, onPress, showChevron, accent, isLast, theme }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: theme.border,
      }}
    >
      <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: accent ? GOLD + '22' : theme.secondary, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md }}>
        <Ionicons name={icon} size={17} color={accent ? GOLD : theme.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: typography.fontFamilyMedium, fontSize: 14, color: theme.text }}>{label}</Text>
        {sublabel ? <Text style={{ fontFamily: typography.fontFamilyRegular, fontSize: 12, color: theme.subtleText, marginTop: 2 }}>{sublabel}</Text> : null}
      </View>
      {showChevron && <Ionicons name="chevron-forward" size={16} color={theme.subtleText} />}
    </TouchableOpacity>
  );
}

function SessionRow({ session, isLast, revoking, onRevoke, theme }) {
  const deviceIcon = session.deviceOs?.toLowerCase().includes('ios') ? 'phone-portrait-outline'
    : session.deviceOs?.toLowerCase().includes('android') ? 'logo-android'
    : 'desktop-outline';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: theme.border,
        backgroundColor: session.isCurrent ? theme.primary + '08' : 'transparent',
      }}
    >
      <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: theme.secondary, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md }}>
        <Ionicons name={deviceIcon} size={17} color={theme.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Text style={{ fontFamily: typography.fontFamilyMedium, fontSize: 14, color: theme.text }}>
            {session.deviceModel || 'Unknown device'}
          </Text>
          {session.isCurrent && (
            <View style={{ backgroundColor: GOLD, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ fontFamily: typography.fontFamilyBold, fontSize: 10, color: '#000' }}>This device</Text>
            </View>
          )}
        </View>
        <Text style={{ fontFamily: typography.fontFamilyRegular, fontSize: 12, color: theme.subtleText, marginTop: 2 }}>
          {session.deviceOs ? `${session.deviceOs}  ·  ` : ''}{session.ip}
        </Text>
        <Text style={{ fontFamily: typography.fontFamilyRegular, fontSize: 11, color: theme.subtleText, marginTop: 1 }}>
          Last seen {formatRelative(session.lastSeenAt)}
        </Text>
      </View>
      {!session.isCurrent && (
        <TouchableOpacity
          onPress={onRevoke}
          disabled={revoking}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ padding: spacing.xs }}
        >
          {revoking
            ? <ActivityIndicator size={14} color={theme.error} />
            : <Ionicons name="close-circle-outline" size={22} color={theme.error} />}
        </TouchableOpacity>
      )}
    </View>
  );
}

function LoginEventRow({ event, isLast, theme }) {
  const isFailed = event.eventType === 'login_failed';
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: theme.border,
      }}
    >
      <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: isFailed ? theme.error + '18' : theme.secondary, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md }}>
        <Ionicons name={isFailed ? 'warning-outline' : 'log-in-outline'} size={17} color={isFailed ? theme.error : theme.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: typography.fontFamilyMedium, fontSize: 14, color: isFailed ? theme.error : theme.text }}>
          {isFailed ? 'Failed login attempt' : 'Signed in'}
        </Text>
        <Text style={{ fontFamily: typography.fontFamilyRegular, fontSize: 12, color: theme.subtleText, marginTop: 2 }}>
          {event.deviceModel || 'Unknown device'}{event.deviceOs ? ` · ${event.deviceOs}` : ''}
        </Text>
        <Text style={{ fontFamily: typography.fontFamilyRegular, fontSize: 11, color: theme.subtleText, marginTop: 1 }}>
          {event.ip}  ·  {formatRelative(event.createdAt)}
        </Text>
      </View>
    </View>
  );
}

function EmptyRow({ label, theme }) {
  return (
    <View style={{ padding: spacing.lg, alignItems: 'center' }}>
      <Text style={{ fontFamily: typography.fontFamilyRegular, fontSize: 13, color: theme.subtleText }}>{label}</Text>
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelative(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)   return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
