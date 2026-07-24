import { useEffect, useState } from 'react';
import { ActivityIndicator, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Database } from '@washly/shared';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Screen, Heading, Body, Label, Card, Button, StatusPill, type PillTone } from '../../components/ui';
import { colors, fonts, radii } from '../../constants/theme';

type Referral = Database['public']['Tables']['referrals']['Row'] & {
  referred: { full_name: string | null; phone: string } | null;
};

const STATUS_INFO: Record<string, { label: string; tone: PillTone }> = {
  joined: { label: 'Joined', tone: 'neutral' },
  completed_first_wash: { label: 'First wash done', tone: 'warning' },
  reward_credited: { label: 'Reward credited', tone: 'success' },
};

export default function ReferralScreen() {
  const router = useRouter();
  const { student } = useAuth();

  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase
      .from('referrals')
      .select('*, referred:students!referrals_referred_id_fkey(full_name, phone)')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!mounted) return;
        setReferrals((data as unknown as Referral[]) ?? []);
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const code = student?.referral_code ?? '';

  async function handleShare() {
    try {
      await Share.share({
        message: `Join Washly with my code ${code} and get laundry sorted from your phone.`,
      });
    } catch {
      // Share sheet unavailable (e.g. web) -- the code is already visible
      // on-screen to copy manually, so there's nothing further to do here.
    }
  }

  return (
    <Screen scroll>
      <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 20 }}>
        <Body style={{ color: colors.appBlue }}>← Back</Body>
      </TouchableOpacity>

      <Heading size="xl" style={{ marginBottom: 24 }}>
        Invite friends
      </Heading>

      <Card tint="lime">
        <Label style={{ marginBottom: 6 }}>Your referral code</Label>
        <Text style={styles.code}>{code || '...'}</Text>
        <Body muted style={{ marginTop: 10, marginBottom: 16 }}>
          Share your code -- when a friend signs up and completes their first paid wash, you both
          win.
        </Body>
        <Button label="Share code" onPress={handleShare} disabled={!code} />
      </Card>

      <Label style={{ marginTop: 8, marginBottom: 12 }}>Your referrals</Label>
      {loading ? (
        <ActivityIndicator color={colors.appBlue} style={{ marginVertical: 12 }} />
      ) : referrals.length === 0 ? (
        <Body muted>Nobody's joined with your code yet.</Body>
      ) : (
        referrals.map((referral) => {
          const info = STATUS_INFO[referral.status] ?? { label: referral.status, tone: 'neutral' as PillTone };
          return (
            <View key={referral.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{referral.referred?.full_name || referral.referred?.phone}</Text>
                <Body muted style={styles.rowDate}>
                  Joined {new Date(referral.created_at).toLocaleDateString()}
                </Body>
              </View>
              <StatusPill label={info.label} tone={info.tone} />
            </View>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  code: {
    fontFamily: fonts.heading,
    fontSize: 32,
    letterSpacing: 2,
    color: colors.inkOnLime,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.ink,
  },
  rowDate: {
    fontSize: 13,
    marginTop: 2,
  },
});
