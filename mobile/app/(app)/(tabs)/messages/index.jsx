import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Image } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeMode } from '../../../_layout';
import { useAuth } from '../../../_layout';
import { apiRequest } from '../../../../src/api/client';
import { ui, spacing, radii, typography } from '../../../../theme/tokens';
import ScreenHeader from '../../../components/ScreenHeader';
import { ShimmerAvatar, ShimmerBlock, ShimmerText } from '../../../components/Shimmer';

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || '';
  const b = parts[1]?.[0] || '';
  return (a + b).toUpperCase() || '?';
}

function timeAgo(d) {
  const t = d ? new Date(d).getTime() : 0;
  if (!t) return '';
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'now';
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  return `${day}d`;
}

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

  const openMeddie = async () => {
    try {
      const res = await apiRequest('/messages/meddie/start', { method: 'POST', token, body: {} });
      const conversationId = res.data?.conversationId;
      if (conversationId) {
        router.push({
          pathname: '/(app)/provider-chat',
          params: {
            conversationId,
            providerName: 'Meddie AI',
          },
        });
      }
    } catch (e) {
      setError(e.message);
    }
  };

  const visibleConversations = (conversations || []).filter((c) => !c?.isMeddie);
  const meddieConversation = (conversations || []).find((c) => c?.isMeddie);
  const meddieUnreadCount = Number(
    meddieConversation?.unreadCount ||
      meddieConversation?.unreadMessages ||
      0
  );
  const meddieHasUnread =
    meddieUnreadCount > 0 ||
    !!meddieConversation?.isUnread ||
    !!meddieConversation?.unread;

  return (
    <SafeAreaView style={ui.screen(theme)} edges={['top']}>
      <ScreenHeader title="Messages" showBack={false} style={{ marginTop: spacing.xs }} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: spacing.sm, paddingBottom: spacing['2xl'] }}>
        <TouchableOpacity
          onPress={openMeddie}
          activeOpacity={0.9}
          style={[styles.row, { borderColor: theme.border, backgroundColor: theme.card }]}
        >
          <View style={[styles.avatar, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
            <Text style={{ color: theme.text, fontFamily: typography.fontFamilySemiBold }}>
              {initials('Meddie AI')}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.topLine}>
              <Text style={[styles.name, { color: theme.text }]}>Meddie AI</Text>
              <Text style={[styles.time, { color: theme.subtleText }]} />
            </View>
            <Text style={[styles.preview, { color: theme.subtleText }]} numberOfLines={1}>
              AI health assistant (uses your medical profile with consent)
            </Text>
          </View>
          {meddieHasUnread ? (
            <View style={[styles.unreadDot, { backgroundColor: theme.error }]} />
          ) : null}
        </TouchableOpacity>

        {loading ? (
          <View style={{ marginTop: spacing.md, gap: spacing.md }}>
            {Array.from({ length: 4 }).map((_, idx) => (
              <View key={`msg-shimmer-${idx}`} style={[styles.row, { borderColor: theme.border, backgroundColor: theme.card }]}>
                <ShimmerAvatar theme={theme} size={44} />
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <ShimmerBlock theme={theme} style={{ height: 12, width: '45%' }} />
                  <ShimmerText theme={theme} lines={1} />
                </View>
              </View>
            ))}
          </View>
        ) : null}
        {error ? <Text style={[ui.errorText(theme), { marginTop: spacing.sm }]}>{error}</Text> : null}
        {!loading && visibleConversations.length === 0 ? (
          <Text style={[ui.caption(theme), { marginTop: spacing.md }]}>No conversations yet.</Text>
        ) : null}

        {visibleConversations.map((item) => {
          const displayName = item.provider?.name || item.peerName;
          const avatarUrl = item.provider?.imageUrl || item.peerAvatarUrl;
          const unreadCount = Number(item?.unreadCount || item?.unreadMessages || 0);
          const hasUnread = unreadCount > 0 || !!item?.isUnread || !!item?.unread;
          return (
            <TouchableOpacity
              key={item.conversationId}
              activeOpacity={0.9}
              onPress={() =>
                router.push({
                  pathname: '/(app)/provider-chat',
                  params: {
                    conversationId: item.conversationId,
                    providerName: displayName,
                    providerId: item.provider?._id,
                  },
                })
              }
              style={[styles.row, { borderColor: theme.border, backgroundColor: theme.card }]}
            >
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
                  <Text style={{ color: theme.text, fontFamily: typography.fontFamilySemiBold }}>
                    {initials(displayName)}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={styles.topLine}>
                  <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                    {displayName}
                  </Text>
                  <Text style={[styles.time, { color: theme.subtleText }]}>
                    {timeAgo(item.latestMessageAt)}
                  </Text>
                </View>
                <Text style={[styles.preview, { color: theme.subtleText }]} numberOfLines={1}>
                  {item.latestMessage}
                </Text>
              </View>
              {hasUnread ? (
                <View style={[styles.unreadDot, { backgroundColor: theme.error }]} />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = {
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: spacing.sm,
    gap: spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  topLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  name: { fontFamily: typography.fontFamilySemiBold, fontSize: 14, flex: 1, paddingRight: spacing.sm },
  time: { fontSize: 12 },
  preview: { marginTop: spacing.xs, fontSize: 12 },
  unreadDot: { width: 8, height: 8, borderRadius: 999 },
};
