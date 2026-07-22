import { useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatCountdown } from '@washly/shared';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useHostelBookingData, type Machine } from '../../hooks/useHostelBookingData';
import { useNowTick } from '../../hooks/useNowTick';
import { Screen, Heading, Body, Label, ErrorText, Button, Card, StatusPill, type PillTone } from '../../components/ui';
import { colors, fonts, radii, spacing } from '../../constants/theme';

const ID_STATUS: Record<string, { label: string; tone: PillTone }> = {
  pending: { label: 'Pending', tone: 'warning' },
  verified: { label: 'Verified', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
};

const MACHINE_STATUS: Record<string, { label: string; tone: PillTone }> = {
  free: { label: 'Free', tone: 'success' },
  in_use: { label: 'In use', tone: 'warning' },
  maintenance: { label: 'Maintenance', tone: 'neutral' },
};

export default function Home() {
  const router = useRouter();
  const { student } = useAuth();
  const now = useNowTick();
  const { machines, myBooking, flashSlots, loading, refresh } = useHostelBookingData(
    student?.hostel_id,
    student?.id
  );

  const myBookingMachine = useMemo(
    () => machines.find((m) => m.id === myBooking?.machine_id) ?? null,
    [machines, myBooking]
  );

  const startDeadlineMsLeft = myBooking ? new Date(myBooking.start_deadline).getTime() - now : 0;
  const washEndMsLeft = myBooking ? new Date(myBooking.slot_end).getTime() - now : 0;

  const [actionError, setActionError] = useState<string | null>(null);

  if (!student) return null; // guarded by (app)/_layout.tsx

  function handleStartWash() {
    if (!myBooking) return;
    router.push({
      pathname: '/(app)/checklist',
      params: { mode: 'booking', bookingId: myBooking.id, machineLabel: myBookingMachine?.label },
    });
  }

  async function handleClaimFlash(flashSlotId: string) {
    setActionError(null);
    const { error } = await supabase.rpc('claim_flash_slot', { p_flash_slot_id: flashSlotId });
    if (error) setActionError(error.message);
  }

  // Shared guard for both free-machine actions: the "one booking at a
  // time" rule is enforced server-side too (create_booking/
  // start_instant_wash), this just gives the same friendly message before
  // even making the request.
  function ensureNoActiveBooking(): boolean {
    if (myBooking) {
      setActionError('You already have a booking -- finish or wait it out before starting another one.');
      return false;
    }
    setActionError(null);
    return true;
  }

  function handleBookSlot(machine: Machine) {
    if (machine.status !== 'free' || !ensureNoActiveBooking()) return;
    router.push({ pathname: '/(app)/book', params: { machineId: machine.id, machineLabel: machine.label } });
  }

  function handleWashNow(machine: Machine) {
    if (machine.status !== 'free' || !ensureNoActiveBooking()) return;
    router.push({
      pathname: '/(app)/checklist',
      params: { mode: 'instant', machineId: machine.id, machineLabel: machine.label },
    });
  }

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.appBlue} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>{student.full_name ? `Hi, ${student.full_name} 👋` : 'Welcome 👋'}</Text>
        <Text style={styles.collegeInfo}>
          {student.college?.name}
          {student.hostel?.name ? ` · ${student.hostel.name}` : ''}
        </Text>
      </View>

      {actionError ? <ErrorText style={{ marginBottom: 16 }}>{actionError}</ErrorText> : null}

      {!student.id_image_url ? (
        <Card tint="blue">
          <Text style={styles.cardTitle}>Upload your college ID</Text>
          <Body muted style={{ marginBottom: 16 }}>
            One last step -- we need a photo of your ID to verify you're a student here.
          </Body>
          <Button label="Upload ID" onPress={() => router.push('/(onboarding)/id-upload')} />
        </Card>
      ) : student.id_verification_status === 'rejected' ? (
        <Card>
          <Text style={styles.cardTitle}>ID verification</Text>
          <StatusPill label={ID_STATUS.rejected.label} tone={ID_STATUS.rejected.tone} />
          {student.id_rejection_reason ? (
            <Body muted style={{ marginTop: 12, marginBottom: 16 }}>
              Reason: {student.id_rejection_reason}
            </Body>
          ) : (
            <View style={{ marginBottom: 16 }} />
          )}
          <Button label="Resubmit ID" onPress={() => router.push('/(onboarding)/id-upload')} />
        </Card>
      ) : null}

      {flashSlots
        .filter((slot) => new Date(slot.expires_at).getTime() - now > 0)
        .map((slot) => (
          <TouchableOpacity key={slot.id} activeOpacity={0.85} onPress={() => handleClaimFlash(slot.id)}>
            <Card tint="lime" style={{ marginBottom: 16 }}>
              <Text style={styles.flashTitle}>⚡ {slot.machine?.label ?? 'A machine'} just opened up</Text>
              <Text style={styles.flashBody}>
                ₹{slot.price} · claim within {formatCountdown(new Date(slot.expires_at).getTime() - now)}
              </Text>
              <Text style={styles.flashCta}>Tap to claim →</Text>
            </Card>
          </TouchableOpacity>
        ))}

      {myBooking ? (
        <Card>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>{myBookingMachine?.label ?? 'Your machine'}</Text>
            <StatusPill
              label={myBooking.status === 'active' ? 'Reserved' : 'Washing'}
              tone={myBooking.status === 'active' ? 'warning' : 'success'}
            />
          </View>
          {myBooking.status === 'active' ? (
            <>
              <Body muted style={{ marginTop: 8, marginBottom: 16 }}>
                {startDeadlineMsLeft > 0
                  ? `Start within ${formatCountdown(startDeadlineMsLeft)} or your ₹${myBooking.booking_fee} booking fee is forfeited.`
                  : 'Start window closed -- this booking is about to be released.'}
              </Body>
              <Button
                label="Start wash"
                onPress={handleStartWash}
                disabled={startDeadlineMsLeft <= 0}
              />
            </>
          ) : (
            <Body muted style={{ marginTop: 8 }}>
              Washing · ends in {formatCountdown(Math.max(0, washEndMsLeft))}.
            </Body>
          )}
        </Card>
      ) : null}

      <Label style={styles.sectionLabel}>Machines at {student.hostel?.name ?? 'your hostel'}</Label>
      {loading && machines.length === 0 ? (
        <ActivityIndicator style={styles.spinner} color={colors.appBlue} />
      ) : machines.length === 0 ? (
        <Body muted style={{ marginBottom: 20 }}>
          No machines installed here yet.
        </Body>
      ) : (
        machines.map((machine) => {
          const isFree = machine.status === 'free';
          const busyMsLeft = machine.busy_until ? new Date(machine.busy_until).getTime() - now : null;
          const statusInfo = MACHINE_STATUS[machine.status] ?? { label: machine.status, tone: 'neutral' as PillTone };

          // A free machine offers two first-class actions inline -- slot
          // booking isn't the only path. Occupied/maintenance machines stay
          // a plain, non-interactive row exactly as before.
          if (!isFree) {
            return (
              <View key={machine.id} style={[styles.machineRow, styles.machineRowDisabled]}>
                <Text style={styles.machineLabel}>{machine.label}</Text>
                <View style={styles.machineStatusGroup}>
                  {machine.status === 'in_use' && busyMsLeft && busyMsLeft > 0 ? (
                    <Text style={styles.machineCountdown}>{formatCountdown(busyMsLeft)} left</Text>
                  ) : null}
                  <StatusPill label={statusInfo.label} tone={statusInfo.tone} />
                </View>
              </View>
            );
          }

          return (
            <View key={machine.id} style={styles.machineCardFree}>
              <View style={styles.rowBetween}>
                <Text style={styles.machineLabel}>{machine.label}</Text>
                <StatusPill label={statusInfo.label} tone={statusInfo.tone} />
              </View>
              <View style={styles.machineActionsRow}>
                <Button label="Wash now" onPress={() => handleWashNow(machine)} style={styles.machineActionButton} />
                <Button
                  label="Book a slot"
                  variant="secondary"
                  onPress={() => handleBookSlot(machine)}
                  style={styles.machineActionButton}
                />
              </View>
            </View>
          );
        })
      )}

      <Button label="Sign out" variant="dangerGhost" onPress={() => supabase.auth.signOut()} style={styles.signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 24,
  },
  greeting: {
    fontFamily: fonts.heading,
    fontSize: 26,
    color: colors.ink,
  },
  collegeInfo: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.inkMuted,
    marginTop: 4,
  },
  cardTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 17,
    color: colors.ink,
    marginBottom: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
  },
  flashTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 16,
    color: colors.inkOnLime,
    marginBottom: 4,
  },
  flashBody: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.inkOnLime,
    opacity: 0.8,
  },
  flashCta: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.appBlue,
    marginTop: 10,
  },
  sectionLabel: {
    marginBottom: 12,
  },
  spinner: {
    marginVertical: 12,
  },
  machineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    marginBottom: 10,
  },
  machineRowDisabled: {
    opacity: 0.65,
  },
  machineLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.ink,
  },
  machineStatusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  machineCountdown: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.inkMuted,
  },
  machineCardFree: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: 10,
  },
  machineActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  machineActionButton: {
    flex: 1,
  },
  signOut: {
    marginTop: 24,
  },
});
