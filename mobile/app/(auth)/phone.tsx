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

const COUNTRY_CODE = '+91';

export default function PhoneEntry() {
  const router = useRouter();
  const [digits, setDigits] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = digits.length === 10 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    const phone = `${COUNTRY_CODE}${digits}`;
    const { error: otpError } = await supabase.auth.signInWithOtp({ phone });
    setSubmitting(false);
    if (otpError) {
      setError(otpError.message);
      return;
    }
    router.push({ pathname: '/(auth)/verify', params: { phone } });
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Welcome to Washly</Text>
      <Text style={styles.subtitle}>Enter your phone number to get started</Text>

      <View style={styles.inputRow}>
        <Text style={styles.countryCode}>{COUNTRY_CODE}</Text>
        <TextInput
          style={styles.input}
          value={digits}
          onChangeText={(text) => setDigits(text.replace(/\D/g, '').slice(0, 10))}
          placeholder="10-digit mobile number"
          keyboardType="number-pad"
          maxLength={10}
          autoFocus
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Send OTP</Text>
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
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    marginBottom: 32,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  countryCode: {
    fontSize: 16,
    marginRight: 8,
    color: '#333',
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 14,
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
