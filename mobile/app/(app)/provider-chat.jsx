import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { io } from 'socket.io-client';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useThemeMode } from '../_layout';
import ScreenHeader from '../components/ScreenHeader';
import { apiRequest } from '../../src/api/client';
import { getSocketBaseUrl } from '../../src/api/socketBase';
import { ui, spacing } from '../../theme/tokens';
import { ShimmerBlock } from '../components/Shimmer';

function TypingDots({ theme }) {
  const a1 = useRef(new Animated.Value(0.2)).current;
  const a2 = useRef(new Animated.Value(0.2)).current;
  const a3 = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    const mk = (v, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.2, duration: 300, useNativeDriver: true }),
          Animated.delay(300),
        ])
      );
    const l1 = mk(a1, 0);
    const l2 = mk(a2, 120);
    const l3 = mk(a3, 240);
    l1.start();
    l2.start();
    l3.start();
    return () => {
      l1.stop();
      l2.stop();
      l3.stop();
    };
  }, [a1, a2, a3]);

  const dotStyle = (opacity) => ({
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.subtleText,
    opacity,
    marginRight: 6,
  });

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Animated.View style={dotStyle(a1)} />
      <Animated.View style={dotStyle(a2)} />
      <Animated.View style={dotStyle(a3)} />
    </View>
  );
}

export default function ProviderChatScreen() {
  const { providerId, providerName, conversationId: conversationIdParam } = useLocalSearchParams();
  const { token, user } = useAuth();
  const { theme } = useThemeMode();
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [aiTyping, setAiTyping] = useState(false);
  const [error, setError] = useState('');
  const [activeConversationId, setActiveConversationId] = useState(
    conversationIdParam ? String(conversationIdParam) : null
  );

  const isMeddie = useMemo(() => {
    const n = String(providerName || '').toLowerCase();
    return n.includes('meddie');
  }, [providerName]);

  useEffect(() => {
    if (conversationIdParam) setActiveConversationId(String(conversationIdParam));
  }, [conversationIdParam]);

  const loadMessages = async () => {
    if (!activeConversationId) return;
    try {
      setLoading(true);
      const res = await apiRequest(`/messages/conversations/${activeConversationId}`, {
        method: 'GET',
        token,
      });
      setMessages(res.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, [activeConversationId]);

  useEffect(() => {
    if (!token || !activeConversationId) return;
    const base = getSocketBaseUrl();
    const socket = io(base, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 8,
      reconnectionDelay: 1000,
    });
    socket.on('connect', () => {
      setError('');
      socket.emit('conversation:join', activeConversationId);
    });
    socket.on('connect_error', (err) => {
      const msg = err?.message || 'Could not connect to chat server';
      setError(
        `${msg}. Check API is running and EXPO_PUBLIC_API_URL / EXPO_PUBLIC_SOCKET_URL match your machine (see mobile/.env.example).`
      );
    });
    socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        setError('Chat disconnected by server. Please reopen.');
      }
    });
    socket.on('message:new', ({ message }) => {
      if (!message?._id) return;
      setMessages((prev) => {
        if (prev.some((m) => String(m._id) === String(message._id))) return prev;
        return [...prev, message];
      });
      // If this is a Meddie chat, any inbound message from the other party ends typing state.
      if (isMeddie && String(message.from) !== String(user?.id)) {
        setAiTyping(false);
      }
    });
    return () => {
      socket.emit('conversation:leave', activeConversationId);
      socket.disconnect();
    };
  }, [token, activeConversationId, isMeddie, user?.id]);

  const onSend = async () => {
    if (!body.trim()) return;
    try {
      setSending(true);
      setError('');
      if (isMeddie) setAiTyping(true);
      if (activeConversationId) {
        const res = await apiRequest(`/messages/conversations/${activeConversationId}/reply`, {
          method: 'POST',
          token,
          body: { body: body.trim() },
        });
        const sent = res.data;
        setBody('');
        if (sent) setMessages((prev) => [...prev, sent]);
        return;
      }
      if (!providerId) return;
      const res = await apiRequest('/messages/provider', {
        method: 'POST',
        token,
        body: { providerId, body: body.trim() },
      });
      const payload = res.data;
      setBody('');
      if (payload?.conversationId) setActiveConversationId(String(payload.conversationId));
    } catch (e) {
      setError(e.message);
      setAiTyping(false);
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={ui.screen(theme)} edges={['top']}>
      <ScreenHeader title={providerName || 'Chat'} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        // Reduce extra gap between keyboard and composer (header already inside SafeAreaView).
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: spacing.lg, paddingHorizontal: spacing.md, paddingTop: spacing.md }}
          keyboardShouldPersistTaps="handled"
        >
          {loading ? (
            <View style={{ gap: spacing.sm }}>
              <ShimmerBlock theme={theme} style={{ height: 38, width: '55%', borderRadius: 12 }} />
              <ShimmerBlock theme={theme} style={{ height: 38, width: '45%', borderRadius: 12, alignSelf: 'flex-end' }} />
              <ShimmerBlock theme={theme} style={{ height: 38, width: '62%', borderRadius: 12 }} />
            </View>
          ) : null}
          {error ? <Text style={ui.errorText(theme)}>{error}</Text> : null}
          {messages.map((msg, idx) => {
            const mine = String(msg.from) === String(user?.id);
            const base =
              msg?._id ||
              msg?.id ||
              `${msg?.conversationId || activeConversationId || 'conv'}:${msg?.from || 'u'}:${msg?.createdAt || msg?.timestamp || 't'}`;
            const key = `${base}:${idx}`;
            return (
              <View
                key={key}
                style={[
                  styles.bubble,
                  {
                    alignSelf: mine ? 'flex-end' : 'flex-start',
                    backgroundColor: mine ? theme.primary + '22' : theme.card,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Text style={{ color: theme.text }}>{msg.body}</Text>
              </View>
            );
          })}

          {isMeddie && aiTyping ? (
            <View
              style={[
                styles.bubble,
                {
                  alignSelf: 'flex-start',
                  backgroundColor: theme.card,
                  borderColor: theme.border,
                },
              ]}
            >
              <TypingDots theme={theme} />
            </View>
          ) : null}
        </ScrollView>

        <View style={[styles.inputRow, { backgroundColor: theme.background }]}>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Type a message"
            placeholderTextColor={theme.subtleText}
            style={[ui.input(theme), styles.input, { paddingVertical: spacing.sm, paddingHorizontal: spacing.md }]}
            multiline
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              { backgroundColor: theme.primary, opacity: sending || !body.trim() ? 0.6 : 1 },
            ]}
            onPress={onSend}
            disabled={sending || !body.trim()}
          >
            <Ionicons name="send" size={18} color={theme.primaryForeground} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = {
  bubble: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    maxWidth: '80%',
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  input: { flex: 1 },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
};
