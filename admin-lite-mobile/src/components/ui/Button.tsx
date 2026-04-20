import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  View,
} from 'react-native';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

export default function Button({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        sizeStyles[size],
        variantStyles[variant].base,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variantStyles[variant].spinnerColor} size="small" />
      ) : (
        <View style={styles.content}>
          {typeof children === 'string' ? (
            <Text style={[styles.text, sizeTextStyles[size], variantStyles[variant].text]}>
              {children}
            </Text>
          ) : (
            children
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  text: { fontWeight: '600' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
});

const sizeStyles: Record<Size, ViewStyle> = {
  sm: { paddingVertical: 6, paddingHorizontal: 12 },
  md: { paddingVertical: 10, paddingHorizontal: 16 },
  lg: { paddingVertical: 14, paddingHorizontal: 20 },
};

const sizeTextStyles: Record<Size, { fontSize: number }> = {
  sm: { fontSize: 13 },
  md: { fontSize: 14 },
  lg: { fontSize: 16 },
};

const variantStyles: Record<Variant, { base: ViewStyle; text: { color: string }; spinnerColor: string }> = {
  primary: {
    base: { backgroundColor: '#4F46E5' },
    text: { color: '#ffffff' },
    spinnerColor: '#ffffff',
  },
  secondary: {
    base: { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#CBD5E1' },
    text: { color: '#0F172A' },
    spinnerColor: '#0F172A',
  },
  danger: {
    base: { backgroundColor: '#DC2626' },
    text: { color: '#ffffff' },
    spinnerColor: '#ffffff',
  },
  ghost: {
    base: { backgroundColor: 'transparent' },
    text: { color: '#4F46E5' },
    spinnerColor: '#4F46E5',
  },
};
