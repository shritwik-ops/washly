import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BOOKING_LEAD_OPTIONS_MINUTES, resolvePaymentSelection } from '@washly/shared';
import { supabase } from '../../lib/supabase';
import { Screen, Heading, Body, Label, ErrorText, Button, Card, Checkbox } from '../../components/ui';
import { colors, fonts, radii } from '../../constants/theme';

export default function Book() {
  const router = useRouter();
  const { machineId, machineLabel } = useLocalSearchParams<{ machineId: string; machineLabel: string }>();

  const [leadMinutes, setLeadMinutes] = useState<number>(BOOKING_LEAD_OPTIONS_MINUTES[0]);
  const [bookingFee, setBookingFee] = useState<number | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [useWalletPartial, setUseWalletPartial] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      supabase
        .from('pricing_config')
        .select('value')
        .eq('key', 'booking_fee')
        .is('effective_to', null)
        .maybeSingle(),
      supabase.from('wallet_balances').select('balance').maybeSingle(),
    ]).then(([feeRes, balanceRes]) => {
      if (!mounted) return;
      setBookingFee(feeRes.data?.value ?? null);
      setWalletBalance(balanceRes.data?.balance ?? 0);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Same 1.4 checkout routing as checklist.tsx's instant-wash path, applied
  // here to the booking fee -- the amount actually due at this checkout
  // moment.
  const paymentSelection =
    bookingFee !== null ? resolvePaymentSelection(bookingFee, walletBalance, 'upi', useWalletPartial) : null;
  const offersWalletChoice =
    bookingFee !== null && (walletBalance ?? 0) > 0 && (walletBalance ?? 0) < bookingFee;

  async function handleConfirm() {
    if (!machineId || !paymentSelection) return;
    setError(null);
    setSubmitting(true);
    const slotStart = new Date(Date.now() + leadMinutes * 60 * 1000);
    const { error: rpcError } = await supabase.rpc('create_booking', {
      p_machine_id: machineId,
      p_slot_start: slotStart.toISOString(),
      p_payment_method: paymentSelection.method,
      p_wallet_portion: paymentSelection.walletPortion ?? undefined,
    });
    setSubmitting(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    router.replace('/(app)/home');
  }

  return (
    <Screen>
      <Heading size="xl" style={{ marginBottom: 8 }}>
        Book {machineLabel ?? 'machine'}
      </Heading>
      <Body muted style={{ marginBottom: 28 }}>
        Reserve this machine now and it'll be held for you. You'll have 7 minutes from your slot
        start to tap "Start wash" -- miss it and the booking fee is forfeited.
      </Body>

      <Label style={{ marginBottom: 10 }}>Arrive in</Label>
      <View style={styles.leadRow}>
        {BOOKING_LEAD_OPTIONS_MINUTES.map((minutes) => (
          <TouchableOpacity
            key={minutes}
            style={[styles.leadOption, leadMinutes === minutes && styles.leadOptionSelected]}
            onPress={() => setLeadMinutes(minutes)}
            activeOpacity={0.85}
          >
            <Text
              style={[styles.leadOptionText, leadMinutes === minutes && styles.leadOptionTextSelected]}
            >
              {minutes}m
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Card tint="blue" style={{ marginTop: 24 }}>
        <Label style={{ color: colors.appBlue, marginBottom: 6 }}>Booking fee</Label>
        <Text style={styles.feeValue}>{bookingFee === null ? '…' : `₹${bookingFee}`}</Text>
        <Body muted style={{ marginTop: 8 }}>
          Adjusted against your wash cost if you start on time.
        </Body>
        {bookingFee !== null ? (
          offersWalletChoice ? (
            <View style={{ marginTop: 14 }}>
              <TouchableOpacity
                style={styles.paymentOption}
                onPress={() => setUseWalletPartial(true)}
                activeOpacity={0.85}
              >
                <Checkbox checked={useWalletPartial} />
                <Body style={{ marginLeft: 10, flex: 1 }}>
                  Use ₹{walletBalance} wallet + ₹{(bookingFee - (walletBalance ?? 0)).toFixed(2)} via UPI
                </Body>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.paymentOption}
                onPress={() => setUseWalletPartial(false)}
                activeOpacity={0.85}
              >
                <Checkbox checked={!useWalletPartial} />
                <Body style={{ marginLeft: 10, flex: 1 }}>Pay full ₹{bookingFee} via UPI</Body>
              </TouchableOpacity>
            </View>
          ) : (
            <Body muted style={{ marginTop: 8 }}>
              {(walletBalance ?? 0) >= bookingFee ? 'Paid from your wallet balance.' : 'Paid via UPI.'}
            </Body>
          )
        ) : null}
      </Card>

      {error ? <ErrorText style={{ marginBottom: 12 }}>{error}</ErrorText> : null}

      <Button label="Confirm booking" onPress={handleConfirm} loading={submitting} disabled={!paymentSelection} />

      <Button
        label="Cancel"
        onPress={() => router.back()}
        variant="ghost"
        disabled={submitting}
        style={{ marginTop: 4 }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  leadRow: {
    flexDirection: 'row',
    gap: 10,
  },
  leadOption: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  leadOptionSelected: {
    backgroundColor: colors.appBlue,
    borderColor: colors.appBlue,
  },
  leadOptionText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.ink,
  },
  leadOptionTextSelected: {
    color: colors.inkOnBlue,
  },
  feeValue: {
    fontFamily: fonts.heading,
    fontSize: 32,
    color: colors.ink,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
});
