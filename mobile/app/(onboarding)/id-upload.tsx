import { useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Screen, Heading, Body, ErrorText, Button } from '../../components/ui';
import { colors, fonts, radii } from '../../constants/theme';

export default function IdUpload() {
  const router = useRouter();
  const { session, refreshStudent } = useAuth();
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAsset(asset: ImagePicker.ImagePickerAsset) {
    if (!asset.base64 || !session) return;
    setError(null);
    setPreviewUri(asset.uri);
    setUploading(true);
    try {
      // A unique filename per upload (not a fixed path) is deliberate: the
      // DB trigger on `students` (enforce_student_update_permissions) only
      // auto-resets id_verification_status back to 'pending' when
      // id_image_url actually CHANGES value. A fixed, overwritten path
      // never changes on resubmission, so the reset would silently never
      // fire -- confirmed by testing. A unique path also means a rejected
      // photo isn't destroyed, which is useful for dispute review later.
      const path = `${session.user.id}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('student-ids')
        .upload(path, decode(asset.base64), {
          contentType: asset.mimeType ?? 'image/jpeg',
        });
      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from('students')
        .update({ id_image_url: path })
        .eq('id', session.user.id);
      if (updateError) throw updateError;

      await refreshStudent();
      router.replace('/(app)/home');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function pickFromCamera() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('Camera permission is required to take a photo of your ID.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      await handleAsset(result.assets[0]);
    }
  }

  async function pickFromLibrary() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library permission is required to select your ID.');
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

  return (
    <Screen>
      <Heading size="xl" style={{ marginBottom: 8 }}>
        Upload your college ID
      </Heading>
      <Body muted style={{ marginBottom: 24 }}>
        This helps us confirm you're a real student. Your college admin will review it.
      </Body>

      {previewUri ? (
        <Image source={{ uri: previewUri }} style={styles.preview} />
      ) : (
        <View style={styles.placeholder}>
          <View style={styles.placeholderIcon}>
            <Text style={styles.placeholderIconText}>ID</Text>
          </View>
          <Text style={styles.placeholderText}>No photo selected yet</Text>
        </View>
      )}

      {error ? <ErrorText style={{ marginBottom: 12 }}>{error}</ErrorText> : null}

      <Button
        label="Take Photo"
        onPress={pickFromCamera}
        disabled={uploading}
        style={{ marginBottom: 12 }}
      />
      <Button
        label="Choose from Library"
        onPress={pickFromLibrary}
        variant="secondary"
        disabled={uploading}
      />

      {uploading ? <ActivityIndicator style={styles.spinner} color={colors.appBlue} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: {
    width: '100%',
    height: 220,
    borderRadius: radii.lg,
    marginBottom: 24,
    backgroundColor: colors.surfaceMuted,
  },
  placeholder: {
    width: '100%',
    height: 220,
    borderRadius: radii.lg,
    marginBottom: 24,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  placeholderIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.sm,
    backgroundColor: colors.appBlueTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  placeholderIconText: {
    fontFamily: fonts.heading,
    fontSize: 15,
    color: colors.appBlue,
  },
  placeholderText: {
    fontFamily: fonts.bodyMedium,
    color: colors.inkMuted,
  },
  spinner: {
    marginTop: 16,
  },
});
