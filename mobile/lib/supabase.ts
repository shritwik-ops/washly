import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSupabaseClient } from '@washly/shared';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY -- copy mobile/.env.example to mobile/.env.local and fill them in.'
  );
}

export const supabase = createSupabaseClient({ url, anonKey }, { storage: AsyncStorage });
