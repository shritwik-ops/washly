import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BOOKING_LEAD_OPTIONS_MINUTES } from '@washly/shared';
import { supabase } from '../../lib/supabase';

export default function Book() {
  const router = useRouter();
  const { machineId, machineLabel } = useLocalSearchParams<{ machineId: string; machineLabel: string }>();

  const [leadMinutes, setLeadMinutes] = useState<number>(BOOKING_LEAD_OPTIONS_MINUTES[0]);
  const [bookingFee, setBookingFee] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase
      .from('pricing_config')
      .select('value')
      .eq('key', 'booking_fee')
      .is('effective_to', null)
      .maybeSingle()
      .then(({ data }) => {
        if (mounted) setBookingFee(data?.value ?? null);
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function handleConfirm() {
    if (!machineId) return;
    setError(null);
    setSubmitting(true);
    const slotStart = new Date(Date.now() + leadMinutes * 60 * 1000);
    const { error: rpcError } = await supabase.rpc('create_booking', {
      p_machine_id: machineId,
      p_slot_start: slotStart.toISOString(),
    });
    setSubmitting(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    router.replace('/(app)/home');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Book {machineLabel ?? 'machine'}</Text>
      <Text style={styles.subtitle}>
        Reserve this machine now and it'll be held for you. You'll have 7 minutes from your slot
        start to tap "Start wash" -- miss it and the booking fee is forfeited.
      </Text>

      <Text style={styles.label}>Arrive in</Text>
      <View style={styles.leadRow}>
        {BOOKING_LEAD_OPTIONS_MINUTES.map((minutes) => (
          <TouchableOpacity
            key={minutes}
            style={[styles.leadOption, leadMinutes === minutes && styles.leadOptionSelected]}
            onPress={() => setLeadMinutes(minutes)}
          >
            <Text
              style={[styles.leadOptionText, leadMinutes === minutes && styles.leadOptionTextSelected]}
            >
              {minutes}m
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.feeCard}>
        <Text style={styles.feeLabel}>Booking fee</Text>
        <Text style={styles.feeValue}>
          {bookingFee === null ? '...' : `₹${bookingFee}`}
        </Text>
        <Text style={styles.feeNote}>Adjusted against your wash cost if you start on time.</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.button, submitting && styles.buttonDisabled]}
        onPress={handleConfirm}
        disabled={submitting}
      >
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Confirm booking</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancel} onPress={() => router.back()} disabled={submitting}>
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  leadRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  leadOption: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    alignItems: 'center',
  },
  leadOptionSelected: {
    backgroundColor: '#1a73e8',
    borderColor: '#1a73e8',
  },
  leadOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  leadOptionTextSelected: {
    color: '#fff',
  },
  feeCard: {
    backgroundColor: '#f7f7f8',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  feeLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  feeValue: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  feeNote: {
    fontSize: 13,
    color: '#888',
  },
  error: {
    color: '#c0392b',
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#1a73e8',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancel: {
    marginTop: 16,
    alignItems: 'center',
  },
  cancelText: {
    color: '#888',
    fontSize: 14,
  },
});
