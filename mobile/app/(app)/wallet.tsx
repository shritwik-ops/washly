import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { RECHARGE_PRESET_AMOUNTS, formatRupees, type GatewayMethod, type Database } from '@washly/shared';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Screen, Heading, Body, Label, ErrorText, Button, Card, TextField } from '../../components/ui';
import { colors, fonts, radii } from '../../constants/theme';

type Transaction = Database['public']['Tables']['wallet_transactions']['Row'];

const TYPE_LABELS: Record<string, string> = {
  recharge: 'Wallet recharge',
  booking_fee: 'Booking fee',
  flash_fee: 'Flash slot',
  wash_payment: 'Wash payment',
  forfeiture: 'Forfeited booking fee',
  refund: 'Refund',
  referral_reward: 'Referral reward',
};

export default function Wallet() {
  const router = useRouter();
  const { student } = useAuth();

  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [customAmount, setCustomAmount] = useState('');
  const [gatewayMethod, setGatewayMethod] = useState<GatewayMethod>('upi');
  const [recharging, setRecharging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [balanceRes, txRes] = await Promise.all([
      supabase.from('wallet_balances').select('balance').maybeSingle(),
      supabase
        .from('wallet_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50),
    ]);
    setBalance(balanceRes.data?.balance ?? 0);
    setTransactions(txRes.data ?? []);
  }, []);

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
    if (!student?.id) return;
    const channel = supabase
      .channel(`wallet-${student.id}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wallet_transactions', filter: `student_id=eq.${student.id}` },
        refresh
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [student?.id, refresh]);

  async function handleRecharge(amount: number) {
    if (amount <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    setError(null);
    setRecharging(true);
    const { error: rpcError } = await supabase.rpc('recharge_wallet', {
      p_amount: amount,
      p_payment_method: gatewayMethod,
    });
    setRecharging(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setCustomAmount('');
  }

  return (
    <Screen scroll>
      <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 20 }}>
        <Body style={{ color: colors.appBlue }}>← Back</Body>
      </TouchableOpacity>

      <Heading size="xl" style={{ marginBottom: 24 }}>
        Wallet
      </Heading>

      <Card tint="blue">
        <Label style={{ color: colors.appBlue, marginBottom: 6 }}>Balance</Label>
        <Text style={styles.balanceValue}>{balance === null ? '…' : formatRupees(balance)}</Text>
      </Card>

      <Label style={{ marginBottom: 10 }}>Recharge</Label>
      <View style={styles.presetRow}>
        {RECHARGE_PRESET_AMOUNTS.map((amount) => (
          <TouchableOpacity
            key={amount}
            style={styles.presetOption}
            onPress={() => handleRecharge(amount)}
            activeOpacity={0.85}
            disabled={recharging}
          >
            <Text style={styles.presetText}>₹{amount}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.customRow}>
        <TextField
          prefix="₹"
          placeholder="Custom amount"
          keyboardType="numeric"
          value={customAmount}
          onChangeText={setCustomAmount}
          containerStyle={{ flex: 1 }}
        />
      </View>

      <View style={styles.gatewayRow}>
        <TouchableOpacity
          style={[styles.gatewayOption, gatewayMethod === 'upi' && styles.gatewayOptionSelected]}
          onPress={() => setGatewayMethod('upi')}
          activeOpacity={0.85}
        >
          <Text style={[styles.gatewayText, gatewayMethod === 'upi' && styles.gatewayTextSelected]}>UPI</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.gatewayOption, gatewayMethod === 'card' && styles.gatewayOptionSelected]}
          onPress={() => setGatewayMethod('card')}
          activeOpacity={0.85}
        >
          <Text style={[styles.gatewayText, gatewayMethod === 'card' && styles.gatewayTextSelected]}>Card</Text>
        </TouchableOpacity>
      </View>

      {error ? <ErrorText style={{ marginBottom: 12 }}>{error}</ErrorText> : null}

      <Button
        label={`Add ₹${customAmount || '0'}`}
        onPress={() => handleRecharge(Number(customAmount))}
        loading={recharging}
        disabled={!customAmount}
        style={{ marginBottom: 28 }}
      />

      <Label style={{ marginBottom: 12 }}>Transaction history</Label>
      {loading ? (
        <ActivityIndicator color={colors.appBlue} style={{ marginVertical: 12 }} />
      ) : transactions.length === 0 ? (
        <Body muted>No transactions yet.</Body>
      ) : (
        transactions.map((tx) => (
          <View key={tx.id} style={styles.txRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.txLabel}>{TYPE_LABELS[tx.type] ?? tx.type}</Text>
              <Body muted style={styles.txDescription}>
                {tx.description ?? ''}
              </Body>
              <Body muted style={styles.txDate}>
                {new Date(tx.created_at).toLocaleString()}
              </Body>
            </View>
            <Text style={[styles.txAmount, Number(tx.amount) >= 0 ? styles.txAmountCredit : styles.txAmountDebit]}>
              {Number(tx.amount) >= 0 ? '+' : ''}
              {formatRupees(Number(tx.amount))}
            </Text>
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  balanceValue: {
    fontFamily: fonts.heading,
    fontSize: 36,
    color: colors.ink,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  presetOption: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  presetText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.ink,
  },
  customRow: {
    marginBottom: 12,
  },
  gatewayRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  gatewayOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  gatewayOptionSelected: {
    backgroundColor: colors.appBlue,
    borderColor: colors.appBlue,
  },
  gatewayText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.ink,
  },
  gatewayTextSelected: {
    color: colors.inkOnBlue,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  txLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.ink,
  },
  txDescription: {
    fontSize: 13,
    marginTop: 2,
  },
  txDate: {
    fontSize: 12,
    marginTop: 4,
  },
  txAmount: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    marginLeft: 12,
  },
  txAmountCredit: {
    color: colors.success,
  },
  txAmountDebit: {
    color: colors.ink,
  },
});
