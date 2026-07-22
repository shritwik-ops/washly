// TODO(admin): add "@washly/shared" to transpilePackages in admin/next.config.ts
// once the admin panel starts consuming this package.

export { createSupabaseClient } from './supabaseClient';
export type { SupabaseClientConfig, SupabaseClientOptions } from './supabaseClient';
export type { Database } from './database.types';
export {
  BOOKING_LEAD_OPTIONS_MINUTES,
  START_WINDOW_MINUTES,
  FLASH_WINDOW_MINUTES,
  formatCountdown,
} from './booking';
export type { MachineStatus, BookingStatus, FlashSlotStatus } from './booking';
