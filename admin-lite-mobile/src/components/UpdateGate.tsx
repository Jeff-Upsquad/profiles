import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUpdateStore } from '../stores/updateStore';

/**
 * App-level **blocking** modal for forced updates only. Mounted at the root so
 * it gates every screen until the user installs. Optional updates surface as the
 * inline UpdateCard, so this renders nothing unless a forced update is pending.
 * Mirrors the partner app's UpdateGate. Not dismissible (back press is a no-op).
 */
export default function UpdateGate() {
  const { manifest, isForce, progress, downloading, error, onUpdate } =
    useUpdateStore();

  const visible = !!manifest && isForce;
  if (!visible) return null;
  const notes = manifest.release_notes.trim();

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.badge}>
              <Ionicons name="cloud-download" size={22} color="#ffffff" />
            </View>
            <Text style={styles.title}>Update required</Text>
          </View>

          <Text style={styles.body}>
            A newer version ({manifest.version_name}) is required to keep using
            Admin Lite.
          </Text>
          {notes.length > 0 && <Text style={styles.notes}>{notes}</Text>}

          {downloading && (
            <View style={styles.progressWrap}>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.round((progress ?? 0) * 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressLabel}>
                {progress != null
                  ? `Downloading… ${Math.round(progress * 100)}%`
                  : 'Preparing…'}
              </Text>
            </View>
          )}

          {error != null && <Text style={styles.error}>{error}</Text>}

          <Pressable
            onPress={onUpdate}
            disabled={downloading}
            style={[styles.updateBtn, downloading && styles.updateBtnDisabled]}
          >
            {downloading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons name="download-outline" size={18} color="#ffffff" />
            )}
            <Text style={styles.updateText}>
              {downloading ? 'Updating…' : 'Update now'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  title: { flex: 1, fontSize: 18, fontWeight: '800', color: '#0F172A' },
  body: { fontSize: 14, color: '#64748B' },
  notes: { fontSize: 13, color: '#94A3B8', marginTop: 8 },
  progressWrap: { marginTop: 20 },
  progressTrack: {
    height: 6,
    borderRadius: 99,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  progressFill: { height: 6, borderRadius: 99, backgroundColor: '#4F46E5' },
  progressLabel: { fontSize: 12, color: '#94A3B8', marginTop: 6 },
  error: { fontSize: 13, color: '#DC2626', marginTop: 12 },
  updateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 20,
  },
  updateBtnDisabled: { backgroundColor: '#94A3B8' },
  updateText: { fontSize: 15, fontWeight: '800', color: '#ffffff' },
});
