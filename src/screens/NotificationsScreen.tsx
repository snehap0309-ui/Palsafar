import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useState, useCallback, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { notificationService } from '../services/notificationService';
import { navigateFromInAppNotification } from '../services/notifications/notificationNavigation';
import type { InAppNotification } from '../services/api/notifications';
import { useHeaderSafePadding, useBottomSafePadding } from '../design/responsive';
const filters = ['All', 'Unread', 'Payments', 'Offers', 'System'] as const;

function matchesFilter(n: InAppNotification, filter: string) {
  if (filter === 'All') return true;
  if (filter === 'Unread') return !n.read;
  const t = `${n.type || ''} ${n.title || ''}`.toLowerCase();
  if (filter === 'Payments') return /pay|billing|subscription|invoice|refund|premium/.test(t);
  if (filter === 'Offers') return /offer|redeem|coupon|reward|points/.test(t);
  if (filter === 'System') return /system|admin|announce|legal|account|hidden.?gem|rejected|approved/.test(t);
  return true;
}

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export default function NotificationsScreen({ onBack }: { onBack?: () => void }) {
  const { theme } = useTheme();
  const headerPadTop = useHeaderSafePadding(12);
  const bottomPad = useBottomSafePadding(24);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [filter, setFilter] = useState<(typeof filters)[number]>('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const list = await notificationService.getNotifications(1, 50);
      setNotifications(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setError(e?.message || 'Could not load notifications');
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleMarkAllRead = useCallback(async () => {
    await notificationService.markAllAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const handleOpen = useCallback(async (n: InAppNotification) => {
    if (!n.read) {
      await notificationService.markAsRead(n.id);
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    }
    navigateFromInAppNotification(n);
  }, []);

  const filtered = notifications.filter((n) => matchesFilter(n, filter));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={theme.primary} />
      }
    >
      <View style={{ padding: 24, paddingTop: headerPadTop, paddingBottom: bottomPad, gap: 24 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {onBack && (
              <TouchableOpacity
                onPress={onBack}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: theme.glass,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: theme.text, fontSize: 20 }}>←</Text>
              </TouchableOpacity>
            )}
            <Text style={{ fontFamily: 'Inter-Bold', fontSize: 24, color: theme.text, letterSpacing: -0.5 }}>
              Notifications
            </Text>
          </View>
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={{ color: theme.primary, fontFamily: 'Inter-SemiBold', fontSize: 13 }}>Mark all read</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {filters.map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              style={{
                paddingHorizontal: 18,
                paddingVertical: 8,
                borderRadius: 24,
                backgroundColor: filter === f ? theme.primary : theme.glass,
                borderWidth: filter === f ? 0 : 1,
                borderColor: theme.border,
              }}
            >
              <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 13, color: filter === f ? '#fff' : theme.text }}>
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <ActivityIndicator color={theme.primary} />
          </View>
        ) : error ? (
          <View style={{ padding: 24, alignItems: 'center', gap: 12 }}>
            <Text style={{ color: theme.textMuted, textAlign: 'center' }}>{error}</Text>
            <TouchableOpacity
              onPress={() => load()}
              style={{ backgroundColor: theme.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 }}
            >
              <Text style={{ color: '#fff', fontFamily: 'Inter-SemiBold' }}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : filtered.length === 0 ? (
          <View style={{ padding: 32, alignItems: 'center' }}>
            <Text style={{ fontFamily: 'Inter-Bold', fontSize: 16, color: theme.text }}>No notifications</Text>
            <Text style={{ color: theme.textMuted, marginTop: 6, textAlign: 'center' }}>
              Payment, offer, and account updates will show up here.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {filtered.map((n) => (
              <TouchableOpacity
                key={n.id}
                onPress={() => handleOpen(n)}
                style={{
                  backgroundColor: theme.glass,
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: n.read ? theme.border : theme.primary,
                  opacity: n.read ? 0.85 : 1,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <Text style={{ fontFamily: 'Inter-Bold', fontSize: 15, color: theme.text, flex: 1 }}>
                    {n.title}
                  </Text>
                  <Text style={{ fontSize: 11, color: theme.textMuted }}>{timeAgo(n.createdAt)}</Text>
                </View>
                {n.body ? (
                  <Text style={{ marginTop: 6, fontSize: 13, color: theme.textMuted, lineHeight: 18 }}>
                    {n.body}
                  </Text>
                ) : null}
                {!n.read ? (
                  <Text style={{ marginTop: 8, fontSize: 11, color: theme.primary, fontFamily: 'Inter-SemiBold' }}>
                    Unread
                  </Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
