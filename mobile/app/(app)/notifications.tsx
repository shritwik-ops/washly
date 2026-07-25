import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Database } from '@washly/shared';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Screen, Heading, Body, Label, Button } from '../../components/ui';
import { colors, fonts, radii } from '../../constants/theme';

type Notification = Database['public']['Tables']['notifications_log']['Row'];

const TYPE_ICON: Record<string, string> = {
  wash_complete: '✅',
  flash_slot: '⚡',
  support_reply: '💬',
};

export default function Notifications() {
  const router = useRouter();
  const { student, refreshStudent } = useAuth();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from('notifications_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setNotifications(data ?? []);
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    refresh().then(() => {
      if (mounted) setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [refresh]);

  useEffect(() => {
    if (!student?.id) return;
    const channel = supabase
      .channel(`notifications-${student.id}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications_log', filter: `student_id=eq.${student.id}` },
        refresh
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [student?.id, refresh]);

  async function markRead(notification: Notification) {
    if (notification.read_at) return;
    await supabase.from('notifications_log').update({ read_at: new Date().toISOString() }).eq('id', notification.id);
  }

  async function toggleFlashPreference() {
    if (!student) return;
    await supabase
      .from('students')
      .update({ notify_flash_slots: !student.notify_flash_slots })
      .eq('id', student.id);
    await refreshStudent();
  }

  return (
    <Screen scroll insetTop={64}>
      <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 20 }}>
        <Body style={{ color: colors.appBlue, fontFamily: fonts.bodyMedium, fontSize: 15 }}>← Back</Body>
      </TouchableOpacity>

      <Heading size="xl" style={{ marginBottom: 24 }}>
        Notifications
      </Heading>

      <TouchableOpacity style={styles.prefRow} onPress={toggleFlashPreference} activeOpacity={0.85}>
        <View style={{ flex: 1 }}>
          <Text style={styles.prefTitle}>Flash slot alerts</Text>
          <Body muted style={styles.prefBody}>
            Get notified when a machine near you opens up at a premium price.
          </Body>
        </View>
        <View style={[styles.toggle, student?.notify_flash_slots && styles.toggleOn]}>
          <View style={[styles.toggleKnob, student?.notify_flash_slots && styles.toggleKnobOn]} />
        </View>
      </TouchableOpacity>

      <Label style={{ marginTop: 24, marginBottom: 12 }}>Recent</Label>
      {loading ? (
        <ActivityIndicator color={colors.appBlue} style={{ marginVertical: 12 }} />
      ) : notifications.length === 0 ? (
        <Body muted>Nothing yet -- wash, flash slot, and ticket updates will show up here.</Body>
      ) : (
        notifications.map((n, i) => (
          <TouchableOpacity
            key={n.id}
            style={[
              styles.notifRow,
              !n.read_at && styles.notifRowUnread,
              n.read_at && i === notifications.length - 1 && styles.notifRowLast,
            ]}
            onPress={() => markRead(n)}
            activeOpacity={0.85}
          >
            <Text style={styles.notifIcon}>{TYPE_ICON[n.type] ?? '🔔'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.notifTitle}>{n.title}</Text>
              <Body muted style={styles.notifBody}>
                {n.body}
              </Body>
              <Body muted style={styles.notifDate}>
                {new Date(n.created_at).toLocaleString()}
              </Body>
            </View>
            {!n.read_at ? <View style={styles.unreadDot} /> : null}
          </TouchableOpacity>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 16,
  },
  prefTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.ink,
    marginBottom: 4,
  },
  prefBody: {
    fontSize: 13,
  },
  toggle: {
    width: 46,
    height: 28,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
    padding: 3,
    marginLeft: 12,
  },
  toggleOn: {
    backgroundColor: colors.appBlue,
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.surface,
  },
  toggleKnobOn: {
    marginLeft: 18,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  notifRowLast: {
    borderBottomWidth: 0,
  },
  notifRowUnread: {
    backgroundColor: colors.appBlueTint,
    marginHorizontal: -16,
    paddingHorizontal: 16,
    borderRadius: radii.md,
    borderBottomWidth: 0,
    marginBottom: 2,
  },
  notifIcon: {
    fontSize: 20,
    marginRight: 12,
    marginTop: 2,
  },
  notifTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.ink,
  },
  notifBody: {
    fontSize: 13,
    marginTop: 2,
  },
  notifDate: {
    fontSize: 12,
    marginTop: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.appBlue,
    marginLeft: 8,
    marginTop: 6,
  },
});
