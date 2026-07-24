import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { resolvePaymentSelection } from '@washly/shared';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Screen, Heading, Body, Label, ErrorText, Button, Card, Checkbox } from '../../components/ui';
import { colors, fonts, radii } from '../../constants/theme';

// Story 1.11: exactly these 4 steps, one line each -- not a place to add
// extra safety copy without a product decision to do so.
const CHECKLIST_STEPS = [
  { icon: '🚪', title: 'Open the door' },
  { icon: '👕', title: 'Load your clothes' },
  { icon: '🧴', title: 'Add detergent' },
  { icon: '🔒', title: 'Close the door' },
] as const;

const CONFIRM_LABEL = 'Clothes & detergent loaded, door closed';

export default function Checklist() {
  const router = useRouter();
  const { student, refreshStudent } = useAuth();
  const { mode, machineId, bookingId, machineLabel } = useLocalSearchParams<{
    mode: 'instant' | 'booking';
    machineId?: string;
    bookingId?: string;
    machineLabel?: string;
  }>();

  const [threshold, setThreshold] = useState<number | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1.4's wallet-first routing (same rule as book.tsx's checkout moment) --
  // instant wash always owes the full wash_price up front, so this screen
  // is instant wash's checkout moment, not just the pre-wash gate.
  const [washPrice, setWashPrice] = useState<number | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [useWalletPartial, setUseWalletPartial] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase
      .from('pricing_config')
      .select('value')
      .eq('key', 'prewash_full_checklist_threshold')
      .is('effective_to', null)
      .maybeSingle()
      .then(({ data }) => {
        if (mounted) setThreshold(data?.value ?? null);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (mode !== 'instant') return;
    let mounted = true;
    Promise.all([
      supabase
        .from('pricing_config')
        .select('value')
        .eq('key', 'wash_price')
        .is('effective_to', null)
        .maybeSingle(),
      supabase.from('wallet_balances').select('balance').maybeSingle(),
    ]).then(([priceRes, balanceRes]) => {
      if (!mounted) return;
      setWashPrice(priceRes.data?.value ?? 30);
      setWalletBalance(balanceRes.data?.balance ?? 0);
    });
    return () => {
      mounted = false;
    };
  }, [mode]);

  const paymentSelection =
    mode === 'instant' && washPrice !== null
      ? resolvePaymentSelection(washPrice, walletBalance, 'upi', useWalletPartial)
      : null;
  const offersWalletChoice =
    mode === 'instant' && washPrice !== null && (walletBalance ?? 0) > 0 && (walletBalance ?? 0) < washPrice;

  async function handleStart() {
    if (mode === 'instant' && !machineId) return;
    if (mode === 'booking' && !bookingId) return;
    setError(null);
    setSubmitting(true);
    const { error: rpcError } =
      mode === 'instant'
        ? await supabase.rpc('start_instant_wash', {
            p_machine_id: machineId!,
            p_payment_method: paymentSelection!.method,
            p_wallet_portion: paymentSelection!.walletPortion ?? null,
          })
        : await supabase.rpc('start_booking', { p_booking_id: bookingId! });
    if (rpcError) {
      setSubmitting(false);
      setError(rpcError.message);
      return;
    }
    // The count this screen's own carousel/quick-confirm choice was based
    // on just changed server-side (the RPC above incremented it) -- refresh
    // so the next wash's checklist reads the up-to-date value from
    // AuthContext rather than a stale one cached from before this wash.
    await refreshStudent();
    setSubmitting(false);
    router.replace('/(app)/home');
  }

  if (threshold === null || (mode === 'instant' && (washPrice === null || walletBalance === null))) {
    return (
      <Screen center>
        <ActivityIndicator color={colors.appBlue} />
      </Screen>
    );
  }

  const showFullCarousel = (student?.prewash_checklist_count ?? 0) < threshold;

  return (
    <Screen>
      <Heading size="lg" style={{ marginBottom: 8 }}>
        Before you start
      </Heading>
      <Body muted style={{ marginBottom: 24 }}>
        {machineLabel ? `Quick check for ${machineLabel}.` : 'Quick check before washing.'}
      </Body>

      {showFullCarousel ? (
        <FullCarousel stepIndex={stepIndex} onChangeIndex={setStepIndex} />
      ) : (
        <QuickChecklistRow />
      )}

      {mode === 'instant' && washPrice !== null ? (
        <Card tint="blue" style={{ marginBottom: 24 }}>
          <Label style={{ color: colors.appBlue, marginBottom: 6 }}>Wash price</Label>
          <Text style={styles.slideTitle}>₹{washPrice}</Text>
          {offersWalletChoice ? (
            <View style={{ marginTop: 14 }}>
              <TouchableOpacity
                style={styles.paymentOption}
                onPress={() => setUseWalletPartial(true)}
                activeOpacity={0.85}
              >
                <Checkbox checked={useWalletPartial} />
                <Body style={{ marginLeft: 10, flex: 1 }}>
                  Use ₹{walletBalance} wallet + ₹{(washPrice - (walletBalance ?? 0)).toFixed(2)} via UPI
                </Body>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.paymentOption}
                onPress={() => setUseWalletPartial(false)}
                activeOpacity={0.85}
              >
                <Checkbox checked={!useWalletPartial} />
                <Body style={{ marginLeft: 10, flex: 1 }}>Pay full ₹{washPrice} via UPI</Body>
              </TouchableOpacity>
            </View>
          ) : (
            <Body muted style={{ marginTop: 8 }}>
              {(walletBalance ?? 0) >= washPrice ? 'Paid from your wallet balance.' : 'Paid via UPI.'}
            </Body>
          )}
        </Card>
      ) : null}

      <TouchableOpacity
        style={styles.checkboxRow}
        onPress={() => setConfirmed((c) => !c)}
        activeOpacity={0.8}
      >
        <Checkbox checked={confirmed} />
        <Body style={{ marginLeft: 12, flex: 1 }}>{CONFIRM_LABEL}</Body>
      </TouchableOpacity>

      {error ? <ErrorText style={{ marginBottom: 12 }}>{error}</ErrorText> : null}

      <Button label="Start wash" onPress={handleStart} disabled={!confirmed} loading={submitting} />
      <Button
        label="Cancel"
        variant="ghost"
        onPress={() => router.back()}
        disabled={submitting}
        style={{ marginTop: 4 }}
      />
    </Screen>
  );
}

