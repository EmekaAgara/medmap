import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useThemeMode, useAuth } from '../_layout';
import ScreenHeader from '../components/ScreenHeader';
import { ui, spacing, typography, radii, layout, brand } from '../../theme/tokens';
import { apiRequest, apiUpload } from '../../src/api/client';
import { ShimmerBlock, ShimmerText } from '../components/Shimmer';

const GOLD = brand.gold;

const STEP_ORDER = { bvn: 1, identity: 2, documents: 3, bank: 4, submitted: 5 };

const ID_TYPES = [
  { value: 'national_id',      label: 'National ID (NIN)' },
  { value: 'passport',         label: 'International Passport' },
  { value: 'drivers_license',  label: "Driver's Licence" },
  { value: 'voters_card',      label: "Voter's Card" },
];

const STEPS = ['Status', 'BVN', 'Identity', 'Documents', 'Bank', 'Review'];

export default function KycScreen() {
  const { theme } = useThemeMode();
  const { token } = useAuth();
  const router = useRouter();

  const [kycData, setKycData]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [step, setStep]           = useState(0); // 0 = status overview
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const [isResubmission, setIsResubmission] = useState(false);

  // step 1 — BVN
  const [bvn, setBvn] = useState('');

  // step 2 — Identity
  const [idType, setIdType]     = useState('');
  const [idNumber, setIdNumber] = useState('');

  // step 3 — Documents
  const [idFront, setIdFront]   = useState(null);  // { uri, mimeType }
  const [idBack, setIdBack]     = useState(null);
  const [selfie, setSelfie]     = useState(null);

  // step 4 — Bank
  const [bankName, setBankName]         = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName]   = useState('');

  // Returns the first incomplete step so users resume where they left off.
  // Uses kycStep (server-tracked progress) so a skipped BVN doesn't loop back to step 1.
  const getResumeStep = (data) => {
    const reached = STEP_ORDER[data?.kycStep] ?? 0;
    if (reached >= 4) return 5;
    if (reached >= 3) return 4;
    if (reached >= 2) return 3;
    if (reached >= 1) return 2;
    return 1;
  };

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/kyc', { method: 'GET', token });
      setKycData(res.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { fetchStatus(); }, [fetchStatus]));

  // ── Step handlers ──────────────────────────────────────────────────────────

  const handleBvn = async () => {
    setError('');
    if (!/^\d{11}$/.test(bvn.trim())) { setError('BVN must be exactly 11 digits.'); return; }
    try {
      setSaving(true);
      await apiRequest('/kyc/bvn', { method: 'POST', token, body: { bvn: bvn.trim() } });
      setStep(2);
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  const handleSkipBvn = async () => {
    setError('');
    try {
      setSaving(true);
      await apiRequest('/kyc/skip-bvn', { method: 'POST', token });
      setStep(2);
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  const handleIdentity = async () => {
    setError('');
    if (!idType) { setError('Please select an ID type.'); return; }
    if (!idNumber.trim()) { setError('ID number is required.'); return; }
    try {
      setSaving(true);
      await apiRequest('/kyc/identity', { method: 'POST', token, body: { idType, idNumber: idNumber.trim() } });
      setStep(3);
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  const pickImage = async (setter) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      setter({ uri: asset.uri, mimeType: asset.mimeType || 'image/jpeg', name: asset.fileName || 'photo.jpg' });
    }
  };

  const takeSelfie = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required to take a selfie.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      cameraType: ImagePicker.CameraType.front,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      setSelfie({ uri: asset.uri, mimeType: asset.mimeType || 'image/jpeg', name: asset.fileName || 'selfie.jpg' });
    }
  };

  const uploadDocuments = async () => {
    setError('');
    if (!idFront) { setError('ID front photo is required.'); return; }
    if (!selfie)  { setError('Selfie photo is required.'); return; }
    try {
      setSaving(true);
      // Upload ID front
      const frontForm = new FormData();
      frontForm.append('document', { uri: idFront.uri, type: idFront.mimeType, name: idFront.name });
      frontForm.append('side', 'front');
      await apiUpload('/kyc/id-document', { formData: frontForm, token });

      // Upload ID back (optional)
      if (idBack) {
        const backForm = new FormData();
        backForm.append('document', { uri: idBack.uri, type: idBack.mimeType, name: idBack.name });
        backForm.append('side', 'back');
        await apiUpload('/kyc/id-document', { formData: backForm, token });
      }

      // Upload selfie
      const selfieForm = new FormData();
      selfieForm.append('selfie', { uri: selfie.uri, type: selfie.mimeType, name: selfie.name });
      await apiUpload('/kyc/selfie', { formData: selfieForm, token });

      setStep(4);
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  const handleBank = async () => {
    setError('');
    if (!bankName.trim() || !accountNumber.trim() || !accountName.trim()) {
      setError('Bank name, account number, and account name are all required.');
      return;
    }
    if (!/^\d{10}$/.test(accountNumber.trim())) {
      setError('Account number must be exactly 10 digits.');
      return;
    }
    try {
      setSaving(true);
      await apiRequest('/kyc/bank', {
        method: 'POST', token,
        body: { bankName: bankName.trim(), accountNumber: accountNumber.trim(), accountName: accountName.trim() },
      });
      // Refresh KYC data for review step
      const res = await apiRequest('/kyc', { method: 'GET', token });
      setKycData(res.data);
      setStep(5);
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      await apiRequest('/kyc/submit', { method: 'POST', token });
      Alert.alert(
        'Submitted!',
        'Your KYC documents have been submitted for review. We will notify you once verified.',
        [{
          text: 'OK',
          onPress: () => {
            setIsResubmission(false);
            router.navigate({ pathname: '/(app)/(tabs)/profile', params: { r: Date.now() } });
          },
        }]
      );
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  // ── Loading / error states ─────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'bottom']}>
        <ScreenHeader title="Identity Verification" />
        <View style={{ flex: 1, paddingHorizontal: layout.screenPaddingHorizontal, paddingTop: spacing.lg, gap: spacing.md }}>
          <ShimmerBlock theme={theme} style={{ height: 90, borderRadius: radii.xs }} />
          <ShimmerText theme={theme} lines={3} />
          <ShimmerBlock theme={theme} style={{ height: 48, borderRadius: radii.xs }} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Step 0: Status overview ────────────────────────────────────────────────
  if (step === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'bottom']}>
        <ScreenHeader title="Identity Verification" />
        <ScrollView contentContainerStyle={{ paddingHorizontal: layout.screenPaddingHorizontal, paddingBottom: spacing['3xl'] }} showsVerticalScrollIndicator={false}>

          {/* Status badge */}
          <StatusBanner kycData={kycData} theme={theme} />

          {/* Checklist */}
          <View style={{ marginTop: spacing.xl }}>
            <SectionTitle label="VERIFICATION CHECKLIST" theme={theme} />
            <View style={[ui.card(theme), { padding: 0, overflow: 'hidden', borderRadius: radii.xs }]}>
              <ChecklistRow icon="card-outline"   label="BVN (optional for international users)" done={!!kycData?.bvn} skipped={!kycData?.bvn && STEP_ORDER[kycData?.kycStep] >= 1} theme={theme} />
              <ChecklistRow icon="id-card-outline" label="Government ID" done={!!kycData?.kycDocuments?.idType}       theme={theme} />
              <ChecklistRow icon="document-outline" label="ID Document"  done={!!kycData?.kycDocuments?.idFrontUrl}   theme={theme} />
              <ChecklistRow icon="camera-outline"  label="Selfie"        done={!!kycData?.kycDocuments?.selfieUrl}    theme={theme} />
              <ChecklistRow icon="business-outline" label="Bank account" done={!!kycData?.bankAccounts?.length}       theme={theme} isLast />
            </View>
          </View>

          {/* Rejection reason */}
          {kycData?.kycStatus === 'rejected' && kycData?.kycRejectionReason ? (
            <View style={{ marginTop: spacing.lg, flexDirection: 'row', gap: spacing.sm, backgroundColor: theme.error + '18', padding: spacing.md, borderRadius: 8 }}>
              <Ionicons name="alert-circle" size={18} color={theme.error} />
              <Text style={{ flex: 1, fontFamily: typography.fontFamilyRegular, fontSize: 13, color: theme.error, lineHeight: 20 }}>
                <Text style={{ fontFamily: typography.fontFamilySemiBold }}>Rejection reason: </Text>
                {kycData.kycRejectionReason}
              </Text>
            </View>
          ) : null}

          {/* CTA — show only when not approved and not submitted for review */}
          {kycData?.kycStatus !== 'approved' && kycData?.kycStep !== 'submitted' ? (
            <TouchableOpacity
              style={[ui.buttonPrimary(theme), { marginTop: spacing['2xl'] }]}
              onPress={() => {
                const isRejected = kycData?.kycStatus === 'rejected';
                // Pre-fill all text fields that already exist
                if (kycData?.bvn) setBvn(kycData.bvn);
                if (kycData?.kycDocuments?.idType)   setIdType(kycData.kycDocuments.idType);
                if (kycData?.kycDocuments?.idNumber) setIdNumber(kycData.kycDocuments.idNumber);
                const bank = kycData?.bankAccounts?.[0];
                if (bank) {
                  setBankName(bank.bankName || '');
                  setAccountNumber(bank.accountNumber || '');
                  setAccountName(bank.accountName || '');
                }
                if (isRejected) {
                  setIsResubmission(true);
                  setStep(1); // Resubmission starts fresh from step 1 (data pre-filled above)
                } else {
                  setStep(getResumeStep(kycData)); // Resume from the first incomplete step
                }
              }}
              activeOpacity={0.9}
            >
              <Text style={ui.buttonTextPrimary(theme)}>
                {kycData?.kycStatus === 'rejected'
                  ? 'Resubmit verification'
                  : kycData?.kycStep
                  ? 'Continue verification'
                  : 'Start verification'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Steps 1-5: Multi-step form ─────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'bottom']}>
      <ScreenHeader
        title="Identity Verification"
        onBack={step > 1
          ? () => { setStep(step - 1); setError(''); }
          : () => { setStep(0); setIsResubmission(false); setError(''); }
        }
      />

      {/* Progress bar */}
      <View style={{ paddingHorizontal: layout.screenPaddingHorizontal, paddingVertical: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          {[1,2,3,4,5].map((s) => (
            <View key={s} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: s <= step ? GOLD : theme.border }} />
          ))}
        </View>
        <Text style={{ fontFamily: typography.fontFamilyMedium, fontSize: 12, color: theme.subtleText, marginTop: spacing.xs }}>
          Step {step} of 5 — {STEPS[step]}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: layout.screenPaddingHorizontal, paddingBottom: spacing['3xl'] }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Rejection reason reminder — shown during resubmission */}
        {isResubmission && kycData?.kycRejectionReason ? (
          <View style={{ flexDirection: 'row', gap: spacing.sm, backgroundColor: theme.error + '12', borderWidth: 1, borderColor: theme.error + '40', padding: spacing.md, borderRadius: 8, marginBottom: spacing.lg }}>
            <Ionicons name="alert-circle-outline" size={18} color={theme.error} style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: typography.fontFamilySemiBold, fontSize: 12, color: theme.error, marginBottom: 2 }}>
                Admin rejection reason
              </Text>
              <Text style={{ fontFamily: typography.fontFamilyRegular, fontSize: 13, color: theme.error, lineHeight: 19 }}>
                {kycData.kycRejectionReason}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Error */}
        {error ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: theme.error + '18', padding: spacing.md, borderRadius: 8, marginBottom: spacing.lg }}>
            <Ionicons name="alert-circle" size={18} color={theme.error} />
            <Text style={[ui.errorText(theme), { flex: 1 }]}>{error}</Text>
          </View>
        ) : null}

        {/* ── Step 1: BVN ── */}
        {step === 1 && (
          <>
            <StepHeading
              title="Bank Verification Number"
              sub="Your BVN links your identity to your bank records. It is 11 digits and can be retrieved by dialling *565*0# on any phone."
              theme={theme}
            />
            <Field label="BVN (11 digits)" value={bvn} onChangeText={(t) => setBvn(t.replace(/\D/g,'').slice(0,11))} placeholder="12345678901" keyboardType="number-pad" theme={theme} />
            <PrimaryButton label="Continue" loading={saving} onPress={handleBvn} theme={theme} />
            {/* Skip option for international users */}
            <TouchableOpacity
              onPress={handleSkipBvn}
              disabled={saving}
              style={{ marginTop: spacing.lg, alignItems: 'center', paddingVertical: spacing.sm }}
              activeOpacity={0.7}
            >
              <Text style={{ fontFamily: typography.fontFamilyMedium, fontSize: 13, color: theme.subtleText }}>
                I don't have a BVN (international user)
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── Step 2: Identity ── */}
        {step === 2 && (
          <>
            <StepHeading title="Government ID" sub="Select your ID type and enter your ID number." theme={theme} />
            <Text style={{ fontFamily: typography.fontFamilyMedium, fontSize: 13, color: theme.subtleText, marginBottom: spacing.sm }}>ID type</Text>
            <View style={[ui.card(theme), { padding: 0, overflow: 'hidden', borderRadius: radii.xs, marginBottom: spacing.lg }]}>
              {ID_TYPES.map((t, i) => (
                <TouchableOpacity
                  key={t.value}
                  onPress={() => setIdType(t.value)}
                  activeOpacity={0.75}
                  style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderBottomWidth: i < ID_TYPES.length - 1 ? 1 : 0, borderBottomColor: theme.border }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: typography.fontFamilyMedium, fontSize: 14, color: theme.text }}>{t.label}</Text>
                  </View>
                  <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: idType === t.value ? GOLD : theme.border, alignItems: 'center', justifyContent: 'center' }}>
                    {idType === t.value && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: GOLD }} />}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            <Field label="ID number" value={idNumber} onChangeText={setIdNumber} placeholder="Enter your ID number" theme={theme} />
            <PrimaryButton label="Continue" loading={saving} onPress={handleIdentity} theme={theme} />
          </>
        )}

        {/* ── Step 3: Documents ── */}
        {step === 3 && (
          <>
            <StepHeading title="Upload Documents" sub="Upload clear photos of your government ID and a selfie. Ensure all text is readable." theme={theme} />
            <PhotoPicker label="ID — front face (required)" image={idFront} onPick={() => pickImage(setIdFront)} theme={theme} />
            <PhotoPicker label="ID — back face (optional)" image={idBack}  onPick={() => pickImage(setIdBack)}  theme={theme} />
            <PhotoPicker label="Selfie — front camera (required)" image={selfie} onPick={takeSelfie} theme={theme} selfie />
            <PrimaryButton label={saving ? 'Uploading…' : 'Upload & continue'} loading={saving} onPress={uploadDocuments} theme={theme} />
          </>
        )}

        {/* ── Step 4: Bank Account ── */}
        {step === 4 && (
          <>
            <StepHeading title="Bank Account" sub="Add your primary bank account for disbursements and repayments." theme={theme} />
            <Field label="Bank name" value={bankName} onChangeText={setBankName} placeholder="e.g. Access Bank" theme={theme} />
            <Field label="Account number (10 digits)" value={accountNumber} onChangeText={(t) => setAccountNumber(t.replace(/\D/g,'').slice(0,10))} placeholder="0123456789" keyboardType="number-pad" theme={theme} />
            <Field label="Account name" value={accountName} onChangeText={setAccountName} placeholder="As it appears on your bank statement" theme={theme} />
            <PrimaryButton label="Continue" loading={saving} onPress={handleBank} theme={theme} />
          </>
        )}

        {/* ── Step 5: Review & Submit ── */}
        {step === 5 && (
          <>
            <StepHeading title="Review & Submit" sub="Review your information before submitting for verification." theme={theme} />
            <ReviewCard kycData={kycData} theme={theme} />
            <PrimaryButton label="Submit for verification" loading={saving} onPress={handleSubmit} theme={theme} />
            <TouchableOpacity onPress={() => setStep(1)} style={{ marginTop: spacing.lg, alignItems: 'center' }}>
              <Text style={{ fontFamily: typography.fontFamilyMedium, fontSize: 13, color: theme.subtleText }}>Edit information</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBanner({ kycData, theme }) {
  const isApproved  = kycData?.kycStatus === 'approved';
  const isSubmitted = kycData?.kycStep   === 'submitted';
  const isRejected  = kycData?.kycStatus === 'rejected';

  const config = isApproved
    ? { icon: 'shield-checkmark-outline', color: theme.success,   bg: theme.success + '18',   label: 'Verified',       sub: 'Your identity has been verified.' }
    : isSubmitted
    ? { icon: 'time-outline',             color: GOLD,             bg: brand.goldBg,            label: 'Under review',   sub: 'Your documents are being reviewed. This usually takes 1–2 business days.' }
    : isRejected
    ? { icon: 'close-circle-outline',     color: theme.error,      bg: theme.error + '18',     label: 'Rejected',       sub: 'Please resubmit with correct documents.' }
    : { icon: 'shield-outline',           color: theme.subtleText, bg: theme.secondary,         label: 'Not started',    sub: 'Complete verification to unlock all features.' };

  return (
    <View style={{ marginTop: spacing.xl, flexDirection: 'row', alignItems: 'center', gap: spacing.lg, backgroundColor: config.bg, padding: spacing.lg, borderRadius: radii.md }}>
      <Ionicons name={config.icon} size={36} color={config.color} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: typography.fontFamilySemiBold, fontSize: 16, color: config.color }}>{config.label}</Text>
        <Text style={{ fontFamily: typography.fontFamilyRegular, fontSize: 13, color: theme.subtleText, marginTop: 2, lineHeight: 18 }}>{config.sub}</Text>
      </View>
    </View>
  );
}

