// Wallet + smart payment routing (story 1.4). Pure constants/logic only --
// the authoritative charge happens in charge_wallet_and_gateway() and the
// RPCs that call it (supabase/migrations/*_wallet_payment_routing.sql);
// this mirrors the same decision for client-side display so /mobile and
// /admin never re-derive it differently.

export const RECHARGE_PRESET_AMOUNTS = [100, 200, 500] as const;

export type GatewayMethod = 'upi' | 'card';
export type PaymentMethod = 'wallet' | GatewayMethod | 'mixed';
export type WalletTransactionType =
  | 'recharge'
  | 'booking_fee'
  | 'flash_fee'
  | 'wash_payment'
  | 'forfeiture'
  | 'refund';

export interface PaymentSelection {
  method: PaymentMethod;
  walletPortion?: number;
}

// 1.4's three checkout cases, given the student's current balance and the
// amount due:
//   balance >= amountDue -> pay entirely from wallet, no gateway prompt
//   0 < balance < amountDue -> a CHOICE: apply the full current balance
//     (never a partial-of-partial amount -- that's what "mixed" means here)
//     plus the remainder via the student's chosen gateway, or skip the
//     wallet and pay the full amount via gateway instead
//   balance <= 0 -> standard gateway flow, no wallet mention at all
//
// `useWalletPartial` is the student's choice in the middle case (ignored
// otherwise); `gatewayMethod` is which gateway they'd use for any
// non-wallet portion. amountDue <= 0 means nothing is actually owed (e.g.
// a booking's fee already covers the full wash price) -- resolves to
// 'wallet' as a harmless no-op, since callers skip charging entirely below
// that threshold.
export function resolvePaymentSelection(
  amountDue: number,
  walletBalance: number | null,
  gatewayMethod: GatewayMethod,
  useWalletPartial: boolean
): PaymentSelection {
  const balance = walletBalance ?? 0;
  if (amountDue <= 0 || balance >= amountDue) {
    return { method: 'wallet' };
  }
  if (balance > 0 && useWalletPartial) {
    return { method: 'mixed', walletPortion: balance };
  }
  return { method: gatewayMethod };
}

export function formatRupees(amount: number): string {
  return `₹${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
}
