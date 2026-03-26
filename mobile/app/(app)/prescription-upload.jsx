import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import ScreenHeader from '../components/ScreenHeader';
import { useAuth, useThemeMode } from '../_layout';
import { apiUpload, apiRequest } from '../../src/api/client';
import { ui, spacing } from '../../theme/tokens';

export default function PrescriptionUploadScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { theme } = useThemeMode();
  const params = useLocalSearchParams();

  const providerId = String(params.providerId || '').trim();
  const lineName = String(params.name || '').trim();
  const qty = Math.max(1, parseInt(String(params.qty || '1'), 10) || 1);

  const payload = useMemo(() => {
    try {
      return params.payload ? JSON.parse(String(params.payload)) : null;
    } catch {
      return null;
    }
  }, [params.payload]);

  const [busy, setBusy] = useState(false);

  const pickFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (res.canceled) return null;
    return res.assets?.[0] || null;
  };

  const uploadAndRetry = async () => {
    if (!token) {
      Alert.alert('Sign in', 'Please sign in again.');
      return;
    }
    if (!providerId) {
      Alert.alert('Missing info', 'providerId is required.');
      return;
    }
    try {
      setBusy(true);
      const file = await pickFile();
      if (!file) return;

      const form = new FormData();
      form.append('providerId', providerId);
      form.append('file', {
        uri: file.uri,
        name: file.name || `prescription.${Platform.OS === 'ios' ? 'jpg' : 'bin'}`,
        type: file.mimeType || 'application/octet-stream',
      });

      const up = await apiUpload('/orders/prescriptions', { token, formData: form });
      const prescriptionUploadId = up.data?.prescriptionUploadId;
      if (!prescriptionUploadId) {
        throw new Error('Upload failed');
      }

      const orderBody =
        payload && typeof payload === 'object'
          ? { ...payload, prescriptionUploadId }
          : { providerId, lines: [{ name: lineName, quantity: qty }], prescriptionUploadId };

      const created = await apiRequest('/orders', { method: 'POST', token, body: orderBody });
      const id = created.data?.order?._id || created.data?._id;
      if (id) {
        router.replace({ pathname: '/(app)/orders/[id]', params: { id: String(id) } });
      } else {
        router.replace('/(app)/orders');
      }
    } catch (e) {
      Alert.alert('Prescription', e.message || 'Could not complete order');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={ui.screen(theme)} edges={['top']}>
      <ScreenHeader title="Upload prescription" onBack={() => router.back()} />
      <View style={{ padding: spacing.lg }}>
        <Text style={[ui.caption(theme), { lineHeight: 20 }]}>
          This item requires a prescription. Upload a photo or PDF and we’ll attach it to your order for the pharmacy.
        </Text>

        <TouchableOpacity
          style={[ui.buttonPrimary(theme), { marginTop: spacing.lg }]}
          onPress={uploadAndRetry}
          disabled={busy}
        >
          <Text style={ui.buttonTextPrimary(theme)}>
            {busy ? 'Uploading…' : 'Choose file and continue'}
          </Text>
        </TouchableOpacity>

        {busy ? <ActivityIndicator color={theme.primary} style={{ marginTop: spacing.md }} /> : null}
      </View>
    </SafeAreaView>
  );
}

