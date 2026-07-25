import { useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';
import { Screen, Heading, Body, Label, ErrorText, Button, TextField } from '../../../components/ui';
import { colors, fonts, radii } from '../../../constants/theme';

const CATEGORIES = [
  { value: 'payment_wallet', label: 'Payment / wallet issue' },
  { value: 'machine_malfunction', label: 'Machine malfunction' },
  { value: 'booking_flash', label: 'Booking / flash slot issue' },
  { value: 'id_verification', label: 'ID verification issue' },
  { value: 'other', label: 'Other' },
] as const;

export default function NewTicket() {
  const router = useRouter();
  const { session } = useAuth();

  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['value'] | null>(null);
  const [description, setDescription] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAsset(asset: ImagePicker.ImagePickerAsset) {
    if (!asset.base64 || !session) return;
    setError(null);
    setPhotoUri(asset.uri);
    setPhotoUploading(true);
    try {
      const path = `${session.user.id}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('ticket-photos')
        .upload(path, decode(asset.base64), { contentType: asset.mimeType ?? 'image/jpeg' });
      if (uploadError) throw uploadError;
      setPhotoPath(path);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Photo upload failed. Please try again.');
      setPhotoUri(null);
    } finally {
      setPhotoUploading(false);
    }
  }

  async function pickFromLibrary() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library permission is required to attach a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      await handleAsset(result.assets[0]);
    }
  }

  const canSubmit = !!category && description.trim().length > 0 && !submitting && !photoUploading;

  async function handleSubmit() {
    if (!canSubmit || !category) return;
    setError(null);
    setSubmitting(true);
    const { data, error: rpcError } = await supabase.rpc('create_support_ticket', {
      p_category: category,
      p_description: description.trim(),
      p_photo_path: photoPath ?? undefined,
    });
    setSubmitting(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    router.replace({ pathname: '/(app)/support/[id]', params: { id: data!.id } });
  }

  return (
    <Screen scroll insetTop={64}>
      <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 20 }}>
        <Body style={{ color: colors.appBlue, fontFamily: fonts.bodyMedium, fontSize: 15 }}>← Back</Body>
      </TouchableOpacity>

      <Heading size="xl" style={{ marginBottom: 24 }}>
        New ticket
      </Heading>

      <Label style={{ marginBottom: 10 }}>What's this about?</Label>
      {CATEGORIES.map((c) => (
        <TouchableOpacity
          key={c.value}
          style={[styles.categoryRow, category === c.value && styles.categoryRowSelected]}
          onPress={() => setCategory(c.value)}
          activeOpacity={0.85}
        >
          <Text style={[styles.categoryText, category === c.value && styles.categoryTextSelected]}>
            {c.label}
          </Text>
        </TouchableOpacity>
      ))}

      <Label style={{ marginTop: 20, marginBottom: 10 }}>Describe the issue</Label>
      <TextField
        value={description}
        onChangeText={setDescription}
        placeholder="What happened?"
        multiline
        numberOfLines={4}
        style={{ minHeight: 96, textAlignVertical: 'top', paddingTop: 14 }}
        containerStyle={{ marginBottom: 20 }}
      />

      <Label style={{ marginBottom: 10 }}>Photo (optional)</Label>
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={styles.photoPreview} />
      ) : null}
      <Button
        label={photoUri ? 'Change photo' : 'Attach a photo'}
        variant="secondary"
        onPress={pickFromLibrary}
        disabled={photoUploading || submitting}
        style={{ marginBottom: 20 }}
      />
      {photoUploading ? <ActivityIndicator color={colors.appBlue} style={{ marginBottom: 12 }} /> : null}

      {error ? <ErrorText style={{ marginBottom: 12 }}>{error}</ErrorText> : null}

      <Button label="Submit ticket" onPress={handleSubmit} disabled={!canSubmit} loading={submitting} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  categoryRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: 8,
  },
  categoryRowSelected: {
    backgroundColor: colors.appBlue,
    borderColor: colors.appBlue,
  },
  categoryText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.ink,
  },
  categoryTextSelected: {
    color: colors.inkOnBlue,
    fontFamily: fonts.bodySemiBold,
  },
  photoPreview: {
    width: '100%',
    height: 160,
    borderRadius: radii.lg,
    marginBottom: 12,
    backgroundColor: colors.surfaceMuted,
  },
});
