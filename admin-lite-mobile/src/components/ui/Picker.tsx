import { View, Text, StyleSheet } from 'react-native';
import { Picker as RNPicker } from '@react-native-picker/picker';

export interface PickerOption {
  value: string;
  label: string;
}

export default function Picker({
  label,
  value,
  options,
  onChange,
}: {
  label?: string;
  value: string;
  options: PickerOption[];
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.box}>
        <RNPicker
          selectedValue={value}
          onValueChange={(v) => onChange(String(v))}
          style={styles.picker}
          dropdownIconColor="#64748B"
          mode="dropdown"
        >
          {options.map((opt) => (
            <RNPicker.Item
              key={opt.value || '_empty'}
              value={opt.value}
              label={opt.label}
            />
          ))}
        </RNPicker>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 4 },
  label: { fontSize: 13, fontWeight: '600', color: '#0F172A', marginBottom: 6 },
  box: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    overflow: 'hidden',
  },
  picker: { height: 50, color: '#0F172A' },
});
