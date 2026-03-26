import { useCallback, useState } from 'react';
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
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth, useThemeMode } from '../../_layout';
import ScreenHeader from '../../components/ScreenHeader';
import { apiRequest } from '../../../src/api/client';
import { ui, spacing, typography } from '../../../theme/tokens';
import { ShimmerBlock, ShimmerText } from '../../components/Shimmer';

export default function AppointmentDetailScreen() {
  const { id } = useLocalSearchParams();
  const { token, user } = useAuth();
  const { theme } = useThemeMode();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [rescheduleNote, setRescheduleNote] = useState('');
  const [confirmStart, setConfirmStart] = useState(new Date());
  const [showConfirmPicker, setShowConfirmPicker] = useState(false);
  const [rescheduleWhen, setRescheduleWhen] = useState(new Date());
  const [showReschedulePicker, setShowReschedulePicker] = useState(false);

  const load = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError('');
      const res = await apiRequest(`/appointments/${id}`, { method: 'GET', token });
      setData(res.data);
      if (res.data?.requestedStart) setConfirmStart(new Date(res.data.requestedStart));
      if (res.data?.confirmedStart) setRescheduleWhen(new Date(res.data.confirmedStart));
      else if (res.data?.requestedStart) setRescheduleWhen(new Date(res.data.requestedStart));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [id, token])
  );

  const patientId = data
    ? String(data.patientUser?._id ?? data.patientUser)
    : '';
  const isPatient = patientId === String(user?.id);
  const isProvider = data && String(data.providerOwnerUser) === String(user?.id);

  const post = async (path, body) => {
    try {
      setBusy(true);
      setError('');
      await apiRequest(`/appointments/${id}${path}`, { method: 'POST', token, body });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const onConfirmChange = (event, date) => {
    if (Platform.OS === 'android') setShowConfirmPicker(false);
    if (date) setConfirmStart(date);
  };

  const onRescheduleChange = (event, date) => {
    if (Platform.OS === 'android') setShowReschedulePicker(false);
    if (date) setRescheduleWhen(date);
  };

  if (loading && !data) {
    return (
      <SafeAreaView style={ui.screen(theme)} edges={['top']}>
        <ScreenHeader title="Appointment" />
        <View style={{ gap: spacing.md }}>
          <ShimmerBlock theme={theme} style={{ height: 22, width: '48%' }} />
          <ShimmerText theme={theme} lines={3} />
          <ShimmerBlock theme={theme} style={{ height: 120, borderRadius: 12 }} />
        </View>
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={ui.screen(theme)} edges={['top']}>
        <ScreenHeader title="Appointment" />
        <Text style={ui.errorText(theme)}>{error || 'Not found'}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={ui.screen(theme)} edges={['top']}>
      <ScreenHeader title="Appointment" />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing['2xl'] }}>
        <Text style={[ui.h2(theme), { marginBottom: spacing.sm, fontSize: 20 }]}>
          {data.provider?.name || 'Provider'}
        </Text>
        <Text style={[ui.caption(theme), { marginBottom: spacing.xs }]}>
          Status: <Text style={{ fontWeight: '600' }}>{data.status}</Text>
        </Text>
        {Number(data.consultationFee) > 0 ? (
          <Text style={[ui.caption(theme), { marginBottom: spacing.xs }]}>
            Booking fee paid: ₦{Number(data.consultationFee).toLocaleString()}
          </Text>
        ) : null}
        <Text style={[ui.caption(theme), { marginBottom: spacing.xs }]}>
          Requested: {new Date(data.requestedStart).toLocaleString()} –{' '}
          {new Date(data.requestedEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
        {data.confirmedStart ? (
          <Text style={[ui.caption(theme), { marginBottom: spacing.md }]}>
            Confirmed: {new Date(data.confirmedStart).toLocaleString()} –{' '}
            {new Date(data.confirmedEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        ) : null}
        {data.patientNote ? (
          <Text style={[ui.caption(theme), { marginBottom: spacing.sm }]}>Patient note: {data.patientNote}</Text>
        ) : null}
        {data.providerNote ? (
          <Text style={[ui.caption(theme), { marginBottom: spacing.sm }]}>
            Provider note: {data.providerNote}
          </Text>
        ) : null}
        {data.rejectReason ? (
          <Text style={[ui.caption(theme), { marginBottom: spacing.sm }]}>Reason: {data.rejectReason}</Text>
        ) : null}

        {error ? <Text style={ui.errorText(theme)}>{error}</Text> : null}

        {isProvider && data.status === 'pending' ? (
          <View style={{ marginTop: spacing.md }}>
            <TouchableOpacity
              style={[ui.buttonOutline(theme), { marginBottom: spacing.sm }]}
              onPress={() => setShowConfirmPicker(true)}
            >
              <Text style={ui.buttonText(theme)}>
                Confirm time: {confirmStart.toLocaleString()}
              </Text>
            </TouchableOpacity>
            {Platform.OS === 'android' && showConfirmPicker ? (
              <DateTimePicker
                value={confirmStart}
                mode="datetime"
                display="default"
                onChange={onConfirmChange}
              />
            ) : null}
            {Platform.OS === 'ios' ? (
              <Modal visible={showConfirmPicker} transparent animationType="slide">
                <Pressable
                  style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}
                  onPress={() => setShowConfirmPicker(false)}
                />
                <View style={{ backgroundColor: theme.card, paddingBottom: spacing.lg }}>
                  <TouchableOpacity
                    style={{ alignSelf: 'flex-end', padding: spacing.md }}
                    onPress={() => setShowConfirmPicker(false)}
                  >
                    <Text style={{ color: theme.primary, fontFamily: typography.fontFamilySemiBold }}>
                      Done
                    </Text>
                  </TouchableOpacity>
                  <DateTimePicker
                    value={confirmStart}
                    mode="datetime"
                    display="spinner"
                    onChange={onConfirmChange}
                    style={{ height: 200 }}
                  />
                </View>
              </Modal>
            ) : null}
            <TouchableOpacity
              style={[ui.buttonPrimary(theme), { marginBottom: spacing.sm }]}
              disabled={busy}
              onPress={() =>
                post('/confirm', {
                  confirmedStart: confirmStart.toISOString(),
                })
              }
            >
              <Text style={ui.buttonTextPrimary(theme)}>Confirm appointment</Text>
            </TouchableOpacity>
            <TextInput
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Reason if declining"
              placeholderTextColor={theme.subtleText}
              style={[ui.input(theme), { marginBottom: spacing.sm }]}
            />
            <TouchableOpacity
              style={[ui.buttonOutline(theme)]}
              disabled={busy}
              onPress={() => post('/reject', { rejectReason })}
            >
              <Text style={ui.buttonText(theme)}>Decline</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {isPatient && (data.status === 'pending' || data.status === 'confirmed') ? (
          <View style={{ marginTop: spacing.md }}>
            <TextInput
              value={cancelReason}
              onChangeText={setCancelReason}
              placeholder="Cancel reason (optional)"
              placeholderTextColor={theme.subtleText}
              style={[ui.input(theme), { marginBottom: spacing.sm }]}
            />
            <TouchableOpacity
              style={[ui.buttonOutline(theme)]}
              disabled={busy}
              onPress={() => post('/cancel', { cancelReason: cancelReason.trim() || undefined })}
            >
              <Text style={ui.buttonText(theme)}>Cancel appointment</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {isProvider && (data.status === 'pending' || data.status === 'confirmed') ? (
          <View style={{ marginTop: spacing.md }}>
            <TextInput
              value={cancelReason}
              onChangeText={setCancelReason}
              placeholder="Cancel reason (optional)"
              placeholderTextColor={theme.subtleText}
              style={[ui.input(theme), { marginBottom: spacing.sm }]}
            />
            <TouchableOpacity
              style={[ui.buttonOutline(theme)]}
              disabled={busy}
              onPress={() => post('/cancel', { cancelReason: cancelReason.trim() || undefined })}
            >
              <Text style={ui.buttonText(theme)}>Cancel as provider</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {data.status === 'confirmed' && (isPatient || isProvider) ? (
          <View style={{ marginTop: spacing.lg }}>
            <Text style={[ui.caption(theme), { marginBottom: spacing.sm }]}>
              Propose new times (returns to pending until confirmed).
            </Text>
            <TouchableOpacity
              style={[ui.buttonOutline(theme), { marginBottom: spacing.sm }]}
              onPress={() => setShowReschedulePicker(true)}
            >
              <Text style={ui.buttonText(theme)}>{rescheduleWhen.toLocaleString()}</Text>
            </TouchableOpacity>
            {Platform.OS === 'android' && showReschedulePicker ? (
              <DateTimePicker
                value={rescheduleWhen}
                mode="datetime"
                display="default"
                onChange={onRescheduleChange}
              />
            ) : null}
            {Platform.OS === 'ios' ? (
              <Modal visible={showReschedulePicker} transparent animationType="slide">
                <Pressable
                  style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}
                  onPress={() => setShowReschedulePicker(false)}
                />
                <View style={{ backgroundColor: theme.card, paddingBottom: spacing.lg }}>
                  <TouchableOpacity
                    style={{ alignSelf: 'flex-end', padding: spacing.md }}
                    onPress={() => setShowReschedulePicker(false)}
                  >
                    <Text style={{ color: theme.primary, fontFamily: typography.fontFamilySemiBold }}>
                      Done
                    </Text>
                  </TouchableOpacity>
                  <DateTimePicker
                    value={rescheduleWhen}
                    mode="datetime"
                    display="spinner"
                    onChange={onRescheduleChange}
                    style={{ height: 200 }}
                  />
                </View>
              </Modal>
            ) : null}
            <TextInput
              value={rescheduleNote}
              onChangeText={setRescheduleNote}
              placeholder="Note about reschedule"
              placeholderTextColor={theme.subtleText}
              style={[ui.input(theme), { marginBottom: spacing.sm }]}
            />
            <TouchableOpacity
              style={[ui.buttonPrimary(theme)]}
              disabled={busy}
              onPress={() =>
                post('/reschedule', {
                  requestedStart: rescheduleWhen.toISOString(),
                  note: rescheduleNote.trim() || undefined,
                })
              }
            >
              <Text style={ui.buttonTextPrimary(theme)}>Request reschedule</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
