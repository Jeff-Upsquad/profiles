import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../src/services/api';
import Button from '../../../src/components/ui/Button';
import type { TalentUser } from '../../../src/types';

export default function ApprovalsScreen() {
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching, refetch } = useQuery<TalentUser[]>({
    queryKey: ['pending-approvals'],
    queryFn: async () => {
      const { data } = await api.get('/admin/user-approvals');
      return data.users ?? data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.patch(`/admin/user-approvals/${userId}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
    },
    onError: (err: any) =>
      Alert.alert('Approve failed', err?.response?.data?.message || 'Please try again.'),
  });

  const rejectMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.patch(`/admin/user-approvals/${userId}/reject`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
    },
    onError: (err: any) =>
      Alert.alert('Reject failed', err?.response?.data?.message || 'Please try again.'),
  });

  function confirmReject(user: TalentUser) {
    Alert.alert(
      'Reject user?',
      `This will reject ${user.full_name}'s sign-up. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: () => rejectMutation.mutate(user.id),
        },
      ],
    );
  }

  if (isLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color="#4F46E5" />
      </View>
    );
  }

  const users = data ?? [];

  return (
    <FlatList
      style={styles.root}
      contentContainerStyle={users.length === 0 ? styles.emptyContainer : styles.listContainer}
      data={users}
      keyExtractor={(u) => u.id}
      refreshControl={
        <RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor="#4F46E5" />
      }
      ListHeaderComponent={
        users.length > 0 ? (
          <Text style={styles.header}>{users.length} pending</Text>
        ) : null
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No pending approvals</Text>
          <Text style={styles.emptyBody}>New sign-ups will appear here.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.full_name}</Text>
            <Text style={styles.meta}>{item.phone || '—'}</Text>
            <Text style={styles.meta}>
              Signed up {new Date(item.created_at).toLocaleDateString('en-IN')}
            </Text>
          </View>
          <View style={styles.actions}>
            <Button
              size="sm"
              onPress={() => approveMutation.mutate(item.id)}
              loading={approveMutation.isPending && approveMutation.variables === item.id}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="danger"
              onPress={() => confirmReject(item)}
              loading={rejectMutation.isPending && rejectMutation.variables === item.id}
            >
              Reject
            </Button>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1F5F9' },
  listContainer: { padding: 16, gap: 10 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  header: { fontSize: 13, color: '#64748B', fontWeight: '600', marginBottom: 4 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  name: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  meta: { fontSize: 12, color: '#64748B', marginTop: 2 },
  actions: { gap: 6 },
  empty: { alignItems: 'center', gap: 6 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
  emptyBody: { fontSize: 13, color: '#64748B' },
});
