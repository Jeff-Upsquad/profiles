import { View, Text, StyleSheet, Linking, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { cleanPhoneForLink } from '../../lib/phone';

export default function ShareInviteModal({
  visible,
  onClose,
  url,
  shareMessage,
  leadPhone,
}: {
  visible: boolean;
  onClose: () => void;
  url: string;
  shareMessage: string;
  leadPhone?: string;
}) {
  async function copy() {
    await Clipboard.setStringAsync(url);
    Alert.alert('Copied', 'Interview link copied to clipboard.');
  }

  async function openWhatsApp() {
    const phone = leadPhone ? cleanPhoneForLink(leadPhone) : '';
    const text = encodeURIComponent(shareMessage);
    const href = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
    const can = await Linking.canOpenURL(href);
    if (can) {
      Linking.openURL(href);
    } else {
      Alert.alert('WhatsApp not available', 'Could not open WhatsApp on this device.');
    }
  }

  async function shareMore() {
    if (await Sharing.isAvailableAsync()) {
      // expo-sharing shares files by default; for text we fall back to the native share via Linking.
      Linking.openURL(`sms:?&body=${encodeURIComponent(shareMessage)}`);
    } else {
      copy();
    }
  }

  return (
    <Modal visible={visible} onClose={onClose} title="Share interview link">
      <View style={styles.linkBox}>
        <Text style={styles.link} numberOfLines={2} selectable>{url}</Text>
      </View>

      <View style={styles.actions}>
        <Button onPress={openWhatsApp}>
          <View style={styles.row}>
            <Ionicons name="logo-whatsapp" size={16} color="#fff" />
            <Text style={styles.btnLabel}>Share on WhatsApp</Text>
          </View>
        </Button>
        <Button variant="secondary" onPress={copy}>
          <View style={styles.row}>
            <Ionicons name="copy-outline" size={16} color="#0F172A" />
            <Text style={[styles.btnLabel, { color: '#0F172A' }]}>Copy link</Text>
          </View>
        </Button>
        <Button variant="ghost" onPress={shareMore}>Other…</Button>
      </View>

      <Text style={styles.preview}>{shareMessage}</Text>
    </Modal>
  );
}

const styles = StyleSheet.create({
  linkBox: {
    backgroundColor: '#F1F5F9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  link: { fontSize: 12, color: '#4F46E5', fontFamily: 'Courier' },
  actions: { gap: 8, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnLabel: { color: '#ffffff', fontWeight: '600' },
  preview: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
  },
});
