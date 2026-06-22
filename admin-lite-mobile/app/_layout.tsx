import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { queryClient } from '../src/services/queryClient';
import { useAuthStore } from '../src/stores/authStore';
import { useUpdateStore } from '../src/stores/updateStore';
import UpdateGate from '../src/components/UpdateGate';

export default function RootLayout() {
  const isLoading = useAuthStore((s) => s.isLoading);
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const checkForUpdate = useUpdateStore((s) => s.check);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  // Poll the release manifest once at launch; the inline UpdateCard / blocking
  // UpdateGate surface any newer build.
  useEffect(() => {
    checkForUpdate();
  }, [checkForUpdate]);

  if (isLoading) {
    return (
      <View style={styles.loader}>
        <StatusBar style="light" backgroundColor="#4F46E5" />
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor="#4F46E5" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
        </Stack>
        <UpdateGate />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
