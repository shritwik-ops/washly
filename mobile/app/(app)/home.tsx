import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { formatCountdown } from '@washly/shared';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useHostelBookingData, type Machine } from '../../hooks/useHostelBookingData';
import { useNowTick } from '../../hooks/useNowTick';

const ID_STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  verified: 'Verified',
  rejected: 'Rejected',
};

const ID_STATUS_COLOR: Record<string, string> = {
  pending: '#b7791f',
  verified: '#2f855a',
  rejected: '#c0392b',
};

const MACHINE_STATUS_LABEL: Record<string, string> = {
  free: 'Free',
  in_use: 'In use',
  maintenance: 'Maintenance',
};

const MACHINE_STATUS_COLOR: Record<string, string> = {
  free: '#2f855a',
  in_use: '#b7791f',
  maintenance: '#999',
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

  async function handleStartWash() {
    if (!myBooking) return;
    setActionError(null);
    const { error } = await supabase.rpc('start_booking', { p_booking_id: myBooking.id });
    if (error) setActionError(error.message);
  }

  async function handleClaimFlash(flashSlotId: string) {
    setActionError(null);
    const { error } = await supabase.rpc('claim_flash_slot', { p_flash_slot_id: flashSlotId });
    if (error) setActionError(error.message);
  }

  function handleMachinePress(machine: Machine) {
    if (machine.status !== 'free') return;
    if (myBooking) {
      setActionError('You already have a booking -- finish or wait it out before booking another machine.');
      return;
    }
    setActionError(null);
    router.push({ pathname: '/(app)/book', params: { machineId: machine.id, machineLabel: machine.label } });
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
    >
      <Text style={styles.greeting}>{student.full_name ? `Hi, ${student.full_name}` : 'Welcome'}</Text>
      <Text style={styles.collegeInfo}>
        {student.college?.name}
        {student.hostel?.name ? ` · ${student.hostel.name}` : ''}
      </Text>

      {actionError ? <Text style={styles.error}>{actionError}</Text> : null}

      {!student.id_image_url ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Upload your college ID</Text>
          <Text style={styles.cardBody}>
            One last step -- we need a photo of your ID to verify you're a student here.
          </Text>
          <TouchableOpacity style={styles.button} onPress={() => router.push('/(onboarding)/id-upload')}>
            <Text style={styles.buttonText}>Upload ID</Text>
          </TouchableOpacity>
        </View>
      ) : student.id_verification_status === 'rejected' ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>ID verification</Text>
          <Text style={[styles.status, { color: ID_STATUS_COLOR.rejected }]}>
            {ID_STATUS_LABEL.rejected}
          </Text>
          {student.id_rejection_reason ? (
            <Text style={styles.cardBody}>Reason: {student.id_rejection_reason}</Text>
          ) : null}
          <TouchableOpacity style={styles.button} onPress={() => router.push('/(onboarding)/id-upload')}>
            <Text style={styles.buttonText}>Resubmit ID</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {flashSlots
        .filter((slot) => new Date(slot.expires_at).getTime() - now > 0)
        .map((slot) => (
          <TouchableOpacity
            key={slot.id}
            style={styles.flashCard}
            onPress={() => handleClaimFlash(slot.id)}
          >
            <Text style={styles.flashTitle}>⚡ {slot.machine?.label ?? 'A machine'} just opened up</Text>
            <Text style={styles.flashBody}>
              ₹{slot.price} · claim within {formatCountdown(new Date(slot.expires_at).getTime() - now)}
            </Text>
          </TouchableOpacity>
        ))}

      {myBooking ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{myBookingMachine?.label ?? 'Your machine'}</Text>
          {myBooking.status === 'active' ? (
            <>
              <Text style={styles.cardBody}>
                {startDeadlineMsLeft > 0
                  ? `Start within ${formatCountdown(startDeadlineMsLeft)} or your ₹${myBooking.booking_fee} booking fee is forfeited.`
                  : 'Start window closed -- this booking is about to be released.'}
              </Text>
              <TouchableOpacity
                style={[styles.button, startDeadlineMsLeft <= 0 && styles.buttonDisabled]}
                onPress={handleStartWash}
                disabled={startDeadlineMsLeft <= 0}
              >
                <Text style={styles.buttonText}>Start wash</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.cardBody}>
              Washing · ends in {formatCountdown(Math.max(0, washEndMsLeft))}.
            </Text>
          )}
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Machines at {student.hostel?.name ?? 'your hostel'}</Text>
      {loading && machines.length === 0 ? (
        <ActivityIndicator style={styles.spinner} />
      ) : machines.length === 0 ? (
        <Text style={styles.empty}>No machines installed here yet.</Text>
      ) : (
        machines.map((machine) => {
          const isBookable = machine.status === 'free';
          const busyMsLeft = machine.busy_until ? new Date(machine.busy_until).getTime() - now : null;
          return (
            <TouchableOpacity
              key={machine.id}
              style={[styles.machineRow, !isBookable && styles.machineRowDisabled]}
              onPress={() => handleMachinePress(machine)}
              disabled={!isBookable}
            >
              <Text style={styles.machineLabel}>{machine.label}</Text>
              <Text style={[styles.machineStatus, { color: MACHINE_STATUS_COLOR[machine.status] }]}>
                {MACHINE_STATUS_LABEL[machine.status] ?? machine.status}
                {machine.status === 'in_use' && busyMsLeft && busyMsLeft > 0
                  ? ` · ${formatCountdown(busyMsLeft)} left`
                  : ''}
              </Text>
            </TouchableOpacity>
          );
        })
      )}

      <TouchableOpacity style={styles.signOut} onPress={() => supabase.auth.signOut()}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
  },
  collegeInfo: {
    fontSize: 15,
    color: '#666',
    marginTop: 4,
    marginBottom: 24,
  },
  error: {
    color: '#c0392b',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#f7f7f8',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  cardBody: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  status: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  flashCard: {
    backgroundColor: '#fff8e1',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f0c14b',
  },
  flashTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  flashBody: {
    fontSize: 13,
    color: '#665200',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  spinner: {
    marginVertical: 12,
  },
  empty: {
    color: '#888',
    marginBottom: 20,
  },
  machineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 10,
    marginBottom: 10,
  },
  machineRowDisabled: {
    opacity: 0.6,
  },
  machineLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  machineStatus: {
    fontSize: 13,
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#1a73e8',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  signOut: {
    marginTop: 32,
    alignItems: 'center',
  },
  signOutText: {
    color: '#c0392b',
    fontSize: 14,
  },
});
