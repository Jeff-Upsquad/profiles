import 'package:flutter/material.dart';
import '../core/reference_data.dart';
import '../core/theme.dart';
import '../models/language_entry.dart';

/// Add/remove rows of (language, proficiency). Stateless — the parent owns the
/// list and receives the updated list via [onChanged]. Mirrors the web
/// `LanguagePicker`: a language can only be chosen once.
class LanguagePicker extends StatelessWidget {
  final List<LanguageEntry> value;
  final ValueChanged<List<LanguageEntry>> onChanged;

  const LanguagePicker({super.key, required this.value, required this.onChanged});

  void _add() =>
      onChanged([...value, const LanguageEntry(language: '', proficiency: 'fluent')]);

  void _update(int i, LanguageEntry entry) {
    final next = [...value];
    next[i] = entry;
    onChanged(next);
  }

  void _remove(int i) => onChanged([...value]..removeAt(i));

  @override
  Widget build(BuildContext context) {
    final chosen = value.map((e) => e.language).toSet();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
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
                    initialValue: value[i].proficiency,
                    isExpanded: true,
                    decoration: const InputDecoration(
                      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    ),
                    items: [
                      for (final p in kProficiencyLevels)
                        DropdownMenuItem(value: p.value, child: Text(p.label)),
                    ],
                    onChanged: (v) =>
                        _update(i, value[i].copyWith(proficiency: v ?? 'fluent')),
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
