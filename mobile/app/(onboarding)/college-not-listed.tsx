import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export default function CollegeNotListed() {
  const router = useRouter();
  const { session } = useAuth();
  const [collegeName, setCollegeName] = useState('');
  const [city, setCity] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = collegeName.trim().length > 0 && !submitting;

  async function handleSubmit() {
    if (!canSubmit || !session?.user.phone) return;
    setError(null);
    setSubmitting(true);
    const { error: insertError } = await supabase.from('college_leads').insert({
      college_name: collegeName.trim(),
      city: city.trim() || null,
      contact_phone: session.user.phone,
    });
    setSubmitting(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Thanks!</Text>
        <Text style={styles.subtitle}>
          We'll notify you as soon as Washly launches at your college.
        </Text>
        <TouchableOpacity style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>My college isn't listed</Text>
      <Text style={styles.subtitle}>
        Let us know and we'll notify you when Washly launches there.
      </Text>

      <TextInput
        style={styles.input}
        value={collegeName}
        onChangeText={setCollegeName}
        placeholder="College name"
        autoFocus
      />
      <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="City (optional)" />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Notify me</Text>
        )}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    marginBottom: 28,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  error: {
    color: '#c0392b',
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#1a73e8',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
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
