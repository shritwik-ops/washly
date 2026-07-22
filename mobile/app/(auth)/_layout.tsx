import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';

export default function AuthLayout() {
  const { session, loading } = useAuth();

  if (!loading && session) {
    // Already signed in -- let index.tsx decide where they actually belong.
    return <Redirect href="/" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
