import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuthStore } from '../../../src/stores/authStore';

export default function TabsLayout() {
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  const HeaderRight = () => (
    <Pressable onPress={() => logout()} hitSlop={8} style={{ marginRight: 14 }}>
      <Text style={styles.logout}>Log out</Text>
    </Pressable>
  );

  const HeaderLeft = () => (
    <View style={{ marginLeft: 14 }}>
      <Text style={styles.email} numberOfLines={1}>
        {user?.email}
      </Text>
    </View>
  );

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#4F46E5',
        tabBarInactiveTintColor: '#64748B',
        headerStyle: { backgroundColor: '#ffffff' },
        headerTitleStyle: { color: '#0F172A', fontWeight: '700' },
        headerTintColor: '#0F172A',
        headerRight: () => <HeaderRight />,
        headerLeft: () => <HeaderLeft />,
        headerTitleAlign: 'center',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="leads"
        options={{
          title: 'Candidates',
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="approvals"
        options={{
          title: 'Approvals',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="checkmark-circle-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="reviews"
        options={{
          title: 'Reviews',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  logout: { color: '#DC2626', fontWeight: '600', fontSize: 13 },
  email: { color: '#64748B', fontSize: 12, maxWidth: 160 },
});
