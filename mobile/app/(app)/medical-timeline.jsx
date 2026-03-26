import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import ScreenHeader from '../components/ScreenHeader';
import { useAuth, useThemeMode } from '../_layout';
import { apiRequest } from '../../src/api/client';
import { ui, spacing, typography } from '../../theme/tokens';

function labelStatus(s) {
  const map = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    cancelled: 'Cancelled',
    rejected: 'Rejected',
  };
  return map[s] || s || '—';
}

export default function MedicalTimelineScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { theme } = useThemeMode();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError('');
      const res = await apiRequest('/medical/timeline', { method: 'GET', token });
      setData(res.data || null);
    } catch (e) {
      setError(e.message || 'Could not load timeline');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const profile = data?.profile;
  const timeline = data?.timeline || [];

  return (
    <SafeAreaView style={ui.screen(theme)} edges={['top']}>
      <ScreenHeader title="Medical timeline" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing['3xl'] }}>
        {loading ? <ActivityIndicator color={theme.primary} /> : null}
        {error ? <Text style={ui.errorText(theme)}>{error}</Text> : null}

        {profile ? (
          <View style={[ui.card(theme), { padding: spacing.lg, marginTop: spacing.md }]}>
            <Text style={[ui.caption(theme), { fontFamily: typography.fontFamilySemiBold }]}>Snapshot</Text>
            <Text style={[ui.caption(theme), { marginTop: spacing.xs, color: theme.subtleText }]}>
              Allergies: {(profile.allergies || []).slice(0, 5).join(', ') || '—'}
            </Text>
            <Text style={[ui.caption(theme), { marginTop: spacing.xs, color: theme.subtleText }]}>
              Conditions: {(profile.conditions || []).slice(0, 5).join(', ') || '—'}
            </Text>
            <Text style={[ui.caption(theme), { marginTop: spacing.xs, color: theme.subtleText }]}>
              Medications: {(profile.medications || []).slice(0, 5).join(', ') || '—'}
            </Text>
            <TouchableOpacity style={[ui.buttonOutline(theme), { marginTop: spacing.md }]} onPress={() => router.push('/(app)/medical-profile')}>
              <Text style={ui.buttonText(theme)}>Edit medical profile</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!loading && !timeline.length ? (
          <Text style={[ui.caption(theme), { marginTop: spacing.lg }]}>No timeline items yet.</Text>
        ) : null}

        {timeline.map((t) => (
          <View key={String(t.id)} style={[ui.card(theme), { padding: spacing.lg, marginTop: spacing.md }]}>
            <Text style={[ui.caption(theme), { fontFamily: typography.fontFamilySemiBold }]}>
              {t.kind === 'appointment' ? 'Appointment' : t.kind}
            </Text>
            <Text style={[ui.caption(theme), { marginTop: spacing.xs, color: theme.subtleText }]}>
              {new Date(t.at).toLocaleString()} · {labelStatus(t.status)}
            </Text>
            {t.provider?.name ? (
              <Text style={[ui.caption(theme), { marginTop: spacing.xs }]}>Provider: {t.provider.name}</Text>
            ) : null}
            {t.providerNote ? (
              <Text style={[ui.caption(theme), { marginTop: spacing.sm, lineHeight: 18 }]}>
                Summary: {t.providerNote}
              </Text>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

