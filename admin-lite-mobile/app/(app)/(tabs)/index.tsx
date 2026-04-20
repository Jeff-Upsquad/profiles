import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const cards = [
  {
    href: '/(app)/(tabs)/leads',
    title: 'Candidates',
    description: 'Applications from the intake form. Filter, review, update status.',
    icon: 'people' as const,
  },
  {
    href: '/(app)/(tabs)/approvals',
    title: 'Approvals',
    description: 'Pending talent account sign-ups awaiting admin approval.',
    icon: 'checkmark-circle' as const,
  },
  {
    href: '/(app)/(tabs)/reviews',
    title: 'Reviews',
    description: 'Submitted talent profiles awaiting review and approval.',
    icon: 'document-text' as const,
  },
];

export default function Dashboard() {
  const router = useRouter();
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Dashboard</Text>
      <Text style={styles.subtitle}>
        Focused workflow for candidates, user approvals, and profile reviews.
      </Text>

      <View style={styles.cards}>
        {cards.map((card) => (
          <Pressable
            key={card.href}
            onPress={() => router.push(card.href as any)}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          >
            <View style={styles.cardIcon}>
              <Ionicons name={card.icon} size={22} color="#4F46E5" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{card.title}</Text>
              <Text style={styles.cardDesc}>{card.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1F5F9' },
  content: { padding: 16, gap: 16 },
  title: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
  subtitle: { fontSize: 14, color: '#64748B', marginTop: -12 },
  cards: { gap: 10, marginTop: 4 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardPressed: { opacity: 0.85 },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  cardDesc: { fontSize: 13, color: '#64748B', marginTop: 2 },
});
