import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUpdateStore } from '../stores/updateStore';

function parseReleaseNotes(raw: string): string[] {
  return raw
    .split('\n')
    .map((l) => l.trim().replace(/^[-*•–]\s*/, '').trim())
    .filter((l) => l.length > 0);
}

/**
 * Inline "update available" card for optional updates — sits at the top of the
 * dashboard, just below the header. Mirrors the partner app's UpdateCard:
 * brand-badged header, collapsible "What's new", inline download progress, and
 * Later / Update actions. Forced updates render nothing here (the blocking
 * UpdateGate handles them).
 */
export default function UpdateCard() {
  const { manifest, isForce, progress, downloading, error, onUpdate, dismiss } =
    useUpdateStore();
  const [expanded, setExpanded] = useState(false);

  if (!manifest || isForce) return null;
  const changes = parseReleaseNotes(manifest.release_notes);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.badge}>
          <Ionicons name="cloud-download" size={22} color="#ffffff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Update available</Text>
          <Text style={styles.subtitle}>A new version is ready to install</Text>
        </View>
        <View style={styles.versionChip}>
          <Text style={styles.versionText}>v{manifest.version_name}</Text>
        </View>
      </View>

      {changes.length > 0 && (
        <>
          <Pressable
            style={styles.whatsNewRow}
            onPress={() => setExpanded((v) => !v)}
          >
            <Ionicons name="sparkles-outline" size={16} color="#94A3B8" />
            <Text style={styles.whatsNew}>What's new</Text>
            <Text style={styles.changeCount}>
              {changes.length} change{changes.length === 1 ? '' : 's'}
            </Text>
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={18}
              color="#94A3B8"
            />
          </Pressable>
          {expanded && (
            <View style={styles.changes}>
              {changes.map((line, i) => (
                <View key={i} style={styles.changeRow}>
                  <View style={styles.bullet} />
                  <Text style={styles.changeText}>{line}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}

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

      <View style={styles.actions}>
        <Pressable
          onPress={dismiss}
          disabled={downloading}
          style={styles.laterBtn}
        >
          <Text style={styles.laterText}>Later</Text>
        </Pressable>
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
            {downloading ? 'Updating…' : 'Update'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  title: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  subtitle: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
  versionChip: {
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginLeft: 10,
  },
  versionText: { fontSize: 12, fontWeight: '600', color: '#3730A3' },
  whatsNewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 6,
  },
  whatsNew: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  changeCount: { flex: 1, fontSize: 12, color: '#94A3B8' },
  changes: { paddingTop: 6, paddingHorizontal: 2 },
  changeRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 4 },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#4F46E5',
    marginTop: 7,
    marginRight: 10,
  },
  changeText: { flex: 1, fontSize: 13, color: '#64748B' },
  progressWrap: { marginTop: 16 },
  progressTrack: {
    height: 6,
    borderRadius: 99,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  progressFill: { height: 6, borderRadius: 99, backgroundColor: '#4F46E5' },
  progressLabel: { fontSize: 12, color: '#94A3B8', marginTop: 6 },
  error: { fontSize: 13, color: '#DC2626', marginTop: 12 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 16,
  },
  laterBtn: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 10 },
  laterText: { fontSize: 14, fontWeight: '600', color: '#94A3B8' },
  updateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingHorizontal: 22,
    paddingVertical: 12,
    marginLeft: 8,
  },
  updateBtnDisabled: { backgroundColor: '#94A3B8' },
  updateText: { fontSize: 14, fontWeight: '800', color: '#ffffff' },
});
