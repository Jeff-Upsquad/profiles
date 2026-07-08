import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import api from '../../../src/services/api';
import Badge from '../../../src/components/ui/Badge';
import Button from '../../../src/components/ui/Button';
import RejectReasonModal from '../../../src/components/reviews/RejectReasonModal';
import type { CategoryField, ReviewProfile } from '../../../src/types';
import { valuesChanged } from '../../../src/lib/diff';
import { formatDateTime } from '../../../src/lib/formatDate';

function formatValue(field: CategoryField, value: any): string {
  if (value === undefined || value === null || value === '') return '—';
  if (field.field_type === 'multi_select' && Array.isArray(value)) {
    return value
      .map((v: string) => (field.options ?? []).find((o) => o.value === v)?.label || v)
      .join(', ');
  }
  if (field.field_type === 'select') {
    return (field.options ?? []).find((o) => o.value === value)?.label || String(value);
  }
  if (field.field_type === 'currency') {
    return `$${Number(value).toLocaleString()}`;
  }
  if (field.field_type === 'experience' && typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const y = (value as any).years;
    const m = (value as any).months;
    if (typeof y === 'number' && typeof m === 'number') {
      const yPart = y === 1 ? '1 year' : `${y} years`;
      const mPart = m === 1 ? '1 month' : `${m} months`;
      return `${yPart} ${mPart}`;
    }
  }
  if (field.field_type === 'file_upload') {
    return 'View file';
  }
  return String(value);
}

function formatExperience(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { years, months } = value as { years?: unknown; months?: unknown };
  if (typeof years !== 'number' || typeof months !== 'number') return null;
  if (years === 0 && months === 0) return null;
  const yPart = years === 1 ? '1 year' : `${years} years`;
  const mPart = months === 1 ? '1 month' : `${months} months`;
  return `${yPart} ${mPart}`;
}

