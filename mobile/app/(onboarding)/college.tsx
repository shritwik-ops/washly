import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import type { Database } from '@washly/shared';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type College = Database['public']['Tables']['colleges']['Row'];
type Hostel = Database['public']['Tables']['hostels']['Row'];

export default function CollegePicker() {
  const router = useRouter();
  const { session, student, refreshStudent } = useAuth();

  const [fullName, setFullName] = useState('');
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
    const { error: insertError } = await supabase.from('students').insert({
      id: session.user.id,
      phone: session.user.phone!,
      full_name: fullName.trim() || null,
      college_id: selectedCollege.id,
      hostel_id: selectedHostel.id,
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
    <View style={styles.container}>
      <Text style={styles.title}>Tell us about yourself</Text>

      <TextInput
        style={styles.textInput}
        value={fullName}
        onChangeText={setFullName}
        placeholder="Full name (optional)"
      />

      <Text style={styles.label}>College</Text>
      <TextInput
        style={styles.textInput}
        value={collegeFilter}
        onChangeText={setCollegeFilter}
        placeholder="Search for your college"
      />
      {collegesLoading ? (
        <ActivityIndicator style={styles.spinner} />
      ) : (
        <FlatList
          style={styles.list}
          data={filteredColleges}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.row, selectedCollege?.id === item.id && styles.rowSelected]}
              onPress={() => setSelectedCollege(item)}
            >
              <Text style={styles.rowTitle}>{item.name}</Text>
              {item.city ? <Text style={styles.rowSubtitle}>{item.city}</Text> : null}
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No colleges match your search.</Text>}
        />
      )}

      <TouchableOpacity
        style={styles.linkRow}
        onPress={() => router.push('/(onboarding)/college-not-listed')}
      >
        <Text style={styles.link}>My college isn't listed</Text>
      </TouchableOpacity>

      {selectedCollege ? (
        <>
          <Text style={styles.label}>Hostel</Text>
          <TextInput
            style={styles.textInput}
            value={hostelFilter}
            onChangeText={setHostelFilter}
            placeholder="Search for your hostel"
          />
          {hostelsLoading ? (
            <ActivityIndicator style={styles.spinner} />
          ) : (
            <FlatList
              style={styles.list}
              data={filteredHostels}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.row, selectedHostel?.id === item.id && styles.rowSelected]}
                  onPress={() => setSelectedHostel(item)}
                >
                  <Text style={styles.rowTitle}>{item.name}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.empty}>No hostels match your search.</Text>}
            />
          )}
        </>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
        onPress={handleContinue}
        disabled={!canSubmit}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Continue</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  spinner: {
    marginVertical: 12,
  },
  list: {
    maxHeight: 160,
    marginTop: 8,
  },
  row: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  rowSelected: {
    backgroundColor: '#e8f0fe',
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  rowSubtitle: {
    fontSize: 13,
    color: '#888',
  },
  empty: {
    padding: 12,
    color: '#888',
  },
  linkRow: {
    marginTop: 10,
  },
  link: {
    color: '#1a73e8',
    fontSize: 14,
  },
  error: {
    color: '#c0392b',
    marginTop: 12,
  },
  button: {
    backgroundColor: '#1a73e8',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
