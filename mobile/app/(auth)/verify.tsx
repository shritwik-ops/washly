import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Screen, Brandmark, Heading, Body, ErrorText, Button, TextField } from '../../components/ui';

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
    <Screen center>
      <Brandmark />
      <Heading size="xl" style={{ marginBottom: 8 }}>
        Enter the code
      </Heading>
      <Body muted style={{ marginBottom: 24 }}>
        We sent a 6-digit code to {phone}
      </Body>

      <TextField
        value={code}
        onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, 6))}
        placeholder="123456"
        keyboardType="number-pad"
        maxLength={6}
        autoFocus
        style={{ fontSize: 22, letterSpacing: 6 }}
        containerStyle={{ marginBottom: 20 }}
      />

      {error ? <ErrorText style={{ marginBottom: 16 }}>{error}</ErrorText> : null}

      <Button label="Verify" onPress={handleVerify} disabled={!canSubmit} loading={submitting} />

      <Button
        label={resending ? 'Resending…' : "Didn't get a code? Resend"}
        onPress={handleResend}
        variant="ghost"
        disabled={resending}
        style={{ marginTop: 4 }}
      />
    </Screen>
  );
}
