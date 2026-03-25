import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { io } from 'socket.io-client';
import { useAuth, useThemeMode } from '../_layout';
import ScreenHeader from '../components/ScreenHeader';
import { apiRequest } from '../../src/api/client';
import { getSocketBaseUrl } from '../../src/api/socketBase';
import { ui, spacing } from '../../theme/tokens';

export default function ProviderChatScreen() {
  const { providerId, providerName, conversationId: conversationIdParam } = useLocalSearchParams();
  const { token, user } = useAuth();
  const { theme } = useThemeMode();
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [activeConversationId, setActiveConversationId] = useState(
    conversationIdParam ? String(conversationIdParam) : null
  );

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
    const socket = io(getSocketBaseUrl(), {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socket.on('connect', () => {
      socket.emit('conversation:join', activeConversationId);
    });
    socket.on('message:new', ({ message }) => {
      if (!message?._id) return;
      setMessages((prev) => {
        if (prev.some((m) => String(m._id) === String(message._id))) return prev;
        return [...prev, message];
      });
    });
    return () => {
      socket.emit('conversation:leave', activeConversationId);
      socket.disconnect();
    };
  }, [token, activeConversationId]);

  const onSend = async () => {
    if (!body.trim()) return;
    try {
      setSending(true);
      setError('');
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
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={ui.screen(theme)} edges={['top']}>
      <ScreenHeader title={providerName || 'Chat'} />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.lg }}>
        {loading ? <ActivityIndicator color={theme.primary} /> : null}
        {error ? <Text style={ui.errorText(theme)}>{error}</Text> : null}
        {messages.map((msg) => {
          const mine = String(msg.from) === String(user?.id);
          return (
            <View
              key={msg._id}
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
      </ScrollView>
      <View style={styles.inputRow}>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Type a message"
          placeholderTextColor={theme.subtleText}
          style={[ui.input(theme), styles.input]}
        />
        <TouchableOpacity
          style={[ui.buttonPrimary(theme), styles.sendBtn]}
          onPress={onSend}
          disabled={sending}
        >
          <Text style={ui.buttonTextPrimary(theme)}>{sending ? '...' : 'Send'}</Text>
        </TouchableOpacity>
      </View>
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
  },
  input: { flex: 1 },
  sendBtn: { paddingHorizontal: spacing.md },
};
