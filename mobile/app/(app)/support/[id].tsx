import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Database } from '@washly/shared';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Screen, Heading, Body, Label, ErrorText, Button, Card, TextField, StatusPill, type PillTone } from '../../../components/ui';
import { colors, fonts, radii } from '../../../constants/theme';

type Ticket = Database['public']['Tables']['support_tickets']['Row'];
type Reply = Database['public']['Tables']['ticket_replies']['Row'];

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

const AUTHOR_LABEL: Record<string, string> = {
  student: 'You',
  college_admin: 'College admin',
  super_admin: 'Washly support',
};

export default function TicketDetail() {
  const router = useRouter();
  const { student } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [replyBody, setReplyBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!id) return;
    const [ticketRes, repliesRes] = await Promise.all([
      supabase.from('support_tickets').select('*').eq('id', id).maybeSingle(),
      supabase.from('ticket_replies').select('*').eq('ticket_id', id).order('created_at', { ascending: true }),
    ]);
    setTicket(ticketRes.data ?? null);
    setReplies(repliesRes.data ?? []);
    if (ticketRes.data?.photo_path) {
      const { data: signed } = await supabase.storage
        .from('ticket-photos')
        .createSignedUrl(ticketRes.data.photo_path, 3600);
      setPhotoUrl(signed?.signedUrl ?? null);
    }
  }, [id]);

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
    if (!id) return;
    const channel = supabase
      .channel(`ticket-${id}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets', filter: `id=eq.${id}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ticket_replies', filter: `ticket_id=eq.${id}` }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, refresh]);

  async function handleReply() {
    if (!id || !replyBody.trim() || submitting) return;
    setError(null);
    setSubmitting(true);
    const { error: rpcError } = await supabase.rpc('add_ticket_reply', {
      p_ticket_id: id,
      p_body: replyBody.trim(),
    });
    setSubmitting(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setReplyBody('');
  }

  if (loading || !ticket) {
    return (
      <Screen center>
        <ActivityIndicator color={colors.appBlue} />
      </Screen>
    );
  }

  const info = STATUS_INFO[ticket.status] ?? { label: ticket.status, tone: 'neutral' as PillTone };
  const canReply = ticket.status !== 'resolved';

  return (
    <Screen scroll>
      <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 20 }}>
        <Body style={{ color: colors.appBlue }}>← Back</Body>
      </TouchableOpacity>

      <View style={styles.headerRow}>
        <Heading size="lg">{CATEGORY_LABEL[ticket.category] ?? ticket.category}</Heading>
        <StatusPill label={info.label} tone={info.tone} />
      </View>

      <Card>
        <Body>{ticket.description}</Body>
        {photoUrl ? <Image source={{ uri: photoUrl }} style={styles.photo} /> : null}
        <Body muted style={{ marginTop: 12 }}>
          Raised {new Date(ticket.created_at).toLocaleString()}
        </Body>
      </Card>

      <Label style={{ marginBottom: 12 }}>Replies</Label>
      {replies.length === 0 ? (
        <Body muted style={{ marginBottom: 20 }}>
          No replies yet.
        </Body>
      ) : (
        replies.map((reply) => {
          const isMe = reply.author_type === 'student' && reply.author_id === student?.id;
          return (
            <View key={reply.id} style={[styles.replyBubble, isMe ? styles.replyBubbleSelf : styles.replyBubbleOther]}>
              <Text style={styles.replyAuthor}>{AUTHOR_LABEL[reply.author_type] ?? reply.author_type}</Text>
              <Body style={{ marginTop: 2 }}>{reply.body}</Body>
              <Body muted style={styles.replyDate}>
                {new Date(reply.created_at).toLocaleString()}
              </Body>
            </View>
          );
        })
      )}

      {canReply ? (
        <>
          <TextField
            value={replyBody}
            onChangeText={setReplyBody}
            placeholder="Add a reply..."
            multiline
            numberOfLines={3}
            style={{ minHeight: 72, textAlignVertical: 'top', paddingTop: 14 }}
            containerStyle={{ marginTop: 8, marginBottom: 12 }}
          />
          {error ? <ErrorText style={{ marginBottom: 12 }}>{error}</ErrorText> : null}
          <Button label="Send reply" onPress={handleReply} disabled={!replyBody.trim()} loading={submitting} />
        </>
      ) : (
        <Body muted style={{ marginTop: 8 }}>
          This ticket is resolved and no longer accepting replies.
        </Body>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  photo: {
    width: '100%',
    height: 180,
    borderRadius: radii.md,
    marginTop: 12,
    backgroundColor: colors.surfaceMuted,
  },
  replyBubble: {
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 10,
    maxWidth: '90%',
  },
  replyBubbleSelf: {
    backgroundColor: colors.appBlueTint,
    alignSelf: 'flex-end',
  },
  replyBubbleOther: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'flex-start',
  },
  replyAuthor: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.inkMuted,
  },
  replyDate: {
    fontSize: 11,
    marginTop: 6,
  },
});
