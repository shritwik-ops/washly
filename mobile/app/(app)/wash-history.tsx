import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatRupees, type Database } from '@washly/shared';
import { supabase } from '../../lib/supabase';
import { Screen, Heading, Body, Label, Card, StatusPill } from '../../components/ui';
import { colors, fonts, radii } from '../../constants/theme';

type Booking = Database['public']['Tables']['bookings']['Row'] & { machine: { label: string } | null };
type Transaction = Database['public']['Tables']['wallet_transactions']['Row'];
type Subscription = Database['public']['Tables']['subscriptions']['Row'];

const PAYMENT_SOURCE_LABEL: Record<string, string> = {
  wallet: 'Wallet',
  upi: 'UPI',
  card: 'Card',
  mixed: 'Wallet + UPI',
};

export default function WashHistory() {
  const router = useRouter();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [transactionsByBooking, setTransactionsByBooking] = useState<Record<string, Transaction[]>>({});
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [bookingsRes, subscriptionRes] = await Promise.all([
        supabase
          .from('bookings')
          .select('*, machine:machines(label)')
          .eq('status', 'completed')
          .order('slot_start', { ascending: false })
          .limit(50),
        supabase.from('subscriptions').select('*').eq('status', 'active').maybeSingle(),
      ]);
      if (!mounted) return;
      const bookingRows = (bookingsRes.data as unknown as Booking[]) ?? [];
      setBookings(bookingRows);
      setSubscription(subscriptionRes.data ?? null);

      const bookingIds = bookingRows.map((b) => b.id);
      if (bookingIds.length > 0) {
        const { data: txRows } = await supabase
          .from('wallet_transactions')
          .select('*')
          .in('booking_id', bookingIds)
          .in('type', ['booking_fee', 'flash_fee', 'wash_payment']);
        if (!mounted) return;
        const grouped: Record<string, Transaction[]> = {};
        for (const tx of txRows ?? []) {
          if (!tx.booking_id) continue;
          (grouped[tx.booking_id] ??= []).push(tx);
        }
        setTransactionsByBooking(grouped);
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const daysUntilRenewal = useMemo(() => {
    if (!subscription) return null;
    const ms = new Date(subscription.renews_at).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }, [subscription]);

  return (
    <Screen scroll insetTop={64}>
      <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 20 }}>
        <Body style={{ color: colors.appBlue, fontFamily: fonts.bodyMedium, fontSize: 15 }}>← Back</Body>
      </TouchableOpacity>

      <Heading size="xl" style={{ marginBottom: 24 }}>
        Wash history
      </Heading>

      {subscription ? (
        <Card tint="blue" style={{ marginBottom: 24 }}>
          <Label style={{ color: colors.appBlue, marginBottom: 6 }}>Subscription -- {subscription.tier}</Label>
          <Text style={styles.subscriptionValue}>
            {subscription.washes_used} of {subscription.wash_allowance} washes used this month
          </Text>
          <Body muted style={{ marginTop: 8 }}>
            Renews in {daysUntilRenewal} day{daysUntilRenewal === 1 ? '' : 's'}.
          </Body>
        </Card>
      ) : (
        <Card style={{ marginBottom: 24 }}>
          <Label style={{ marginBottom: 6 }}>Subscription</Label>
          <Body muted>No active subscription -- check back once subscription plans launch.</Body>
        </Card>
      )}

      <Label style={{ marginBottom: 12 }}>Past washes</Label>
      {loading ? (
        <ActivityIndicator color={colors.appBlue} style={{ marginVertical: 12 }} />
      ) : bookings.length === 0 ? (
        <Body muted>No completed washes yet.</Body>
      ) : (
        bookings.map((booking, i) => {
          const isLast = i === bookings.length - 1;
          const transactions = transactionsByBooking[booking.id] ?? [];
          // total_amount is the actual amount charged (wallet + gateway);
          // amount alone is only a wallet-balance delta and reads as ₹0 for
          // a pure UPI/card charge. Older rows predating that column fall
          // back to abs(amount), same limit noted in the migration.
          const cost = transactions.reduce(
            (sum, tx) => sum + Math.abs(Number(tx.total_amount ?? tx.amount)),
            0
          );
          const methods = Array.from(new Set(transactions.map((tx) => tx.payment_method).filter(Boolean)));
          const source =
            methods.length === 0
              ? '--'
              : methods.length > 1
                ? 'Wallet + UPI'
                : (PAYMENT_SOURCE_LABEL[methods[0]!] ?? methods[0]);
          return (
            <View key={booking.id} style={[styles.row, isLast && styles.rowLast]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{booking.machine?.label ?? 'Machine'}</Text>
                <Body muted style={styles.rowDate}>
                  {new Date(booking.slot_start).toLocaleString()}
                </Body>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 }}>
                  <StatusPill label={source} tone="neutral" />
                  {booking.booking_type === 'flash' ? <StatusPill label="Flash" tone="warning" /> : null}
                </View>
              </View>
              <Text style={styles.rowCost}>{formatRupees(cost)}</Text>
            </View>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  subscriptionValue: {
    fontFamily: fonts.heading,
    fontSize: 22,
    color: colors.ink,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.ink,
  },
  rowDate: {
    fontSize: 13,
    marginTop: 2,
  },
  rowCost: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.ink,
    marginLeft: 12,
  },
});
