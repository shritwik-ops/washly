import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';

export default function AppLayout() {
  const { session, student, loading } = useAuth();

  if (!loading && (!session || !student)) {
    return <Redirect href="/" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
