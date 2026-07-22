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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

export default function VerifyOtp() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const canSubmit = code.length === 6 && !submitting;

  async function handleVerify() {
    if (!canSubmit || !phone) return;
    setError(null);
    setSubmitting(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone,
      token: code,
      type: 'sms',
    });
    setSubmitting(false);
    if (verifyError) {
      setError(verifyError.message);
      return;
    }
    router.replace('/');
  }

  async function handleResend() {
    if (!phone || resending) return;
    setError(null);
    setResending(true);
    const { error: otpError } = await supabase.auth.signInWithOtp({ phone });
    setResending(false);
    if (otpError) {
      setError(otpError.message);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Enter the code</Text>
      <Text style={styles.subtitle}>We sent a 6-digit code to {phone}</Text>

      <TextInput
        style={styles.input}
        value={code}
        onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, 6))}
        placeholder="123456"
        keyboardType="number-pad"
        maxLength={6}
        autoFocus
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
        onPress={handleVerify}
        disabled={!canSubmit}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Verify</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.resend} onPress={handleResend} disabled={resending}>
        <Text style={styles.resendText}>{resending ? 'Resending…' : "Didn't get a code? Resend"}</Text>
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
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontSize: 20,
    letterSpacing: 4,
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
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resend: {
    marginTop: 20,
    alignItems: 'center',
  },
  resendText: {
    color: '#1a73e8',
    fontSize: 14,
  },
});
