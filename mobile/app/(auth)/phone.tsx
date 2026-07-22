import { useState } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Screen, Brandmark, Heading, Body, ErrorText, Button, TextField } from '../../components/ui';

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
    <Screen center>
      <Brandmark />
      <Heading size="xl" style={{ marginBottom: 8 }}>
        Welcome to Washly
      </Heading>
      <Body muted style={{ marginBottom: 32 }}>
        Enter your phone number to get started
      </Body>

      <TextField
        prefix={COUNTRY_CODE}
        value={digits}
        onChangeText={(text) => setDigits(text.replace(/\D/g, '').slice(0, 10))}
        placeholder="10-digit mobile number"
        keyboardType="number-pad"
        maxLength={10}
        autoFocus
        containerStyle={{ marginBottom: 16 }}
      />

      {error ? <ErrorText style={{ marginBottom: 16 }}>{error}</ErrorText> : null}

      <Button label="Send OTP" onPress={handleSubmit} disabled={!canSubmit} loading={submitting} />
    </Screen>
  );
}
