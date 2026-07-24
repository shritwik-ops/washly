import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// Small, focused hook for the home-screen bell badge (1.6) -- the
// notifications screen itself does its own full fetch/realtime, this just
// needs the count.
export function useUnreadNotificationCount(studentId: string | undefined) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!studentId) return;
    const { count: unread } = await supabase
      .from('notifications_log')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .is('read_at', null);
    setCount(unread ?? 0);
  }, [studentId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!studentId) return;
    const channel = supabase
      .channel(`unread-notifications-${studentId}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications_log', filter: `student_id=eq.${studentId}` },
        refresh
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [studentId, refresh]);

  return count;
}
