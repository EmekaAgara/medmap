import { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useThemeMode } from '../../../_layout';
import ScreenHeader from '../../../components/ScreenHeader';
import { apiRequest } from '../../../../src/api/client';
import { ui, spacing } from '../../../../theme/tokens';
import { ShimmerBlock, ShimmerText } from '../../../components/Shimmer';

export default function NotificationsTab() {
  const { token } = useAuth();
  const { theme } = useThemeMode();
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiRequest('/notifications/mine?unreadOnly=false', {
        method: 'GET',
        token,
      });
      const data = res.data || {};
      setItems(data.items || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (e) {
      setError(e.message || 'Could not load notifications');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const markAllRead = async () => {
    try {
      await apiRequest('/notifications/mine/read-all', {
        method: 'POST',
        token,
      });
      await load();
    } catch (e) {
      setError(e.message || 'Could not mark read');
    }
  };

  const openNotification = async (n) => {
    const id = String(n?._id || '');
    if (id && !n.readAt) {
      try {
        await apiRequest(`/notifications/mine/${id}/read`, { method: 'POST', token });
      } catch {
        /* ignore */
      }
    }

    const d = n?.data || {};
    const t = d.type || n?.type;
    if (t === 'order' && d.orderId) {
      router.push({ pathname: '/(app)/orders/[id]', params: { id: String(d.orderId) } });
      return;
    }
    if (t === 'appointment' && d.appointmentId) {
      router.push({ pathname: '/(app)/appointments/[id]', params: { id: String(d.appointmentId) } });
      return;
    }
    if (t === 'message' && d.conversationId) {
      router.push({ pathname: '/(app)/provider-chat', params: { conversationId: String(d.conversationId) } });
      return;
    }
    if (t === 'wallet') {
      router.push('/(app)/wallet');
      return;
    }
  };

  return (
    <ScrollView style={ui.screen(theme)}>
      <ScreenHeader
        title="Notifications"
        showBack
        style={{ marginTop: spacing.lg }}
        right={
          <TouchableOpacity
            onPress={markAllRead}
            style={{ marginRight: spacing.lg }}
            hitSlop={10}
          >
            <Ionicons name="checkmark-done" size={20} color={theme.primary} />
          </TouchableOpacity>
        }
      />

      {loading ? (
        <View style={{ marginTop: spacing.sm, gap: spacing.sm, paddingHorizontal: spacing.sm }}>
          {Array.from({ length: 5 }).map((_, idx) => (
            <View key={`notif-shimmer-${idx}`} style={[styles.row, { borderColor: theme.border, backgroundColor: theme.card }]}>
              <ShimmerBlock theme={theme} style={{ height: 14, width: '45%', marginBottom: spacing.xs }} />
              <ShimmerText theme={theme} lines={2} />
            </View>
          ))}
        </View>
      ) : null}
      {error ? <Text style={ui.errorText(theme)}>{error}</Text> : null}

      {!loading && items.length === 0 ? (
        <Text style={[ui.caption(theme), { marginTop: spacing.md }]}>No notifications yet.</Text>
      ) : null}

      {!loading && unreadCount > 0 ? (
        <View style={[styles.unreadWrap, { paddingHorizontal: spacing.sm }]}>
          <View style={[styles.unreadDot, { backgroundColor: theme.error }]} />
          <Text style={ui.caption(theme)}>{unreadCount} unread</Text>
        </View>
      ) : null}

      {items.map((n) => {
        const isRead = !!n.readAt;
        const senderName = n?.data?.senderName;
        const titleText =
          n?.type === 'message' && senderName && !String(n.title || '').toLowerCase().includes(String(senderName).toLowerCase())
            ? `${n.title} · ${senderName}`
            : n.title;
        return (
          <TouchableOpacity
            key={String(n._id)}
            onPress={() => openNotification(n)}
            style={[
              styles.row,
              {
                borderColor: theme.border,
                backgroundColor: theme.card,
                marginHorizontal: spacing.sm,
              },
            ]}
          >
            <View style={styles.rowTop}>
              <View style={styles.rowBody}>
                <Text style={styles.title(theme)}>{titleText}</Text>
                <Text style={[ui.caption(theme), { marginTop: spacing.xs }]}>{n.body}</Text>
              </View>
              {!isRead ? (
                <View style={[styles.rowUnreadDot, { backgroundColor: theme.error }]} />
              ) : null}
            </View>
          </TouchableOpacity>
        );
      })}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = {
  unreadWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  unreadDot: { width: spacing.sm, height: spacing.sm, borderRadius: 999 },
  row: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: spacing.sm,
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  rowBody: { flex: 1 },
  rowUnreadDot: { width: 10, height: 10, borderRadius: 999, marginTop: 6 },
  title: (theme) => ({ color: theme.text, fontWeight: '700' }),
};

