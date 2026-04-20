import { TextInput, View, Text, StyleSheet, TextInputProps } from 'react-native';

interface Props extends TextInputProps {
  label?: string;
  error?: string;
}

export default function Textarea({ label, error, style, ...rest }: Props) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        placeholderTextColor="#94A3B8"
        style={[styles.input, error ? styles.inputError : null, style as any]}
        {...rest}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 4 },
  label: { fontSize: 13, fontWeight: '600', color: '#0F172A', marginBottom: 6 },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#0F172A',
    minHeight: 96,
  },
  inputError: { borderColor: '#DC2626' },
  error: { marginTop: 4, fontSize: 12, color: '#DC2626' },
});
