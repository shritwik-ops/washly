import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import type { Database } from '@washly/shared';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Screen, Heading, Body, Label, ErrorText, Button, TextField } from '../../components/ui';
import { colors, fonts, radii, spacing } from '../../constants/theme';

type College = Database['public']['Tables']['colleges']['Row'];
type Hostel = Database['public']['Tables']['hostels']['Row'];

export default function CollegePicker() {
  const router = useRouter();
  const { session, student, refreshStudent } = useAuth();

  const [fullName, setFullName] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [colleges, setColleges] = useState<College[]>([]);
  const [collegesLoading, setCollegesLoading] = useState(true);
  const [collegeFilter, setCollegeFilter] = useState('');
  const [selectedCollege, setSelectedCollege] = useState<College | null>(null);

  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [hostelsLoading, setHostelsLoading] = useState(false);
  const [hostelFilter, setHostelFilter] = useState('');
  const [selectedHostel, setSelectedHostel] = useState<Hostel | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase
      .from('colleges')
      .select('*')
      .eq('is_active', true)
      .order('name')
      .then(({ data, error: fetchError }) => {
        if (!mounted) return;
        if (fetchError) setError(fetchError.message);
        setColleges(data ?? []);
        setCollegesLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedCollege) {
      setHostels([]);
      setSelectedHostel(null);
      return;
    }
    let mounted = true;
    setHostelsLoading(true);
    setSelectedHostel(null);
    supabase
      .from('hostels')
      .select('*')
      .eq('college_id', selectedCollege.id)
      .order('name')
      .then(({ data, error: fetchError }) => {
        if (!mounted) return;
        if (fetchError) setError(fetchError.message);
        setHostels(data ?? []);
        setHostelsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [selectedCollege]);

  const filteredColleges = useMemo(
    () =>
      colleges.filter((c) => c.name.toLowerCase().includes(collegeFilter.trim().toLowerCase())),
    [colleges, collegeFilter]
  );

  const filteredHostels = useMemo(
    () => hostels.filter((h) => h.name.toLowerCase().includes(hostelFilter.trim().toLowerCase())),
    [hostels, hostelFilter]
  );

  const canSubmit = !!selectedCollege && !!selectedHostel && !submitting;

  async function handleContinue() {
    if (!canSubmit || !session || !selectedCollege || !selectedHostel) return;
    setError(null);
    setSubmitting(true);

    // 1.8: resolved server-side, not looked up directly -- students'
    // select policy only exposes a student's own row, so there's no way
    // for the client to find another student's id by code except through
    // this narrow RPC. An unrecognized code is a soft "not found" (null),
    // not an exception, so a typo doesn't block signup.
    let referredBy: string | null = null;
    const trimmedCode = referralCode.trim();
    if (trimmedCode) {
      const { data: resolvedId, error: resolveError } = await supabase.rpc('resolve_referral_code', {
        p_code: trimmedCode,
      });
      if (resolveError) {
        setSubmitting(false);
        setError(resolveError.message);
        return;
      }
      if (!resolvedId) {
        setSubmitting(false);
        setError('Referral code not found -- check it and try again, or leave it blank.');
        return;
      }
      referredBy = resolvedId;
    }

    const { error: insertError } = await supabase.from('students').insert({
      id: session.user.id,
      phone: session.user.phone!,
      full_name: fullName.trim() || null,
      college_id: selectedCollege.id,
      hostel_id: selectedHostel.id,
      referred_by: referredBy,
    });
    setSubmitting(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    await refreshStudent();
    router.replace('/(onboarding)/id-upload');
  }

  // Already onboarded -- re-picking college/hostel isn't revisitable. Home
  // screen handles prompting for ID upload if that part is still missing.
  if (student) {
    return <Redirect href="/(app)/home" />;
  }

  return (
    <Screen>
      <Heading size="xl" style={{ marginBottom: 24 }}>
        Tell us about yourself
      </Heading>

      <TextField
        value={fullName}
        onChangeText={setFullName}
        placeholder="Full name (optional)"
        containerStyle={{ marginBottom: 8 }}
      />

      <TextField
        value={referralCode}
        onChangeText={(text) => setReferralCode(text.toUpperCase())}
        placeholder="Referral code (optional)"
        autoCapitalize="characters"
        containerStyle={{ marginBottom: 8 }}
      />

      <Label style={styles.sectionLabel}>College</Label>
      <TextField
        value={collegeFilter}
        onChangeText={setCollegeFilter}
        placeholder="Search for your college"
        containerStyle={{ marginBottom: 10 }}
      />
      {collegesLoading ? (
        <ActivityIndicator style={styles.spinner} color={colors.appBlue} />
      ) : (
        <View style={styles.listCard}>
          <FlatList
            style={styles.list}
            data={filteredColleges}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.row, selectedCollege?.id === item.id && styles.rowSelected]}
                onPress={() => setSelectedCollege(item)}
              >
                <Text
                  style={[styles.rowTitle, selectedCollege?.id === item.id && styles.rowTitleSelected]}
                >
                  {item.name}
                </Text>
                {item.city ? <Text style={styles.rowSubtitle}>{item.city}</Text> : null}
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.empty}>No colleges match your search.</Text>}
          />
        </View>
      )}

      <Button
        label="My college isn't listed"
        variant="ghost"
        onPress={() => router.push('/(onboarding)/college-not-listed')}
        style={styles.linkButton}
      />

      {selectedCollege ? (
        <>
          <Label style={[styles.sectionLabel, { marginTop: 20 }]}>Hostel</Label>
          <TextField
            value={hostelFilter}
            onChangeText={setHostelFilter}
            placeholder="Search for your hostel"
            containerStyle={{ marginBottom: 10 }}
          />
          {hostelsLoading ? (
            <ActivityIndicator style={styles.spinner} color={colors.appBlue} />
          ) : (
            <View style={styles.listCard}>
              <FlatList
                style={styles.list}
                data={filteredHostels}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.row, selectedHostel?.id === item.id && styles.rowSelected]}
                    onPress={() => setSelectedHostel(item)}
                  >
                    <Text
                      style={[styles.rowTitle, selectedHostel?.id === item.id && styles.rowTitleSelected]}
                    >
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={styles.empty}>No hostels match your search.</Text>}
              />
            </View>
          )}
        </>
      ) : null}

      {error ? <ErrorText style={{ marginTop: 4, marginBottom: 4 }}>{error}</ErrorText> : null}

      <Button
        label="Continue"
        onPress={handleContinue}
        disabled={!canSubmit}
        loading={submitting}
        style={{ marginTop: 24 }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    marginTop: 12,
    marginBottom: 10,
  },
  spinner: {
    marginVertical: 12,
  },
  listCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  list: {
    maxHeight: 168,
  },
  row: {
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowSelected: {
    backgroundColor: colors.appBlueTint,
  },
  rowTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.ink,
  },
  rowTitleSelected: {
    color: colors.appBlue,
    fontFamily: fonts.bodySemiBold,
  },
  rowSubtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.inkMuted,
    marginTop: 2,
  },
  empty: {
    fontFamily: fonts.body,
    padding: spacing.lg,
    color: colors.inkMuted,
  },
  linkButton: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    marginTop: 4,
  },
});
