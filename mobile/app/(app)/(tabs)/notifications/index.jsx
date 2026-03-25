import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useThemeMode } from '../../../_layout';
import ScreenHeader from '../../../components/ScreenHeader';
import { apiRequest } from '../../../../src/api/client';
import { ui, spacing } from '../../../../theme/tokens';

export default function NotificationsTab() {
  const { token, user } = useAuth();
  const { theme } = useThemeMode();
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

  const markOneRead = async (id) => {
    try {
      await apiRequest(`/notifications/mine/${id}/read`, {
        method: 'POST',
        token,
      });
      await load();
    } catch (e) {
      setError(e.message || 'Could not update notification');
    }
  };

  return (
    <ScrollView style={ui.screen(theme)}>
      <ScreenHeader
        title="Notifications"
        showBack={false}
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

      {loading ? <ActivityIndicator color={theme.primary} style={{ marginTop: spacing.md }} /> : null}
      {error ? <Text style={ui.errorText(theme)}>{error}</Text> : null}

      {!loading && items.length === 0 ? (
        <Text style={[ui.caption(theme), { marginTop: spacing.md }]}>No notifications yet.</Text>
      ) : null}

      {!loading && unreadCount > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
          <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: theme.primary }} />
          <Text style={ui.caption(theme)}>{unreadCount} unread</Text>
        </View>
      ) : null}

      {items.map((n) => {
        const isRead = !!n.readAt;
        return (
          <TouchableOpacity
            key={String(n._id)}
            onPress={() => (!isRead ? markOneRead(String(n._id)) : null)}
            style={[
              {
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.lg,
                borderBottomWidth: 1,
                borderBottomColor: theme.border,
                backgroundColor: isRead ? 'transparent' : theme.primary + '10',
              },
            ]}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontWeight: '700' }}>{n.title}</Text>
                <Text style={[ui.caption(theme), { marginTop: 4 }]}>{n.body}</Text>
              </View>
              {!isRead ? (
                <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: theme.primary, marginTop: 6 }} />
              ) : null}
            </View>
          </TouchableOpacity>
        );
      })}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

