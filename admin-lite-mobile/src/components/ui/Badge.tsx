import { View, Text, StyleSheet } from 'react-native';

type Color = 'blue' | 'yellow' | 'green' | 'red' | 'indigo' | 'gray';

const palette: Record<Color, { bg: string; fg: string }> = {
  blue: { bg: '#DBEAFE', fg: '#1E40AF' },
  yellow: { bg: '#FEF3C7', fg: '#92400E' },
  green: { bg: '#D1FAE5', fg: '#065F46' },
  red: { bg: '#FEE2E2', fg: '#991B1B' },
  indigo: { bg: '#E0E7FF', fg: '#3730A3' },
  gray: { bg: '#F1F5F9', fg: '#334155' },
};

export default function Badge({
  children,
  color = 'gray',
}: {
  children: React.ReactNode;
  color?: Color;
}) {
  const c = palette[color];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.fg }]} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  text: { fontSize: 11, fontWeight: '600' },
});
