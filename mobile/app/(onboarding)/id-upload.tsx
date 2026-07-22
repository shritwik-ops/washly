import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

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
    <View style={styles.container}>
      <Text style={styles.title}>Upload your college ID</Text>
      <Text style={styles.subtitle}>
        This helps us confirm you're a real student. Your college admin will review it.
      </Text>

      {previewUri ? (
        <Image source={{ uri: previewUri }} style={styles.preview} />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>No photo selected yet</Text>
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.button, uploading && styles.buttonDisabled]}
        onPress={pickFromCamera}
        disabled={uploading}
      >
        <Text style={styles.buttonText}>Take Photo</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.buttonSecondary, uploading && styles.buttonDisabled]}
        onPress={pickFromLibrary}
        disabled={uploading}
      >
        <Text style={[styles.buttonText, styles.buttonTextSecondary]}>Choose from Library</Text>
      </TouchableOpacity>

      {uploading ? <ActivityIndicator style={styles.spinner} /> : null}
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    marginBottom: 24,
  },
  preview: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    marginBottom: 24,
    backgroundColor: '#eee',
  },
  placeholder: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    marginBottom: 24,
    backgroundColor: '#f2f2f2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
  },
  placeholderText: {
    color: '#999',
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
    marginBottom: 12,
  },
  buttonSecondary: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#1a73e8',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextSecondary: {
    color: '#1a73e8',
  },
  spinner: {
    marginTop: 12,
  },
});
