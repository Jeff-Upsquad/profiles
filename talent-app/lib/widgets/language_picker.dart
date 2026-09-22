import 'package:flutter/material.dart';
import '../core/reference_data.dart';
import '../core/theme.dart';
import '../models/language_entry.dart';

/// Add/remove rows of (language, proficiency). Stateless — the parent owns the
/// list and receives the updated list via [onChanged]. Mirrors the web
/// `LanguagePicker`: a language can only be chosen once, and the first
/// language is always the mother tongue (forced to Native).
class LanguagePicker extends StatelessWidget {
  final List<LanguageEntry> value;
  final ValueChanged<List<LanguageEntry>> onChanged;

  const LanguagePicker({super.key, required this.value, required this.onChanged});

  void _add() => onChanged([
        ...value,
        LanguageEntry(
          language: '',
          proficiency: value.isEmpty ? 'native' : 'fluent',
        ),
      ]);

  void _update(int i, LanguageEntry entry) {
    final next = [...value];
    // First row is locked to Native — only the language name is editable.
    next[i] = i == 0 ? entry.copyWith(proficiency: 'native') : entry;
    onChanged(next);
  }

  void _remove(int i) {
    final rest = [...value]..removeAt(i);
    // Promote the new first row to Native so the invariant survives deletion.
    if (i == 0 && rest.isNotEmpty && rest.first.proficiency != 'native') {
      rest[0] = rest.first.copyWith(proficiency: 'native');
    }
    onChanged(rest);
  }

  @override
  Widget build(BuildContext context) {
    final chosen = value.map((e) => e.language).toSet();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Add your mother tongue first — it is always marked Native.',
          style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
        ),
        const SizedBox(height: 8),
        for (int i = 0; i < value.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(
              children: [
                Expanded(
                  flex: 3,
                  child: DropdownButtonFormField<String>(
                    initialValue: value[i].language.isEmpty ? null : value[i].language,
                    isExpanded: true,
                    decoration: const InputDecoration(
                      hintText: 'Language',
                      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    ),
                    items: [
                      for (final l in kLanguages)
                        if (!chosen.contains(l) || l == value[i].language)
                          DropdownMenuItem(value: l, child: Text(l)),
                    ],
                    onChanged: (v) =>
                        _update(i, value[i].copyWith(language: v ?? '')),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  flex: 3,
                  child: DropdownButtonFormField<String>(
                    initialValue: i == 0 ? 'native' : value[i].proficiency,
                    isExpanded: true,
                    decoration: InputDecoration(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      filled: i == 0,
                      fillColor: i == 0 ? AppColors.surface : null,
                      helperText:
                          i == 0 ? 'First language is always Native' : null,
                    ),
                    items: [
                      for (final p in kProficiencyLevels)
                        DropdownMenuItem(value: p.value, child: Text(p.label)),
                    ],
                    // Lock the first row to Native (mother tongue).
                    onChanged: i == 0
                        ? null
                        : (v) => _update(
                            i, value[i].copyWith(proficiency: v ?? 'fluent')),
                  ),
                ),
                IconButton(
                  onPressed: () => _remove(i),
                  icon: const Icon(Icons.close, size: 20, color: AppColors.textTertiary),
                ),
              ],
            ),
          ),
        if (value.length < kLanguages.length)
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: _add,
              icon: const Icon(Icons.add, size: 18),
              label: const Text('Add language'),
            ),
          ),
      ],
    );
  }
}
