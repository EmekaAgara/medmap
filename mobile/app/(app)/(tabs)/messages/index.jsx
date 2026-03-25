import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useThemeMode } from '../../../_layout';
import { useAuth } from '../../../_layout';
import { apiRequest } from '../../../../src/api/client';
import { ui, spacing } from '../../../../theme/tokens';

export default function MessagesScreen() {
  const { theme } = useThemeMode();
  const { token } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [conversations, setConversations] = useState([]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiRequest('/messages/conversations', { method: 'GET', token });
      setConversations(res.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [])
  );

  return (
    <ScrollView style={ui.screen(theme)}>
      <Text style={[ui.h2(theme), styles.title]}>Messages</Text>
      <Text style={ui.caption(theme)}>Your provider conversations.</Text>
      {loading ? <ActivityIndicator color={theme.primary} style={{ marginTop: spacing.md }} /> : null}
      {error ? <Text style={ui.errorText(theme)}>{error}</Text> : null}
      {!loading && conversations.length === 0 ? (
        <Text style={[ui.caption(theme), { marginTop: spacing.md }]}>No conversations yet.</Text>
      ) : null}

      {conversations.map((item) => (
        <TouchableOpacity
          key={item.conversationId}
          onPress={() =>
            router.push({
              pathname: '/(app)/provider-chat',
              params: {
                conversationId: item.conversationId,
                providerName: item.provider?.name || item.peerName,
                providerId: item.provider?._id,
              },
            })
          }
          style={[ui.card(theme), styles.item]}
        >
          <Text style={{ color: theme.text, fontWeight: '600' }}>
            {item.provider?.name || item.peerName}
          </Text>
          <Text style={[ui.caption(theme), { marginTop: 4 }]} numberOfLines={1}>
            {item.latestMessage}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = {
  title: { marginBottom: spacing.sm },
  item: { marginTop: spacing.md },
};
