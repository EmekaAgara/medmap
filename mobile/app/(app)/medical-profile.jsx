import { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import ScreenHeader from '../components/ScreenHeader';
import { useAuth, useThemeMode } from '../_layout';
import { apiRequest } from '../../src/api/client';
import { ui, spacing, radii, typography } from '../../theme/tokens';

function normalizeCsv(s) {
  return String(s || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

export default function MedicalProfileScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { theme } = useThemeMode();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [aiAssistant, setAiAssistant] = useState(false);
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [allergies, setAllergies] = useState('');
  const [conditions, setConditions] = useState('');
  const [medications, setMedications] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError('');
      const res = await apiRequest('/medical/profile', { method: 'GET', token });
      const p = res.data || {};
      setAiAssistant(!!p?.consent?.aiAssistant);
      setHeightCm(p?.vitals?.heightCm != null ? String(p.vitals.heightCm) : '');
      setWeightKg(p?.vitals?.weightKg != null ? String(p.vitals.weightKg) : '');
      setBloodGroup(p?.vitals?.bloodGroup || '');
      setAllergies((p.allergies || []).join(', '));
      setConditions((p.conditions || []).join(', '));
      setMedications((p.medications || []).join(', '));
    } catch (e) {
      setError(e.message || 'Could not load medical profile');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!token) return;
    try {
      setBusy(true);
      setError('');
      await apiRequest('/medical/profile', {
        method: 'PUT',
        token,
        body: {
          consent: { aiAssistant },
          vitals: {
            heightCm: heightCm.trim() ? Number(heightCm) : undefined,
            weightKg: weightKg.trim() ? Number(weightKg) : undefined,
            bloodGroup: bloodGroup.trim() || undefined,
          },
          allergies: normalizeCsv(allergies),
          conditions: normalizeCsv(conditions),
          medications: normalizeCsv(medications),
        },
      });
      Alert.alert('Medical profile', 'Saved.');
      router.back();
    } catch (e) {
      setError(e.message || 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={ui.screen(theme)} edges={['top']}>
      <ScreenHeader title="Medical profile" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing['3xl'] }}>
        {error ? <Text style={ui.errorText(theme)}>{error}</Text> : null}
        {loading ? <Text style={ui.caption(theme)}>Loading…</Text> : null}

        <View style={[ui.card(theme), { padding: spacing.lg, marginTop: spacing.md }]}>
          <Text style={[ui.caption(theme), { fontFamily: typography.fontFamilySemiBold }]}>AI consent</Text>
          <Text style={[ui.caption(theme), { marginTop: spacing.xs, color: theme.subtleText, lineHeight: 18 }]}>
            If enabled, Meddie can use your medical context (allergies, medications, history) to help. Meddie does not
            replace a licensed clinician.
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md }}>
            <Text style={[ui.caption(theme), { fontFamily: typography.fontFamilySemiBold }]}>Enable Meddie</Text>
            <Switch value={aiAssistant} onValueChange={setAiAssistant} />
          </View>
        </View>

        <View style={[ui.card(theme), { padding: spacing.lg, marginTop: spacing.md }]}>
          <Text style={[ui.caption(theme), { fontFamily: typography.fontFamilySemiBold }]}>Vitals</Text>
          <TextInput
            placeholder="Height (cm)"
            placeholderTextColor={theme.subtleText}
            keyboardType="number-pad"
            value={heightCm}
            onChangeText={setHeightCm}
            style={{ borderWidth: 1, borderColor: theme.border, borderRadius: radii.lg, padding: spacing.md, color: theme.text, marginTop: spacing.sm }}
          />
          <TextInput
            placeholder="Weight (kg)"
            placeholderTextColor={theme.subtleText}
            keyboardType="number-pad"
            value={weightKg}
            onChangeText={setWeightKg}
            style={{ borderWidth: 1, borderColor: theme.border, borderRadius: radii.lg, padding: spacing.md, color: theme.text, marginTop: spacing.sm }}
          />
          <TextInput
            placeholder="Blood group (e.g. O+)"
            placeholderTextColor={theme.subtleText}
            value={bloodGroup}
            onChangeText={setBloodGroup}
            style={{ borderWidth: 1, borderColor: theme.border, borderRadius: radii.lg, padding: spacing.md, color: theme.text, marginTop: spacing.sm }}
          />
        </View>

        <View style={[ui.card(theme), { padding: spacing.lg, marginTop: spacing.md }]}>
          <Text style={[ui.caption(theme), { fontFamily: typography.fontFamilySemiBold }]}>Allergies</Text>
          <Text style={[ui.caption(theme), { color: theme.subtleText, marginTop: spacing.xs }]}>Comma-separated.</Text>
          <TextInput
            placeholder="e.g. Penicillin, Peanuts"
            placeholderTextColor={theme.subtleText}
            value={allergies}
            onChangeText={setAllergies}
            style={{ borderWidth: 1, borderColor: theme.border, borderRadius: radii.lg, padding: spacing.md, color: theme.text, marginTop: spacing.sm }}
          />
        </View>

        <View style={[ui.card(theme), { padding: spacing.lg, marginTop: spacing.md }]}>
          <Text style={[ui.caption(theme), { fontFamily: typography.fontFamilySemiBold }]}>Conditions</Text>
          <Text style={[ui.caption(theme), { color: theme.subtleText, marginTop: spacing.xs }]}>Comma-separated.</Text>
          <TextInput
            placeholder="e.g. Asthma, Hypertension"
            placeholderTextColor={theme.subtleText}
            value={conditions}
            onChangeText={setConditions}
            style={{ borderWidth: 1, borderColor: theme.border, borderRadius: radii.lg, padding: spacing.md, color: theme.text, marginTop: spacing.sm }}
          />
        </View>

        <View style={[ui.card(theme), { padding: spacing.lg, marginTop: spacing.md }]}>
          <Text style={[ui.caption(theme), { fontFamily: typography.fontFamilySemiBold }]}>Medications</Text>
          <Text style={[ui.caption(theme), { color: theme.subtleText, marginTop: spacing.xs }]}>Comma-separated.</Text>
          <TextInput
            placeholder="e.g. Metformin, Salbutamol"
            placeholderTextColor={theme.subtleText}
            value={medications}
            onChangeText={setMedications}
            style={{ borderWidth: 1, borderColor: theme.border, borderRadius: radii.lg, padding: spacing.md, color: theme.text, marginTop: spacing.sm }}
          />
        </View>

        <TouchableOpacity style={[ui.buttonPrimary(theme), { marginTop: spacing.lg, opacity: busy ? 0.8 : 1 }]} onPress={save} disabled={busy}>
          <Text style={ui.buttonTextPrimary(theme)}>{busy ? 'Saving…' : 'Save'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

