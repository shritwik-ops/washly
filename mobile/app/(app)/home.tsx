import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  verified: 'Verified',
  rejected: 'Rejected',
};

const STATUS_COLOR: Record<string, string> = {
  pending: '#b7791f',
  verified: '#2f855a',
  rejected: '#c0392b',
};

export default function Home() {
  const router = useRouter();
  const { student } = useAuth();

  if (!student) return null; // guarded by (app)/_layout.tsx

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>
        {student.full_name ? `Hi, ${student.full_name}` : 'Welcome'}
      </Text>
      <Text style={styles.collegeInfo}>
        {student.college?.name}
        {student.hostel?.name ? ` · ${student.hostel.name}` : ''}
      </Text>

      {!student.id_image_url ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Upload your college ID</Text>
          <Text style={styles.cardBody}>
            One last step -- we need a photo of your ID to verify you're a student here.
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.push('/(onboarding)/id-upload')}
          >
            <Text style={styles.buttonText}>Upload ID</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>ID verification</Text>
          <Text style={[styles.status, { color: STATUS_COLOR[student.id_verification_status] }]}>
            {STATUS_LABEL[student.id_verification_status] ?? student.id_verification_status}
          </Text>
          {student.id_verification_status === 'rejected' ? (
            <>
              {student.id_rejection_reason ? (
                <Text style={styles.cardBody}>Reason: {student.id_rejection_reason}</Text>
              ) : null}
              <TouchableOpacity
                style={styles.button}
                onPress={() => router.push('/(onboarding)/id-upload')}
              >
                <Text style={styles.buttonText}>Resubmit ID</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      )}

      <TouchableOpacity style={styles.signOut} onPress={() => supabase.auth.signOut()}>
        <Text style={styles.signOutText}>Sign out</Text>
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
  greeting: {
    fontSize: 24,
    fontWeight: '700',
  },
  collegeInfo: {
    fontSize: 15,
    color: '#666',
    marginTop: 4,
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#f7f7f8',
    borderRadius: 12,
    padding: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  cardBody: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  status: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  button: {
    backgroundColor: '#1a73e8',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  signOut: {
    marginTop: 32,
    alignItems: 'center',
  },
  signOutText: {
    color: '#c0392b',
    fontSize: 14,
  },
});