function ChecklistRow({ icon, label, done, skipped, theme, isLast }) {
  const iconName  = done ? 'checkmark-circle' : skipped ? 'remove-circle-outline' : 'ellipse-outline';
  const iconColor = done ? theme.success : skipped ? theme.subtleText : theme.border;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderBottomWidth: isLast ? 0 : 1, borderBottomColor: theme.border }}>
      <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: theme.secondary, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md }}>
        <Ionicons name={icon} size={16} color={theme.primary} />
      </View>
      <Text style={{ flex: 1, fontFamily: typography.fontFamilyMedium, fontSize: 14, color: theme.text }}>{label}</Text>
      {skipped && !done
        ? <Text style={{ fontFamily: typography.fontFamilyMedium, fontSize: 11, color: theme.subtleText, marginRight: spacing.xs }}>Skipped</Text>
        : null}
      <Ionicons name={iconName} size={20} color={iconColor} />
    </View>
  );
}

function SectionTitle({ label, theme }) {
  return <Text style={{ fontFamily: typography.fontFamilySemiBold, fontSize: 11, letterSpacing: 0.8, color: theme.subtleText, marginBottom: spacing.sm }}>{label}</Text>;
}

function StepHeading({ title, sub, theme }) {
  return (
    <View style={{ marginBottom: spacing.xl }}>
      <Text style={{ fontFamily: typography.fontFamilySemiBold, fontSize: 18, color: theme.text, marginBottom: spacing.xs }}>{title}</Text>
      <Text style={{ fontFamily: typography.fontFamilyRegular, fontSize: 13, color: theme.subtleText, lineHeight: 20 }}>{sub}</Text>
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType, theme }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={{ fontFamily: typography.fontFamilyMedium, fontSize: 13, color: theme.subtleText, marginBottom: spacing.xs }}>{label}</Text>
      <TextInput
        style={[ui.input(theme), focused && { borderColor: GOLD }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.subtleText}
        keyboardType={keyboardType || 'default'}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoCapitalize="none"
      />
    </View>
  );
}

