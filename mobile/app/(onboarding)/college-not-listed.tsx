import { useState } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Screen, Heading, Body, ErrorText, Button, TextField } from '../../components/ui';

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
      <Screen center>
        <Heading size="xl" style={{ marginBottom: 8 }}>
          Thanks!
        </Heading>
        <Body muted style={{ marginBottom: 28 }}>
          We'll notify you as soon as Washly launches at your college.
        </Body>
        <Button label="Back" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen center>
      <Heading size="lg" style={{ marginBottom: 8 }}>
        My college isn't listed
      </Heading>
      <Body muted style={{ marginBottom: 24 }}>
        Let us know and we'll notify you when Washly launches there.
      </Body>

      <TextField
        value={collegeName}
        onChangeText={setCollegeName}
        placeholder="College name"
        autoFocus
        containerStyle={{ marginBottom: 8 }}
      />
      <TextField
        value={city}
        onChangeText={setCity}
        placeholder="City (optional)"
        containerStyle={{ marginBottom: 16 }}
      />

      {error ? <ErrorText style={{ marginBottom: 16 }}>{error}</ErrorText> : null}

      <Button label="Notify me" onPress={handleSubmit} disabled={!canSubmit} loading={submitting} />
    </Screen>
  );
}
