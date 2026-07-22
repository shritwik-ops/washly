import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import type { Database } from './database.types';

export interface SupabaseClientConfig {
  url: string;
  anonKey: string;
}

export interface SupabaseClientOptions {
  // Storage-agnostic on purpose: mobile passes AsyncStorage, admin (later)
  // will pass its own web-appropriate adapter.
  storage?: SupportedStorage;
  persistSession?: boolean;
  autoRefreshToken?: boolean;
}

export function createSupabaseClient(
  config: SupabaseClientConfig,
  options: SupabaseClientOptions = {}
) {
  return createClient<Database>(config.url, config.anonKey, {
    auth: {
      storage: options.storage,
      persistSession: options.persistSession ?? true,
      autoRefreshToken: options.autoRefreshToken ?? true,
      detectSessionInUrl: false,
    },
  });
}
