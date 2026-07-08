import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  RefreshControl,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../src/services/api';
import Input from '../../../src/components/ui/Input';
import Tabs from '../../../src/components/ui/Tabs';
import Badge from '../../../src/components/ui/Badge';
import Picker from '../../../src/components/ui/Picker';
import { groupItemsByBucket } from '../../../src/lib/groupLeadsByBucket';
import { formatIndianPhone } from '../../../src/lib/phone';
import { formatDate } from '../../../src/lib/formatDate';
import { useStageLabels } from '../../../src/hooks/useStageLabels';
import {
  FORM_TYPE_TABS,
  STAGE_COLORS,
  STAGE_LABELS,
  STAGE_OPTIONS,
} from '../../../src/constants/leads';
import type { Lead, LeadsResponse } from '../../../src/types';

export default function LeadsScreen() {
  const router = useRouter();
  const { labelFor } = useStageLabels();
  const [formType, setFormType] = useState('');
  const [stage, setStage] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(h);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [formType, stage, debouncedSearch]);

  const { data, isLoading, isFetching, refetch } = useQuery<LeadsResponse>({
    queryKey: ['admin-leads', formType, stage, debouncedSearch, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (formType) params.set('form_type', formType);
      if (stage) params.set('status', stage);
      if (debouncedSearch) params.set('search', debouncedSearch);
      params.set('page', String(page));
      params.set('limit', '25');
      const { data } = await api.get(`/admin/leads?${params.toString()}`);
      return data;
    },
    placeholderData: keepPreviousData,
  });

  const sections = useMemo(() => {
    const buckets = groupItemsByBucket(data?.leads ?? []);
    return buckets.map((b) => ({ title: b.label, data: b.items, key: b.key }));
  }, [data?.leads]);

  if (isLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color="#4F46E5" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.filters}>
        <Tabs
          options={FORM_TYPE_TABS}
          value={formType}
          onChange={setFormType}
          scrollable
        />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
          <View style={{ flex: 1 }}>
            <Picker
              value={stage}
              options={STAGE_OPTIONS}
              onChange={setStage}
            />
          </View>
        </View>
        <Input
          placeholder="Search name, email, phone…"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
          style={{ marginTop: 8 }}
        />
      </View>

      <SectionList
        style={{ flex: 1 }}
        contentContainerStyle={
          sections.length === 0 ? styles.emptyContainer : styles.listContainer
        }
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={refetch}
            tintColor="#4F46E5"
          />
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionCount}>{section.data.length}</Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No candidates match your filters</Text>
            <Text style={styles.emptyBody}>Try clearing the search or stage.</Text>
          </View>
        }
        ListFooterComponent={
          data && data.total_pages > 1 ? (
            <View style={styles.pagination}>
              <Text style={styles.paginationText}>
                Page {data.page} of {data.total_pages} ({data.total} total)
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  disabled={page <= 1}
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                  style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
                >
                  <Text style={styles.pageBtnText}>Previous</Text>
                </Pressable>
                <Pressable
                  disabled={page >= data.total_pages}
                  onPress={() => setPage((p) => p + 1)}
                  style={[
                    styles.pageBtn,
                    page >= data.total_pages && styles.pageBtnDisabled,
                  ]}
                >
                  <Text style={styles.pageBtnText}>Next</Text>
                </Pressable>
              </View>
            </View>
          ) : null
        }
        renderItem={({ item }) => <LeadRow lead={item} labelFor={labelFor} onPress={() =>
          router.push(`/(app)/leads/${item.id}` as any)
        } />}
      />
    </View>
  );
}

function LeadRow({
  lead,
  onPress,
  labelFor,
}: {
  lead: Lead;
  onPress: () => void;
  labelFor: (formType: string | undefined, key: string, fallback?: string) => string;
}) {
  const initials = lead.name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.name} numberOfLines={1}>{lead.name}</Text>
          <Badge color={lead.form_type === 'creative' ? 'indigo' : 'gray'}>
            {lead.form_type}
          </Badge>
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {formatIndianPhone(lead.phone)}
          {lead.email ? ` · ${lead.email}` : ''}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Badge color={STAGE_COLORS[lead.status] || 'gray'}>
          {labelFor(lead.form_type, lead.status, STAGE_LABELS[lead.status])}
        </Badge>
        <Text style={styles.date}>
          {formatDate(lead.created_at)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1F5F9' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  filters: { padding: 16, paddingBottom: 8, backgroundColor: '#F1F5F9' },
  listContainer: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 14,
    paddingBottom: 6,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#64748B',
  },
  sectionCount: { fontSize: 11, color: '#94A3B8' },
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
  cardPressed: { backgroundColor: '#F8FAFC' },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 13, fontWeight: '700', color: '#3730A3' },
  name: { fontSize: 14, fontWeight: '700', color: '#0F172A', flexShrink: 1 },
  meta: { fontSize: 12, color: '#64748B', marginTop: 2 },
  date: { fontSize: 11, color: '#94A3B8' },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  paginationText: { fontSize: 12, color: '#64748B' },
  pageBtn: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#ffffff',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  pageBtnDisabled: { opacity: 0.5 },
  pageBtnText: { fontSize: 12, color: '#0F172A', fontWeight: '600' },
  empty: { alignItems: 'center', gap: 6 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
  emptyBody: { fontSize: 13, color: '#64748B' },
});
