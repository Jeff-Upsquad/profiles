import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../src/services/api';
import Button from '../../../src/components/ui/Button';
import Picker from '../../../src/components/ui/Picker';
import Badge from '../../../src/components/ui/Badge';
import type { Category, ReviewProfile } from '../../../src/types';
import { formatDate } from '../../../src/lib/formatDate';

export default function ReviewsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: profiles, isLoading, isFetching, refetch } = useQuery<ReviewProfile[]>({
    queryKey: ['reviews', categoryFilter],
    queryFn: async () => {
      const params = categoryFilter ? `?category_id=${categoryFilter}` : '';
      const { data } = await api.get(`/admin/reviews${params}`);
      return data.profiles ?? data;
    },
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const { data } = await api.get('/admin/categories');
      return data.categories ?? data;
    },
  });

  const bulkApprove = useMutation({
    mutationFn: async (ids: string[]) => {
      await api.patch('/admin/reviews/bulk-approve', { profile_ids: ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      setSelected(new Set());
    },
    onError: (err: any) =>
      Alert.alert('Bulk approve failed', err?.response?.data?.message || 'Please try again.'),
  });

  const categoryOptions = useMemo(
    () => [
      { value: '', label: 'All Categories' },
      ...(categories ?? []).map((c) => ({ value: c.id, label: c.name })),
    ],
    [categories],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (isLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color="#4F46E5" />
      </View>
    );
  }

  const list = profiles ?? [];

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <View style={{ flex: 1 }}>
          <Picker
            value={categoryFilter}
            options={categoryOptions}
            onChange={setCategoryFilter}
          />
        </View>
      </View>

      {selected.size > 0 ? (
        <View style={styles.bulkBar}>
          <Text style={styles.bulkText}>{selected.size} selected</Text>
          <Button
            size="sm"
            loading={bulkApprove.isPending}
            onPress={() => bulkApprove.mutate(Array.from(selected))}
          >
            Approve {selected.size}
          </Button>
        </View>
      ) : null}

      <FlatList
        contentContainerStyle={list.length === 0 ? styles.emptyContainer : styles.listContainer}
        data={list}
        keyExtractor={(p) => p.id}
        refreshControl={
          <RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor="#4F46E5" />
        }
        ListHeaderComponent={
          list.length > 0 ? (
            <Text style={styles.header}>{list.length} profiles pending review</Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No profiles pending review</Text>
            <Text style={styles.emptyBody}>All caught up!</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isSelected = selected.has(item.id);
          const anyItem: any = item;
          return (
            <View style={styles.card}>
              <Pressable
                onPress={() => toggle(item.id)}
                style={styles.checkbox}
                hitSlop={10}
              >
                <Ionicons
                  name={isSelected ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={isSelected ? '#4F46E5' : '#94A3B8'}
                />
              </Pressable>
              <Pressable
                style={{ flex: 1 }}
                onPress={() => router.push(`/(app)/reviews/${item.id}` as any)}
              >
                <Text style={styles.name}>
                  {anyItem.talent_users?.full_name ?? 'Unknown'}
                </Text>
                <Text style={styles.meta}>
                  {anyItem.categories?.name ?? 'Uncategorized'} • Submitted{' '}
                  {formatDate(item.updated_at)}
                </Text>
                <View style={{ marginTop: 6 }}>
                  <Badge color="yellow">Pending</Badge>
                </View>
              </Pressable>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1F5F9' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  toolbar: { padding: 16, paddingBottom: 0 },
  bulkBar: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bulkText: { fontWeight: '600', color: '#3730A3' },
  listContainer: { padding: 16, gap: 10 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { fontSize: 13, color: '#64748B', fontWeight: '600', marginBottom: 4 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  checkbox: { paddingRight: 6 },
  name: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  meta: { fontSize: 12, color: '#64748B', marginTop: 2 },
  empty: { alignItems: 'center', gap: 6 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
  emptyBody: { fontSize: 13, color: '#64748B' },
});
