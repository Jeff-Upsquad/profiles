import { Pressable, Text, View, StyleSheet, ScrollView } from 'react-native';

export interface TabOption {
  value: string;
  label: string;
}

export default function Tabs({
  options,
  value,
  onChange,
  scrollable = false,
}: {
  options: TabOption[];
  value: string;
  onChange: (value: string) => void;
  scrollable?: boolean;
}) {
  const row = (
    <View style={styles.row}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value || 'all'}
            onPress={() => onChange(opt.value)}
            style={[styles.tab, active ? styles.tabActive : null]}
          >
            <Text style={[styles.label, active ? styles.labelActive : null]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  if (scrollable) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
      >
        {row}
      </ScrollView>
    );
  }
  return row;
}

const styles = StyleSheet.create({
  scrollContainer: { paddingHorizontal: 16 },
  row: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    padding: 4,
    borderRadius: 10,
    alignSelf: 'flex-start',
    gap: 2,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  label: { fontSize: 13, fontWeight: '500', color: '#64748B' },
  labelActive: { color: '#0F172A' },
});
