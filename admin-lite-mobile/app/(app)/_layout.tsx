import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';

export default function AppLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="leads/[id]"
        options={{
          headerShown: true,
          title: 'Candidate',
          headerStyle: { backgroundColor: '#ffffff' },
          headerTintColor: '#0F172A',
        }}
      />
      <Stack.Screen
        name="reviews/[id]"
        options={{
          headerShown: true,
          title: 'Profile Review',
          headerStyle: { backgroundColor: '#ffffff' },
          headerTintColor: '#0F172A',
        }}
      />
    </Stack>
  );
}