export default function ProfileReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [rejectOpen, setRejectOpen] = useState(false);

  const { data: profile, isLoading } = useQuery<ReviewProfile>({
    queryKey: ['review', id],
    queryFn: async () => {
      const { data } = await api.get(`/admin/reviews/${id}`);
      return data.profile ?? data;
    },
    enabled: !!id,
  });

  const { data: fields } = useQuery<CategoryField[]>({
    queryKey: ['category-fields', profile?.category_id],
    queryFn: async () => {
      const { data } = await api.get(`/admin/categories/${profile!.category_id}/fields`);
      return data.fields ?? data;
    },
    enabled: !!profile?.category_id,
  });

  const approve = useMutation({
    mutationFn: async () => {
      await api.patch(`/admin/reviews/${id}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      router.back();
    },
    onError: (err: any) =>
      Alert.alert('Approve failed', err?.response?.data?.message || 'Please try again.'),
  });

  const reject = useMutation({
    mutationFn: async (reason: string) => {
      await api.patch(`/admin/reviews/${id}/reject`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      setRejectOpen(false);
      router.back();
    },
    onError: (err: any) =>
      Alert.alert('Reject failed', err?.response?.data?.message || 'Please try again.'),
  });

  if (isLoading || !profile) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color="#4F46E5" />
      </View>
    );
  }

  const anyProfile: any = profile;
  const talentUser = anyProfile.talent_users ?? anyProfile.talent_user;
  const category = anyProfile.categories ?? anyProfile.category;
  const fieldData: Record<string, any> = profile.field_data ?? {};
  const prev: Record<string, any> | null = anyProfile.previous_field_data ?? null;
  const sortedFields = (fields ?? [])
    .filter((f: any) => f.is_active !== false)
    .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const personalInfo: [string, string | number | null | undefined][] = talentUser
    ? [
        ['Full Name', talentUser.full_name],
        ['Phone', talentUser.phone],
        ['Age', talentUser.age],
        ['Gender', talentUser.gender],
        ['Location', talentUser.current_location],
        ['Native Place', talentUser.native_place],
      ]
    : [];

  const skills: { skill: string; level: number }[] | undefined = Array.isArray(fieldData._skills)
    ? (fieldData._skills as { skill: string; level: number }[]).map((s) => ({
        skill: s.skill,
        level: Math.max(1, Math.min(5, Math.round(s.level))),
      }))
    : undefined;
  // `_tools` is `{name, level}[]` after the proficiency upgrade; tolerate
  // legacy `string[]` rows by coercing.
  const tools: { name: string; level: number }[] = (() => {
    const raw = fieldData._tools;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((t: any) => {
        if (typeof t === 'string') return { name: t, level: 3 };
        if (t && typeof t.name === 'string') {
          const lvl = Number(t.level);
          return { name: t.name, level: Number.isFinite(lvl) ? Math.max(1, Math.min(5, Math.round(lvl))) : 3 };
        }
        return null;
      })
      .filter((t): t is { name: string; level: number } => t !== null);
  })();
  const aiTools: { name: string; level: number }[] = (() => {
    const raw = fieldData._ai_tools;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((t: any) => {
        if (typeof t === 'string') return { name: t, level: 3 };
        if (t && typeof t.name === 'string') {
          const lvl = Number(t.level);
          return { name: t.name, level: Number.isFinite(lvl) ? Math.max(1, Math.min(5, Math.round(lvl))) : 3 };
        }
        return null;
      })
      .filter((t): t is { name: string; level: number } => t !== null);
  })();
  const wages = fieldData._plan_wages as
    | { hourly?: number; daily?: number; monthly?: number }
    | undefined;
  const portfolio = anyProfile.portfolio_items as
    | { id: string; skill_name?: string; file_url: string; file_name?: string; file_type?: string }[]
    | undefined;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.name}>{talentUser?.full_name ?? 'Profile'}</Text>
        <Text style={styles.subtitle}>{category?.name ?? 'Uncategorized'}</Text>
        <View style={{ marginTop: 6 }}>
          <Badge color="yellow">Pending review</Badge>
        </View>
      </View>

      <View style={styles.actionsBar}>
        <Button
          variant="danger"
          style={{ flex: 1 }}
          onPress={() => setRejectOpen(true)}
        >
          Reject
        </Button>
        <Button
          style={{ flex: 1 }}
          loading={approve.isPending}
          onPress={() => approve.mutate()}
        >
          Approve
        </Button>
      </View>

      {talentUser ? (
        <Section title="Personal information">
          {personalInfo
            .filter(([, v]) => v !== undefined && v !== null && v !== '')
            .map(([label, value]) => (
              <Row key={String(label)} label={String(label)} value={String(value)} />
            ))}
        </Section>
      ) : null}

      <Section title="Profile details">
        {(() => {
          const expLabel = formatExperience(fieldData._experience);
          if (!expLabel) return null;
          const expHasChange = !!prev && valuesChanged(fieldData._experience, prev._experience);
          return (
            <Row
              key="_experience"
              label="Experience"
              value={expLabel}
              changed={expHasChange}
            />
          );
        })()}
        {sortedFields.map((field: any) => {
          const cur = fieldData[field.field_key];
          const hasChange = !!prev && valuesChanged(cur, prev[field.field_key]);
          return (
            <Row
              key={field.id}
              label={field.field_label}
              value={formatValue(field, cur)}
              changed={hasChange}
            />
          );
        })}
      </Section>

      {skills && skills.length > 0 ? (
        <Section title="Skills">
          {skills.map((s) => (
            <View key={s.skill} style={styles.skillRow}>
              <Text style={styles.skillName}>{s.skill}</Text>
              <View style={styles.skillBar}>
                <View
                  style={[
                    styles.skillFill,
                    { width: `${Math.min(100, (s.level / 5) * 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.skillLevel}>{s.level}</Text>
            </View>
          ))}
        </Section>
      ) : null}

      {tools && tools.length > 0 ? (
        <Section title="Tools">
          <View style={styles.chipWrap}>
            {tools.map((t) => (
              <View key={t.name} style={[styles.chip, styles.chipIndigo]}>
                <Text style={styles.chipIndigoText}>{t.name}</Text>
              </View>
            ))}
          </View>
        </Section>
      ) : null}

      {aiTools && aiTools.length > 0 ? (
        <Section title="AI Tools">
          <View style={styles.chipWrap}>
            {aiTools.map((t) => (
              <View key={t.name} style={[styles.chip, styles.chipPurple]}>
                <Text style={styles.chipPurpleText}>{t.name}</Text>
              </View>
            ))}
          </View>
        </Section>
      ) : null}

      {wages ? (
        <Section title="Plan wages">
          {wages.hourly != null ? (
            <Row label="Hourly" value={`$${wages.hourly}`} />
          ) : null}
          {wages.daily != null ? <Row label="Daily" value={`$${wages.daily}`} /> : null}
          {wages.monthly != null ? (
            <Row label="Monthly" value={`$${wages.monthly}`} />
          ) : null}
        </Section>
      ) : null}

      {portfolio && portfolio.length > 0 ? (
        <Section title="Portfolio">
          {portfolio.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => WebBrowser.openBrowserAsync(item.file_url)}
              style={styles.portfolioRow}
            >
              <Text style={styles.portfolioSkill}>{item.skill_name || '—'}</Text>
              <Text style={styles.portfolioName} numberOfLines={1}>
                {item.file_name || 'View file'}
              </Text>
              <Text style={styles.portfolioLink}>Open ›</Text>
            </Pressable>
          ))}
        </Section>
      ) : null}

      <Section title="Metadata">
        <Row label="Created" value={formatDateTime(profile.created_at)} />
        <Row label="Last updated" value={formatDateTime(profile.updated_at)} />
      </Section>

      <RejectReasonModal
        visible={rejectOpen}
        onClose={() => setRejectOpen(false)}
        onSubmit={(reason) => reject.mutate(reason)}
        loading={reject.isPending}
      />
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({
  label,
  value,
  changed,
}: {
  label: string;
  value: string;
  changed?: boolean;
}) {
  return (
    <View style={[styles.row, changed && styles.rowChanged]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
      {changed ? (
        <View style={{ alignSelf: 'flex-start', marginTop: 4 }}>
          <Badge color="red">Changed</Badge>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1F5F9' },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  header: { gap: 2 },
  name: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  subtitle: { fontSize: 13, color: '#64748B' },
  actionsBar: { flexDirection: 'row', gap: 8, marginVertical: 4 },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#64748B',
    marginBottom: 8,
  },
  row: { paddingVertical: 6 },
  rowChanged: { backgroundColor: '#FEF2F2', marginHorizontal: -14, paddingHorizontal: 14 },
  rowLabel: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  rowValue: { fontSize: 14, color: '#0F172A', marginTop: 2 },
  skillRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  skillName: { width: 120, fontSize: 13, fontWeight: '600', color: '#334155' },
  skillBar: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  skillFill: { height: '100%', backgroundColor: '#4F46E5' },
  skillLevel: { width: 28, textAlign: 'right', fontSize: 13, fontWeight: '700', color: '#4F46E5' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  chipIndigo: { borderColor: '#C7D2FE', backgroundColor: '#EEF2FF' },
  chipIndigoText: { color: '#3730A3', fontSize: 13, fontWeight: '500' },
  chipPurple: { borderColor: '#DDD6FE', backgroundColor: '#F5F3FF' },
  chipPurpleText: { color: '#6B21A8', fontSize: 13, fontWeight: '500' },
  portfolioRow: {
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  portfolioSkill: { fontSize: 12, fontWeight: '600', color: '#64748B', width: 80 },
  portfolioName: { flex: 1, fontSize: 13, color: '#0F172A' },
  portfolioLink: { fontSize: 13, color: '#4F46E5', fontWeight: '600' },
});
