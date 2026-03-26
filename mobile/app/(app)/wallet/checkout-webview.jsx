import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useThemeMode } from '../../_layout';
import { apiRequest } from '../../../src/api/client';
import {
  readCheckoutSession,
  clearCheckoutSession,
} from '../../../src/wallet/checkoutSession';
import { ui, spacing, typography } from '../../../theme/tokens';

const POLL_MS = 2200;
const MAX_POLLS = 100;

function shouldFastVerify(url, reference, prefixes) {
  if (!url || !reference) return false;
  const u = url.toLowerCase();
  if (u.includes(String(reference).toLowerCase())) return true;
  if (u.includes('txnref=')) return true;
  if (u.includes('resp=00') || u.includes('responsecode=00')) return true;
  if (u.includes('status=success') || u.includes('payment_status=success')) return true;
  const list = Array.isArray(prefixes) ? prefixes : [];
  for (const p of list) {
    const pre = String(p || '').trim();
    if (pre && url.startsWith(pre)) return true;
  }
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (
      host.includes('interswitchng.com') &&
      (u.includes('callback') || u.includes('return') || u.includes('redirect'))
    ) {
      return true;
    }
  } catch {
    /* invalid url */
  }
  return false;
}

async function verifyOnce(reference, token) {
  const res = await apiRequest('/wallets/me/fund/verify', {
    method: 'POST',
    token,
    body: { reference },
  });
  return res.data?.status === 'success';
}

export default function CheckoutWebViewScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { theme } = useThemeMode();
  const [session, setSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [error, setError] = useState('');
  const pollCount = useRef(0);
  const settled = useRef(false);
  const verifyInFlight = useRef(false);

  const finishIntent = useCallback(
    async (s) => {
      if (!token) {
        router.replace('/(app)/wallet');
        return;
      }
      const intent = s.intent || 'wallet';
      try {
        if (intent === 'appointment' && s.appointmentPayload) {
          const res = await apiRequest('/appointments', {
            method: 'POST',
            token,
            body: s.appointmentPayload,
          });
          const id = res.data?._id;
          if (id) {
            router.replace({ pathname: '/(app)/appointments/[id]', params: { id: String(id) } });
            return;
          }
        }
        if (intent === 'order_pay' && s.orderId) {
          await apiRequest(`/orders/${s.orderId}/pay`, { method: 'POST', token, body: {} });
          router.replace({ pathname: '/(app)/orders/[id]', params: { id: String(s.orderId) } });
          return;
        }
      } catch (e) {
        Alert.alert('Next step', e.message || 'Complete the action from the app.');
      }
      router.replace('/(app)/wallet');
    },
    [router, token]
  );

  const runVerifyLoop = useCallback(
    async (fromPoll) => {
      if (settled.current || !session?.reference || !token) return;
      if (verifyInFlight.current) return;
      verifyInFlight.current = true;
      try {
        const ok = await verifyOnce(session.reference, token);
        if (ok) {
          settled.current = true;
          await clearCheckoutSession();
          await finishIntent(session);
        } else if (fromPoll) {
          pollCount.current += 1;
          if (pollCount.current >= MAX_POLLS) {
            settled.current = true;
            await clearCheckoutSession();
            Alert.alert(
              'Payment',
              'We could not confirm payment yet. If money left your account, open Wallet — balance updates when Interswitch confirms.'
            );
            router.replace('/(app)/wallet');
          }
        }
      } catch {
        /* still pending */
      } finally {
        verifyInFlight.current = false;
      }
    },
    [session, token, finishIntent, router]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      const s = await readCheckoutSession();
      if (!mounted) return;
      if (!s?.reference || (!s?.paymentLink && !s?.paymentHtml)) {
        setLoadingSession(false);
        setError('No active checkout');
        return;
      }
      setSession(s);
      setLoadingSession(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!session?.reference || !token) return undefined;
    pollCount.current = 0;
    settled.current = false;
    runVerifyLoop(false);
    const t = setInterval(() => runVerifyLoop(true), POLL_MS);
    return () => clearInterval(t);
  }, [session?.reference, token, runVerifyLoop]);

  const onNavChange = useCallback(
    (navState) => {
      const url = navState?.url || '';
      if (!session || settled.current) return;
      if (shouldFastVerify(url, session.reference, session.returnUrlPrefixes)) {
        runVerifyLoop(false);
      }
    },
    [session, runVerifyLoop]
  );

  const onClose = async () => {
    settled.current = true;
    await clearCheckoutSession();
    router.back();
  };

  if (loadingSession) {
    return (
      <SafeAreaView style={[ui.screen(theme), styles.center]} edges={['top']}>
        <ActivityIndicator color={theme.primary} />
      </SafeAreaView>
    );
  }

  if (error || (!session?.paymentLink && !session?.paymentHtml)) {
    return (
      <SafeAreaView style={ui.screen(theme)} edges={['top']}>
        <View style={[styles.headerRow, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="close" size={26} color={theme.text} />
          </TouchableOpacity>
          <Text style={[typography.bodyLarge, { color: theme.text, fontFamily: typography.fontFamilySemiBold }]}>
            Checkout
          </Text>
          <View style={{ width: 26 }} />
        </View>
        <Text style={[ui.caption(theme), { padding: spacing.lg }]}>{error || 'Nothing to pay.'}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={[styles.headerRow, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text
            style={[
              typography.caption,
              { color: theme.text, fontFamily: typography.fontFamilySemiBold, textAlign: 'center' },
            ]}
          >
            Secure payment
          </Text>
          <Text
            style={[
              typography.caption,
              { fontSize: 11, color: theme.subtleText, textAlign: 'center', marginTop: 2 },
            ]}
          >
            Interswitch · do not close until finished
          </Text>
        </View>
        <View style={{ width: 26 }} />
      </View>
      <WebView
        source={
          session.paymentHtml
            ? { html: session.paymentHtml, baseUrl: 'https://medmap.wallet/' }
            : { uri: session.paymentLink }
        }
        onNavigationStateChange={onNavChange}
        onShouldStartLoadWithRequest={(req) => {
          onNavChange({ url: req.url });
          return true;
        }}
        startInLoadingState
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        style={styles.flex}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: spacing.xs },
});
