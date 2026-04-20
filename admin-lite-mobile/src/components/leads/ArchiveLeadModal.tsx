import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Modal from '../ui/Modal';
import Picker from '../ui/Picker';
import Textarea from '../ui/Textarea';
import Button from '../ui/Button';
import { ARCHIVE_REASONS } from '../../constants/leads';

export default function ArchiveLeadModal({
  visible,
  onClose,
  onSubmit,
  loading,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: string, note: string) => void;
  loading?: boolean;
}) {
  const [reason, setReason] = useState(ARCHIVE_REASONS[0]);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!visible) {
      setReason(ARCHIVE_REASONS[0]);
      setNote('');
    }
  }, [visible]);

  const options = ARCHIVE_REASONS.map((r) => ({ value: r, label: r }));

  return (
    <Modal visible={visible} onClose={onClose} title="Archive candidate">
      <Text style={styles.helper}>
        Archiving hides this candidate from the active list. You can still find them
        by filtering for "Archived".
      </Text>
      <Picker label="Reason" value={reason} options={options} onChange={setReason} />
      <Textarea
        label="Note (optional)"
        value={note}
        onChangeText={setNote}
        placeholder="Any additional context for the team…"
      />
      <View style={styles.actions}>
        <Button variant="secondary" onPress={onClose}>Cancel</Button>
        <Button
          variant="danger"
          onPress={() => onSubmit(reason, note.trim())}
          loading={loading}
        >
          Archive
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
