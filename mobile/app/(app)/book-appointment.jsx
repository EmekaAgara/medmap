import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Modal,
  Pressable,
  Linking,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth, useThemeMode } from '../_layout';
import ScreenHeader from '../components/ScreenHeader';
import { apiRequest } from '../../src/api/client';
import { beginInAppCheckout } from '../../src/wallet/checkoutSession';
import { ui, spacing, typography } from '../../theme/tokens';

function defaultStart() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 2);
  return d;
}

export default function BookAppointmentScreen() {
  const { providerId, providerName, prefillNote } = useLocalSearchParams();
  const { token } = useAuth();
  const { theme } = useThemeMode();
  const router = useRouter();
  const [when, setWhen] = useState(defaultStart);
  const [showPicker, setShowPicker] = useState(false);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [provider, setProvider] = useState(null);

  useEffect(() => {
    if (prefillNote == null) return;
    const next = String(prefillNote || '').trim();
    if (!next) return;
    setNote(next);
  }, [prefillNote]);

  useEffect(() => {
    if (!providerId) return;
    (async () => {
      try {
        const res = await apiRequest(`/providers/${providerId}`, { method: 'GET' });
        setProvider(res.data || null);
      } catch {
        setProvider(null);
      }
    })();
  }, [providerId]);

  const presets = useMemo(() => {
    const base = new Date();
    base.setMinutes(0, 0, 0);
    const slots = [];

    for (let h = 1; h <= 3; h += 1) {
      const d = new Date(base.getTime() + h * 60 * 60 * 1000);
      slots.push(d);
    }

    const tomorrow = new Date(base.getTime() + 24 * 60 * 60 * 1000);
    const t1 = new Date(tomorrow);
    t1.setHours(9, 0, 0, 0);
    const t2 = new Date(tomorrow);
    t2.setHours(14, 0, 0, 0);
    slots.push(t1, t2);

    // De-dupe (in case of timezone quirks)
    return slots
      .map((d) => d.toISOString())
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .map((iso) => new Date(iso));
  }, []);

  const submit = async () => {
    if (!providerId) return;
    try {
      setLoading(true);
      setError('');
      const res = await apiRequest('/appointments', {
        method: 'POST',
        token,
        body: {
          providerId,
          requestedStart: when.toISOString(),
          patientNote: note.trim() || undefined,
        },
      });
      const id = res.data?._id;
      if (id) {
        router.replace({ pathname: '/(app)/appointments/[id]', params: { id: String(id) } });
      } else {
        router.back();
      }
    } catch (e) {
      const pay = e.details?.payment;
      if ((pay?.paymentLink || pay?.paymentHtml) && pay?.reference && token) {
        await beginInAppCheckout(router, {
          paymentLink: pay.paymentLink,
          paymentHtml: pay.paymentHtml,
          reference: pay.reference,
          returnUrlPrefixes: pay.returnUrlPrefixes,
          intent: 'appointment',
          appointmentPayload: {
            providerId,
            requestedStart: when.toISOString(),
            patientNote: note.trim() || undefined,
          },
        });
      } else if (pay?.paymentLink) {
        Alert.alert(
          'Wallet balance too low',
          `Add at least ₦${Number(pay.shortfall || 0).toLocaleString()} to book this visit.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Add funds',
              onPress: () => Linking.openURL(pay.paymentLink).catch(() => {}),
            },
          ]
        );
      }
      setError(e.message || 'Could not book');
    } finally {
      setLoading(false);
    }
  };

  const onChangeWhen = (event, date) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (date) setWhen(date);
  };

  return (
    <SafeAreaView style={ui.screen(theme)} edges={['top']}>
      <ScreenHeader title="Book visit" />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <Text style={[ui.h2(theme), { marginBottom: spacing.sm, fontSize: 20 }]}>
          {providerName || 'Provider'}
        </Text>
        <Text style={[ui.caption(theme), { marginBottom: spacing.md }]}>
          Choose a preferred start time. The provider confirms or suggests another slot.
        </Text>

        <View style={[ui.card(theme), { marginBottom: spacing.md }]}>
          <Text style={[ui.caption(theme), { fontWeight: '700' }]}>
            {provider?.hourlyRate === 0
              ? 'Free booking'
              : `You’ll pay ₦${provider?.hourlyRate ? Number(provider.hourlyRate).toLocaleString() : '—'} from your wallet when you send this request.`}
          </Text>
          {Number(provider?.hourlyRate) > 0 ? (
            <Text style={[ui.caption(theme), { marginTop: spacing.sm, color: theme.subtleText }]}>
              If your wallet balance is low, you’ll get a secure Interswitch link to add funds, then send the request
              again.
            </Text>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md }}>
          {presets.map((d) => (
            <TouchableOpacity
              key={d.toISOString()}
              style={[ui.buttonOutline(theme), { borderRadius: 999, paddingHorizontal: spacing.md, height: 38, justifyContent: 'center' }]}
              onPress={() => setWhen(d)}
            >
              <Text style={ui.buttonText(theme)}>
                {d.toLocaleDateString(undefined, { weekday: 'short' })} {d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[ui.buttonOutline(theme), { marginBottom: spacing.md }]}
          onPress={() => setShowPicker(true)}
        >
          <Text style={ui.buttonText(theme)}>
            {when.toLocaleString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </TouchableOpacity>

        {Platform.OS === 'android' && showPicker ? (
          <DateTimePicker value={when} mode="datetime" display="default" onChange={onChangeWhen} />
        ) : null}

        {Platform.OS === 'ios' ? (
          <Modal visible={showPicker} transparent animationType="slide">
            <Pressable
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}
              onPress={() => setShowPicker(false)}
            />
            <View
              style={{
                backgroundColor: theme.card,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                paddingBottom: spacing.lg,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'flex-end',
                  padding: spacing.md,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.border,
                }}
              >
                <TouchableOpacity onPress={() => setShowPicker(false)}>
                  <Text style={{ color: theme.primary, fontFamily: typography.fontFamilySemiBold }}>
                    Done
                  </Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={when}
                mode="datetime"
                display="spinner"
                onChange={onChangeWhen}
                style={{ height: 200 }}
              />
            </View>
          </Modal>
        ) : null}

        <Text style={[ui.caption(theme), { marginBottom: spacing.xs }]}>Note (optional)</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Reason for visit, symptoms, etc."
          placeholderTextColor={theme.subtleText}
          multiline
          style={[ui.input(theme), { minHeight: 88, textAlignVertical: 'top' }]}
        />

        {error ? <Text style={ui.errorText(theme)}>{error}</Text> : null}

        <TouchableOpacity
          style={[ui.buttonPrimary(theme), { marginTop: spacing.lg }]}
          onPress={submit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={theme.primaryForeground} />
          ) : (
            <Text style={ui.buttonTextPrimary(theme)}>Send request</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
