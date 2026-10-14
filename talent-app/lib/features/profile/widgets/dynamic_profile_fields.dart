import 'package:flutter/material.dart';
import '../../../core/json.dart';

/// Category definitions are shared with the web profile builder. Keeping the
/// required title/summary here also makes new specialist roles submittable.
class DynamicProfileFields extends StatelessWidget {
  final List<Map<String, dynamic>> fields;
  final Map<String, dynamic> values;
  final void Function(String, dynamic) onChanged;
  const DynamicProfileFields({super.key, required this.fields, required this.values, required this.onChanged});

  @override
  Widget build(BuildContext context) => Column(
    children: fields.where((f) => f['is_active'] != false && f['field_type'] != 'experience').map((field) {
      final key = asString(field['field_key']) ?? '';
      final label = asString(field['field_label']) ?? key;
      final required = field['is_required'] == true;
      final rules = asObject(field['validation_rules']);
      final type = asString(field['field_type']) ?? 'text';
      final options = asObjectList(field['field_options']).where((o) => o['is_active'] != false).toList();
      String? validate(String? raw) {
        final value = raw?.trim() ?? '';
        if (required && value.isEmpty) return '$label is required';
        if (value.isEmpty) return null;
        final min = asInt(rules['minLength']);
        final max = asInt(rules['maxLength']);
        if (min != null && value.length < min) return 'Use at least $min characters';
        if (max != null && value.length > max) return 'Use at most $max characters';
        if ((type == 'number' || type == 'currency') && num.tryParse(value) == null) return 'Enter a number';
        return null;
      }
      final decoration = InputDecoration(labelText: '$label${required ? ' *' : ''}', helperText: asString(field['helper_text']), helperMaxLines: 4, hintText: asString(field['placeholder']));
      Widget input;
      if (type == 'select') {
        final stored = values[key]?.toString();
        final selected = options.any((o) => o['value'] == stored) ? stored : null;
        input = DropdownButtonFormField<String>(
          initialValue: selected,
          decoration: decoration,
          items: options.map((o) => DropdownMenuItem(value: o['value']?.toString() ?? '', child: Text(o['label']?.toString() ?? ''))).toList(),
          onChanged: (v) => onChanged(key, v), validator: validate,
        );
      } else if (type == 'multi_select') {
        final selected = values[key] is List ? List<String>.from(values[key] as List) : <String>[];
        input = FormField<List<String>>(
          initialValue: selected,
          validator: (v) => required && (v == null || v.isEmpty) ? '$label is required' : null,
          builder: (state) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('$label${required ? ' *' : ''}'),
            Wrap(spacing: 8, children: options.map((o) {
              final value = o['value']?.toString() ?? '';
              return FilterChip(label: Text(o['label']?.toString() ?? value), selected: selected.contains(value), onSelected: (on) {
                final next = [...selected];
                on ? next.add(value) : next.remove(value);
                state.didChange(next); onChanged(key, next);
              });
            }).toList()),
            if (state.errorText != null) Text(state.errorText!, style: const TextStyle(color: Colors.red)),
          ]),
        );
      } else {
        input = TextFormField(
          key: ValueKey(key), initialValue: values[key]?.toString() ?? '',
          decoration: decoration, maxLines: type == 'textarea' ? 4 : 1,
          keyboardType: type == 'number' || type == 'currency' ? TextInputType.number : type == 'email' ? TextInputType.emailAddress : type == 'phone' ? TextInputType.phone : TextInputType.text,
          validator: validate,
          onChanged: (v) => onChanged(key, type == 'number' || type == 'currency' ? num.tryParse(v) : v),
        );
      }
      return Padding(padding: const EdgeInsets.only(bottom: 16), child: input);
    }).toList(),
  );
}
