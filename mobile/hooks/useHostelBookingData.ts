import { useCallback, useEffect, useState } from 'react';
import type { Database } from '@washly/shared';
import { supabase } from '../lib/supabase';

export type Machine = Database['public']['Tables']['machines']['Row'];
export type Booking = Database['public']['Tables']['bookings']['Row'];
export type FlashSlot = Database['public']['Tables']['flash_slots']['Row'] & {
  machine: { label: string } | null;
};

// Live data for the home screen (1.2/1.3): every machine at the student's
// hostel, their own in-flight booking (if any), and any open flash slots.
// One realtime channel covers all three so a forfeiture/flash-release
// elsewhere shows up here with no manual refresh.
export function useHostelBookingData(hostelId: string | undefined, studentId: string | undefined) {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [myBooking, setMyBooking] = useState<Booking | null>(null);
  const [flashSlots, setFlashSlots] = useState<FlashSlot[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMachines = useCallback(async () => {
    if (!hostelId) return;
    const { data } = await supabase.from('machines').select('*').eq('hostel_id', hostelId).order('label');
    setMachines(data ?? []);
  }, [hostelId]);

  const fetchMyBooking = useCallback(async () => {
    if (!studentId) return;
    const { data } = await supabase
      .from('bookings')
      .select('*')
      .eq('student_id', studentId)
      .in('status', ['active', 'started'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setMyBooking(data ?? null);
  }, [studentId]);

  const fetchFlashSlots = useCallback(async () => {
    if (!hostelId) return;
    const { data } = await supabase
      .from('flash_slots')
      .select('*, machine:machines!inner(label, hostel_id)')
      .eq('status', 'open')
      .eq('machine.hostel_id', hostelId)
      .gt('expires_at', new Date().toISOString());
    setFlashSlots((data as unknown as FlashSlot[]) ?? []);
  }, [hostelId]);

  const refresh = useCallback(async () => {
    await Promise.all([fetchMachines(), fetchMyBooking(), fetchFlashSlots()]);
  }, [fetchMachines, fetchMyBooking, fetchFlashSlots]);

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
    if (!hostelId || !studentId) return;

    // supabase-js's client.channel(topic) reuses an existing channel object
    // if one with the same topic is still in its internal list -- and a
    // fixed, hostel-scoped topic name collides with the previous mount's
    // channel if this effect's cleanup (removeChannel, async) hasn't
    // finished by the time a remount re-runs it (React's dev-mode double
    // effect invoke, Fast Refresh). Adding .on() to that already-subscribed
    // survivor throws "cannot add postgres_changes callbacks ... after
    // subscribe()". A random suffix per mount guarantees no collision.
    const channel = supabase
      .channel(`hostel-${hostelId}-booking-data-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'machines', filter: `hostel_id=eq.${hostelId}` },
        fetchMachines
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings', filter: `student_id=eq.${studentId}` },
        fetchMyBooking
      )
      // flash_slots has no hostel_id column to filter server-side -- it's
      // a small, low-frequency table, so refetching (itself scoped to this
      // hostel) on any change is simple and cheap.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'flash_slots' }, fetchFlashSlots)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [hostelId, studentId, fetchMachines, fetchMyBooking, fetchFlashSlots]);

  return { machines, myBooking, flashSlots, loading, refresh };
}
