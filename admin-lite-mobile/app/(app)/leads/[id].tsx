import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Linking,
  Alert,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../src/services/api';
import Badge from '../../../src/components/ui/Badge';
import Button from '../../../src/components/ui/Button';
import Picker from '../../../src/components/ui/Picker';
import InterviewInvitationSection from '../../../src/components/leads/InterviewInvitationSection';
import TalentOnboardingSection from '../../../src/components/leads/TalentOnboardingSection';
import { formatDateTime } from '../../../src/lib/formatDate';
import ArchiveLeadModal from '../../../src/components/leads/ArchiveLeadModal';
import { formatIndianPhone, cleanPhoneForLink } from '../../../src/lib/phone';
import { useStageLabels } from '../../../src/hooks/useStageLabels';
import {
  PROFILE_TYPE_OPTIONS,
  STAGE_COLORS,
  STAGE_LABELS,
  STAGE_OPTIONS,
} from '../../../src/constants/leads';
import type { LeadFull } from '../../../src/types';

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { labelFor } = useStageLabels();
  const [archiveOpen, setArchiveOpen] = useState(false);

  const { data: lead, isLoading } = useQuery<LeadFull>({
    queryKey: ['admin-lead', id],
    queryFn: async () => {
      const { data } = await api.get(`/admin/leads/${id}`);
      return data.lead ?? data;
    },
    enabled: !!id,
  });

  const updateStage = useMutation({
    mutationFn: async (vars: { status: string; archive_reason?: string; admin_notes?: string }) => {
      await api.patch(`/admin/leads/${id}/status`, vars);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-lead', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-leads'] });
    },
    onError: (err: any) =>
      Alert.alert('Update failed', err?.response?.data?.message || 'Please try again.'),
  });

  const updateProfileType = useMutation({
    mutationFn: async (profile_type: string) => {
      await api.patch(`/admin/leads/${id}/profile-type`, { profile_type });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-lead', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-leads'] });
    },
    onError: (err: any) =>
      Alert.alert('Update failed', err?.response?.data?.message || 'Please try again.'),
  });

  if (isLoading || !lead) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color="#4F46E5" />
      </View>
    );
  }

  const formattedPhone = formatIndianPhone(lead.phone);
  const linkPhone = cleanPhoneForLink(lead.phone);
  const formDataEntries = Object.entries(lead.form_data ?? {});

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.name}>{lead.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <Badge color={lead.form_type === 'creative' ? 'indigo' : 'gray'}>
            {lead.form_type}
          </Badge>
          <Badge color={STAGE_COLORS[lead.status] || 'gray'}>
            {labelFor(lead.form_type, lead.status, STAGE_LABELS[lead.status])}
          </Badge>
        </View>

        <View style={styles.contactRow}>
          <Pressable
            style={({ pressed }) => [styles.contactBtn, pressed && styles.contactPressed]}
            onPress={() => Linking.openURL(`tel:${linkPhone}`)}
          >
            <Ionicons name="call-outline" size={16} color="#0F172A" />
            <Text style={styles.contactText}>{formattedPhone}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.contactBtn, pressed && styles.contactPressed]}
            onPress={() => Linking.openURL(`https://wa.me/${linkPhone}`)}
          >
            <Ionicons name="logo-whatsapp" size={16} color="#16A34A" />
            <Text style={styles.contactText}>WhatsApp</Text>
          </Pressable>
          {lead.email ? (
            <Pressable
              style={({ pressed }) => [styles.contactBtn, pressed && styles.contactPressed]}
              onPress={() => Linking.openURL(`mailto:${lead.email}`)}
            >
              <Ionicons name="mail-outline" size={16} color="#0F172A" />
              <Text style={styles.contactText} numberOfLines={1}>{lead.email}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Stage</Text>
        <Picker
          value={lead.status}
          options={STAGE_OPTIONS.filter((o) => o.value !== '').map((o) => ({
            ...o,
            label: labelFor(lead.form_type, o.value, o.label),
          }))}
          onChange={(next) => {
            if (next === 'archived') {
              setArchiveOpen(true);
            } else if (next !== lead.status) {
              updateStage.mutate({ status: next });
            }
          }}
        />
        <Picker
          label="Profile type"
          value={lead.profile_type || ''}
          options={PROFILE_TYPE_OPTIONS}
          onChange={(next) => {
            if (next !== (lead.profile_type || '')) {
              updateProfileType.mutate(next);
            }
          }}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Form submission</Text>
        {formDataEntries.length === 0 ? (
          <Text style={styles.emptyText}>No form data recorded.</Text>
        ) : (
          formDataEntries.map(([key, value]) => (
            <View key={key} style={styles.kvRow}>
              <Text style={styles.kvKey}>{key.replace(/_/g, ' ')}</Text>
              <Text style={styles.kvValue}>
                {Array.isArray(value) ? value.join(', ') : String(value ?? '—')}
              </Text>
            </View>
          ))
        )}
      </View>

      {lead.resume_url ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resume</Text>
          <Button variant="secondary" size="sm" onPress={() => Linking.openURL(lead.resume_url!)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="document-outline" size={14} color="#0F172A" />
              <Text style={{ color: '#0F172A', fontWeight: '600' }}>Open resume</Text>
            </View>
          </Button>
        </View>
      ) : null}

      <InterviewInvitationSection
        leadId={lead.id}
        leadName={lead.name}
        leadPhone={lead.phone}
        formType={lead.form_type}
      />

      {lead.status === 'shortlisted' ||
      lead.status === 'partner_onboarding' ||
      lead.status === 'onboard_completed' ? (
        <TalentOnboardingSection
          leadEmail={lead.email}
          leadName={lead.name}
          leadPhone={lead.phone}
        />
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Metadata</Text>
        <View style={styles.kvRow}>
          <Text style={styles.kvKey}>Submitted</Text>
          <Text style={styles.kvValue}>
            {formatDateTime(lead.created_at)}
          </Text>
        </View>
        {lead.utm_source ? (
          <View style={styles.kvRow}>
            <Text style={styles.kvKey}>UTM source</Text>
            <Text style={styles.kvValue}>{lead.utm_source}</Text>
          </View>
        ) : null}
        {lead.admin_notes ? (
          <View style={styles.kvRow}>
            <Text style={styles.kvKey}>Admin notes</Text>
            <Text style={styles.kvValue}>{lead.admin_notes}</Text>
          </View>
        ) : null}
        {lead.archive_reason ? (
          <View style={styles.kvRow}>
            <Text style={styles.kvKey}>Archive reason</Text>
            <Text style={styles.kvValue}>{lead.archive_reason}</Text>
          </View>
        ) : null}
      </View>

      {lead.status !== 'archived' ? (
        <Button
          variant="danger"
          onPress={() => setArchiveOpen(true)}
          style={{ marginTop: 4 }}
        >
          Archive candidate
        </Button>
      ) : null}

      <ArchiveLeadModal
        visible={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        onSubmit={(reason, note) => {
          updateStage.mutate(
            { status: 'archived', archive_reason: reason, admin_notes: note || undefined },
            { onSuccess: () => setArchiveOpen(false) },
          );
        }}
        loading={updateStage.isPending}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1F5F9' },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  header: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 2,
  },
  name: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  contactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  contactPressed: { backgroundColor: '#E2E8F0' },
  contactText: { fontSize: 12, color: '#0F172A', fontWeight: '600', maxWidth: 180 },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#64748B',
  },
  kvRow: { paddingVertical: 4 },
  kvKey: { fontSize: 12, color: '#64748B', fontWeight: '600', textTransform: 'capitalize' },
  kvValue: { fontSize: 14, color: '#0F172A', marginTop: 2, lineHeight: 20 },
  emptyText: { fontSize: 13, color: '#64748B' },
});
