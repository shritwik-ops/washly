// Booking-lifecycle constants and pure display helpers for story 1.3.
// The authoritative timing rules live in the create_booking/claim_flash_slot
// Postgres functions (supabase/migrations/20260722091000_booking_lifecycle.sql)
// -- these mirror them for client-side display and picker options only, so
// /mobile and /admin never hardcode the same numbers twice.

// How far ahead a student can book a slot (1.3): the picker only offers
// these four options; the server enforces the 15-30 range with a minute of
// tolerance on top.
export const BOOKING_LEAD_OPTIONS_MINUTES = [15, 20, 25, 30] as const;

// Minutes from slot_start before an unstarted booking is forfeited.
export const START_WINDOW_MINUTES = 7;

// Minutes a flash slot stays claimable before reverting to normal booking.
export const FLASH_WINDOW_MINUTES = 2;

export type MachineStatus = 'free' | 'in_use' | 'maintenance';
export type BookingStatus = 'active' | 'started' | 'completed' | 'expired';
export type FlashSlotStatus = 'open' | 'claimed' | 'reverted';

// "3m 45s" / "0m 12s" style countdown text, for the start-window and
// flash-window timers. Never negative -- callers should stop rendering
// (and refresh state) once this would go to zero.
export function formatCountdown(msRemaining: number): string {
  const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}