function PhotoPicker({ label, image, onPick, theme, selfie }) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={{ fontFamily: typography.fontFamilyMedium, fontSize: 13, color: theme.subtleText, marginBottom: spacing.sm }}>{label}</Text>
      <TouchableOpacity
        onPress={onPick}
        activeOpacity={0.8}
        style={{
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: theme.border,
          borderRadius: radii.md,
          overflow: 'hidden',
          height: selfie ? 200 : 160,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.secondary,
        }}
      >
        {image ? (
          <Image source={{ uri: image.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <View style={{ alignItems: 'center', gap: spacing.sm }}>
            <Ionicons name={selfie ? 'camera-outline' : 'image-outline'} size={32} color={theme.subtleText} />
            <Text style={{ fontFamily: typography.fontFamilyMedium, fontSize: 13, color: theme.subtleText }}>
              {selfie ? 'Tap to open front camera' : 'Tap to select photo'}
            </Text>
          </View>
        )}
        {image && (
          <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: GOLD, borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="checkmark" size={14} color="#000" />
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

function ReviewCard({ kycData, theme }) {
  const idTypeLabel = ID_TYPES.find((t) => t.value === kycData?.kycDocuments?.idType)?.label || kycData?.kycDocuments?.idType || '—';
  const bank = kycData?.bankAccounts?.[0];
  return (
    <View style={[ui.card(theme), { padding: 0, overflow: 'hidden', borderRadius: radii.xs, marginBottom: spacing.lg }]}>
      {[
        { label: 'BVN', value: kycData?.bvn ? '••••••' + kycData.bvn.slice(-5) : 'Skipped (international)' },
        { label: 'ID type', value: idTypeLabel },
        { label: 'ID number', value: kycData?.kycDocuments?.idNumber || '—' },
        { label: 'ID front', value: kycData?.kycDocuments?.idFrontUrl ? 'Uploaded ✓' : 'Not uploaded' },
        { label: 'Selfie', value: kycData?.kycDocuments?.selfieUrl ? 'Uploaded ✓' : 'Not uploaded' },
        { label: 'Bank', value: bank ? `${bank.bankName} — ${bank.accountNumber}` : '—' },
      ].map(({ label, value }, i, arr) => (
        <View key={label} style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: theme.border }}>
          <Text style={{ flex: 1, fontFamily: typography.fontFamilyMedium, fontSize: 13, color: theme.subtleText }}>{label}</Text>
          <Text style={{ fontFamily: typography.fontFamilyMedium, fontSize: 13, color: theme.text }}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

function PrimaryButton({ label, loading, onPress, theme }) {
  return (
    <TouchableOpacity style={[ui.buttonPrimary(theme), { marginTop: spacing.lg }]} onPress={onPress} disabled={loading} activeOpacity={0.9}>
      {loading ? <ActivityIndicator color={theme.primaryForeground} /> : <Text style={ui.buttonTextPrimary(theme)}>{label}</Text>}
    </TouchableOpacity>
  );
}
