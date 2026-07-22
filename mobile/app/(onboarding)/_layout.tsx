import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';

export default function OnboardingLayout() {
  const { session, loading } = useAuth();

  if (!loading && !session) {
    return <Redirect href="/(auth)/phone" />;
  }

  // Deliberately does NOT redirect away just because a `student` row
  // already exists -- id-upload.tsx must stay reachable for ID
  // resubmission after a rejection, which happens after onboarding is
  // otherwise complete. college.tsx handles its own "already onboarded"
  // redirect locally instead.

  return <Stack screenOptions={{ headerShown: false }} />;
}
