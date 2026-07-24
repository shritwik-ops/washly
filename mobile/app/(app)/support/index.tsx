import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Database } from '@washly/shared';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Screen, Heading, Body, Button, StatusPill, type PillTone } from '../../../components/ui';
import { colors, fonts } from '../../../constants/theme';

type Ticket = Database['public']['Tables']['support_tickets']['Row'];

const CATEGORY_LABEL: Record<string, string> = {
  payment_wallet: 'Payment / wallet issue',
  machine_malfunction: 'Machine malfunction',
  booking_flash: 'Booking / flash slot issue',
  id_verification: 'ID verification issue',
  other: 'Other',
};

const STATUS_INFO: Record<string, { label: string; tone: PillTone }> = {
  open: { label: 'Open', tone: 'warning' },
  in_progress: { label: 'In progress', tone: 'neutral' },
  resolved: { label: 'Resolved', tone: 'success' },
};

export default function SupportTickets() {
  const router = useRouter();
  const { student } = useAuth();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase.from('support_tickets').select('*').order('created_at', { ascending: false });
    setTickets(data ?? []);
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
      .channel(`support-tickets-${student.id}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_tickets', filter: `student_id=eq.${student.id}` },
        refresh
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [student?.id, refresh]);

  return (
    <Screen scroll>
      <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 20 }}>
        <Body style={{ color: colors.appBlue }}>← Back</Body>
      </TouchableOpacity>

      <Heading size="xl" style={{ marginBottom: 24 }}>
        Support
      </Heading>

      <Button
        label="New ticket"
        onPress={() => router.push('/(app)/support/new')}
        style={{ marginBottom: 24 }}
      />

      {loading ? (
        <ActivityIndicator color={colors.appBlue} style={{ marginVertical: 12 }} />
      ) : tickets.length === 0 ? (
        <Body muted>No tickets yet -- raise one if something's wrong.</Body>
      ) : (
        tickets.map((ticket) => {
          const info = STATUS_INFO[ticket.status] ?? { label: ticket.status, tone: 'neutral' as PillTone };
          return (
            <TouchableOpacity
              key={ticket.id}
              style={styles.row}
              activeOpacity={0.85}
              onPress={() => router.push({ pathname: '/(app)/support/[id]', params: { id: ticket.id } })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{CATEGORY_LABEL[ticket.category] ?? ticket.category}</Text>
                <Text style={styles.rowDate} numberOfLines={1}>
                  {ticket.description}
                </Text>
                <Body muted style={styles.rowDate}>
                  {new Date(ticket.created_at).toLocaleDateString()}
                </Body>
              </View>
              <StatusPill label={info.label} tone={info.tone} />
            </TouchableOpacity>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.ink,
  },
  rowDate: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.inkMuted,
    marginTop: 2,
  },
});
