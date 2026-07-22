import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

export default function Index() {
  const { session, student, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/phone" />;
  }

  if (!student) {
    return <Redirect href="/(onboarding)/college" />;
  }

  return <Redirect href="/(app)/home" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