// A8a: full illustrated carousel, one step per slide. Purely state-driven
// (renders the single current slide, no ScrollView scroll-position
// tracking) -- a horizontal paging ScrollView's scrollTo/
// onMomentumScrollEnd round-trip doesn't reliably sync on react-native-web,
// so Next/Back just move an index and re-render, which is trivially
// correct on every platform. Slides are browsable in any order/pace --
// the checkbox below is the one required gate, not "must view every
// slide".
function FullCarousel({
  stepIndex,
  onChangeIndex,
}: {
  stepIndex: number;
  onChangeIndex: (i: number) => void;
}) {
  const step = CHECKLIST_STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === CHECKLIST_STEPS.length - 1;

  return (
    <View style={{ marginBottom: 24 }}>
      <Card style={styles.slideCard}>
        <View style={styles.slideIconChip}>
          <Text style={styles.slideIconText}>{step.icon}</Text>
        </View>
        <Text style={styles.slideTitle}>{step.title}</Text>
      </Card>

      <View style={styles.dotsRow}>
        {CHECKLIST_STEPS.map((s, i) => (
          <View key={s.title} style={[styles.dot, i === stepIndex && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.carouselNavRow}>
        <Button
          label="Back"
          variant="ghost"
          onPress={() => onChangeIndex(stepIndex - 1)}
          disabled={isFirst}
          style={styles.carouselNavButton}
        />
        <Button
          label="Next"
          variant="secondary"
          onPress={() => onChangeIndex(stepIndex + 1)}
          disabled={isLast}
          style={styles.carouselNavButton}
        />
      </View>
    </View>
  );
}

// A8b: collapsed quick-confirm row -- a compact icon strip of all 4 steps
// in one card, no per-slide navigation.
function QuickChecklistRow() {
  return (
    <Card style={{ marginBottom: 24 }}>
      {CHECKLIST_STEPS.map((step, i) => (
        <View
          key={step.title}
          style={[styles.quickRow, i === CHECKLIST_STEPS.length - 1 && styles.quickRowLast]}
        >
          <Text style={styles.quickIcon}>{step.icon}</Text>
          <Body style={{ flex: 1 }}>{step.title}</Body>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  slideCard: {
    alignItems: 'center',
    paddingVertical: 40,
    marginBottom: 0,
  },
  slideIconChip: {
    width: 72,
    height: 72,
    borderRadius: radii.lg,
    backgroundColor: colors.appBlueTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  slideIconText: {
    fontSize: 32,
  },
  slideTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 18,
    color: colors.ink,
    textAlign: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.appBlue,
    width: 20,
  },
  carouselNavRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  carouselNavButton: {
    flex: 1,
  },
  quickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  quickRowLast: {
    marginBottom: 0,
  },
  quickIcon: {
    fontSize: 20,
    marginRight: 12,
    width: 28,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
});
