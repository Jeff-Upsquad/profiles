import { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Modal from '../ui/Modal';
import Textarea from '../ui/Textarea';
import Button from '../ui/Button';

export default function RejectReasonModal({
  visible,
  onClose,
  onSubmit,
  loading,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  loading?: boolean;
}) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!visible) setReason('');
  }, [visible]);

  return (
    <Modal visible={visible} onClose={onClose} title="Reject Profile">
      <Text style={styles.helper}>
        Please provide a reason for rejecting this profile. The talent will see this reason.
      </Text>
      <Textarea
        value={reason}
        onChangeText={setReason}
        placeholder="Enter rejection reason…"
      />
      <View style={styles.actions}>
        <Button variant="secondary" onPress={onClose}>Cancel</Button>
        <Button
          variant="danger"
          onPress={() => onSubmit(reason.trim())}
          loading={loading}
          disabled={!reason.trim()}
        >
          Reject Profile
        </Button>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  helper: { fontSize: 13, color: '#64748B', marginBottom: 12, lineHeight: 18 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
});
