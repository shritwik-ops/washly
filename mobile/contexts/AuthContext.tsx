import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Database } from '@washly/shared';
import { supabase } from '../lib/supabase';

type StudentRow = Database['public']['Tables']['students']['Row'];
type CollegeRow = Database['public']['Tables']['colleges']['Row'];
type HostelRow = Database['public']['Tables']['hostels']['Row'];

export type StudentProfile = StudentRow & {
  college: Pick<CollegeRow, 'id' | 'name' | 'city'> | null;
  hostel: Pick<HostelRow, 'id' | 'name'> | null;
};

interface AuthContextValue {
  session: Session | null;
  student: StudentProfile | null;
  loading: boolean;
  refreshStudent: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStudent = useCallback(async (userId: string) => {
    // maybeSingle(), not single(): a brand-new student has no row yet, and
    // that must resolve to null, not a thrown error.
    const { data, error } = await supabase
      .from('students')
      .select('*, college:colleges(id,name,city), hostel:hostels(id,name)')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Failed to fetch student profile', error);
      setStudent(null);
      return;
    }
    setStudent(data as StudentProfile | null);
  }, []);

  const refreshStudent = useCallback(async () => {
    if (session?.user.id) {
      await fetchStudent(session.user.id);
    }
  }, [session, fetchStudent]);

  useEffect(() => {
    let mounted = true;

    // onAuthStateChange fires immediately with the restored (or null)
    // session, so there's no need to also call getSession() separately.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      if (newSession?.user.id) {
        await fetchStudent(newSession.user.id);
      } else {
        setStudent(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchStudent]);

  return (
    <AuthContext.Provider value={{ session, student, loading, refreshStudent }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
