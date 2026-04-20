import { View, Text, StyleSheet, Linking, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import Button from '../ui/Button';
import { cleanPhoneForLink } from '../../lib/phone';

const SIGNUP_URL = 'https://squadhire.upsquadconnect.com/signup/talent';

export default function TalentOnboardingSection({
  leadEmail,
  leadName,
  leadPhone,
}: {
  leadEmail: string | null;
  leadName: string;
  leadPhone: string;
}) {
  const queryClient = useQueryClient();
  const key = ['invitation-check', leadEmail];

  const { data: existing = [] } = useQuery<{ status: string }[]>({
    queryKey: key,
    queryFn: async () => {
      const { data } = await api.get('/admin/invitations', {
        params: { email: leadEmail, role: 'talent', status: 'pending' },
      });
      return data.invitations ?? [];
    },
    enabled: !!leadEmail,
    staleTime: 30_000,
  });

  const invited = existing.length > 0;

  const invite = useMutation({
    mutationFn: async () => {
      if (!leadEmail) throw new Error('Candidate has no email on file');
      await api.post('/admin/invitations', { email: leadEmail, role: 'talent' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
      Alert.alert('Invited', 'They can now sign up as talent.');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error || err.response?.data?.message || err.message;
      if (err.response?.status === 409 || /already|pending/i.test(msg || '')) {
        queryClient.invalidateQueries({ queryKey: key });
        Alert.alert('Already invited', 'An invitation already exists for this email.');
      } else {
        Alert.alert('Invite failed', msg || 'Please try again.');
      }
    },
  });

  function buildMessage() {
    const firstName = leadName.split(' ')[0] || leadName;
    return (
      `Hi ${firstName},\n\n` +
      `Congrats! You've been shortlisted with Upsquad. To complete your profile and unlock your talent dashboard, please sign up${leadEmail ? ` using your email (${leadEmail})` : ''}:\n\n` +
      `${SIGNUP_URL}\n\n` +
      `Know more about us: https://www.upsquadconnect.com`
    );
  }

  async function openWhatsApp() {
    const phone = leadPhone ? cleanPhoneForLink(leadPhone) : '';
    const text = encodeURIComponent(buildMessage());
    const href = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
    const can = await Linking.canOpenURL(href);
    if (can) Linking.openURL(href);
    else Alert.alert('WhatsApp not available');
  }

  async function copy() {
    await Clipboard.setStringAsync(SIGNUP_URL);
    Alert.alert('Copied', 'Signup link copied to clipboard.');
  }

  return (
    <View style={styles.card}>
      <View style={{ gap: 4 }}>
        <Text style={styles.title}>Talent onboarding</Text>
        <Text style={styles.body}>
          Invite this shortlisted candidate to create their talent profile.
        </Text>
      </View>

      {!leadEmail ? (
        <View style={styles.warning}>
          <Text style={styles.warningText}>
            Candidate has no email on file — add one before inviting.
          </Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button
          size="sm"
          onPress={() => invite.mutate()}
          loading={invite.isPending}
          disabled={!leadEmail || invited}
        >
          {invited ? '✓ Invited' : 'Invite as talent'}
        </Button>
        <Button size="sm" variant="secondary" onPress={openWhatsApp}>
          <View style={styles.row}>
            <Ionicons name="logo-whatsapp" size={16} color="#0F172A" />
            <Text style={styles.btnText}>WhatsApp</Text>
          </View>
        </Button>
        <Button size="sm" variant="secondary" onPress={copy}>
          <View style={styles.row}>
            <Ionicons name="copy-outline" size={16} color="#0F172A" />
            <Text style={styles.btnText}>Copy link</Text>
          </View>
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    gap: 10,
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#3730A3',
  },
  body: { fontSize: 13, color: '#1E293B', lineHeight: 18 },
  warning: {
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: 8,
  },
  warningText: { fontSize: 12, color: '#92400E' },
  actions: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  btnText: { color: '#0F172A', fontWeight: '600', fontSize: 13 },
});
