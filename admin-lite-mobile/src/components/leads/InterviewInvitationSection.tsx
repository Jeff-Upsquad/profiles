import { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import ShareInviteModal from '../interview/ShareInviteModal';
import { formatDate, formatDateTime } from '../../lib/formatDate';

interface Invitation {
  id: string;
  token: string;
  expires_at: string;
  submitted_at: string | null;
  responses: Record<string, any> | null;
  created_at: string;
}

interface InvitationResponse {
  invitation: Invitation | null;
  url?: string;
}

export default function InterviewInvitationSection({
  leadId,
  leadName,
  leadPhone,
  formType,
}: {
  leadId: string;
  leadName: string;
  leadPhone: string;
  formType: string;
}) {
  const queryClient = useQueryClient();
  const [shareOpen, setShareOpen] = useState(false);
  const [shareData, setShareData] = useState<{ url: string; message: string } | null>(null);

  const { data, isLoading } = useQuery<InvitationResponse>({
    queryKey: ['interview-invitation', leadId],
    queryFn: async () => {
      const { data } = await api.get(`/admin/leads/${leadId}/interview-invitation`);
      return data;
    },
    enabled: !!leadId,
  });

  const generate = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/admin/leads/${leadId}/interview-invitation`);
      return data as { url: string; share_message: string; invitation: Invitation };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['interview-invitation', leadId] });
      setShareData({ url: result.url, message: result.share_message });
      setShareOpen(true);
    },
  });

  function openShareExisting() {
    if (!data?.url || !data.invitation) return;
    const message =
      `Hi ${leadName},\n\n` +
      `Thanks for your interest in joining Upsquad. Please answer a few quick questions so we can move to the next step:\n\n` +
      `${data.url}\n\n` +
      `This link is valid for 7 days.\n` +
      `Know more about us: https://www.upsquadconnect.com`;
    setShareData({ url: data.url, message });
    setShareOpen(true);
  }

  const invitation = data?.invitation;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>First-level interview</Text>
          <Text style={styles.subtitle}>
            Share a questionnaire to pre-screen before scheduling a call.
          </Text>
        </View>
        <Button
          size="sm"
          loading={generate.isPending}
          onPress={() => generate.mutate()}
        >
          {invitation && !invitation.submitted_at ? 'Regenerate' : 'Generate'}
        </Button>
      </View>

      {isLoading ? (
        <ActivityIndicator color="#4F46E5" style={{ paddingVertical: 12 }} />
      ) : !invitation ? (
        <Text style={styles.note}>
          No interview link has been shared with this candidate yet.
        </Text>
      ) : invitation.submitted_at ? (
        <View style={{ gap: 8 }}>
          <View style={styles.statusRow}>
            <Badge color="green">Submitted</Badge>
            <Text style={styles.meta}>
              {formatDateTime(invitation.submitted_at)}
            </Text>
          </View>
          {Object.entries(invitation.responses ?? {}).map(([qid, answer]) => (
            <View key={qid} style={styles.responseRow}>
              <Text style={styles.responseQ}>{qid}</Text>
              <Text style={styles.responseA}>
                {typeof answer === 'boolean' ? (answer ? 'Confirmed' : 'Not confirmed') : String(answer)}
              </Text>
            </View>
          ))}
        </View>
      ) : new Date(invitation.expires_at).getTime() < Date.now() ? (
        <View style={styles.statusRow}>
          <Badge color="red">Expired</Badge>
          <Text style={styles.meta}>
            Expired {formatDate(invitation.expires_at)}
          </Text>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          <View style={styles.statusRow}>
            <Badge color="yellow">Pending</Badge>
            <Text style={styles.meta}>
              Expires {formatDate(invitation.expires_at)}
            </Text>
          </View>
          <Button variant="secondary" size="sm" onPress={openShareExisting}>
            View / copy link
          </Button>
        </View>
      )}

      {shareData ? (
        <ShareInviteModal
          visible={shareOpen}
          onClose={() => setShareOpen(false)}
          url={shareData.url}
          shareMessage={shareData.message}
          leadPhone={leadPhone}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  subtitle: { fontSize: 12, color: '#64748B', marginTop: 2 },
  note: { fontSize: 13, color: '#64748B' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  meta: { fontSize: 12, color: '#64748B' },
  responseRow: { paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E2E8F0' },
  responseQ: { fontSize: 11, color: '#64748B', textTransform: 'uppercase', fontWeight: '600' },
  responseA: { fontSize: 13, color: '#0F172A', marginTop: 2 },
});
