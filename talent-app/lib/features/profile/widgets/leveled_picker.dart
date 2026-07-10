import 'package:flutter/material.dart';
import '../../../core/theme.dart';
import '../../../models/profile_extras.dart';

/// Pick items from a template list, each with a 1–5 proficiency level. Options
/// are grouped by their `group` (null → a single flat list). Mirrors the web
/// `DesignerExtras` leveled selector.
class LeveledPicker extends StatelessWidget {
  final List<TemplateItem> options;
  final List<LeveledItem> value;
  final ValueChanged<List<LeveledItem>> onChanged;

  const LeveledPicker({
    super.key,
    required this.options,
    required this.value,
    required this.onChanged,
  });

  int _indexOf(String name) => value.indexWhere((e) => e.name == name);

  void _toggle(String name, bool on) {
    final next = [...value];
    final i = _indexOf(name);
    if (on && i < 0) {
      next.add(LeveledItem(name: name, level: 3));
    } else if (!on && i >= 0) {
      next.removeAt(i);
    }
    onChanged(next);
  }

  void _setLevel(String name, int level) {
    final next = [...value];
    final i = _indexOf(name);
    if (i >= 0) next[i] = LeveledItem(name: name, level: level);
    onChanged(next);
  }

  @override
  Widget build(BuildContext context) {
    // Preserve option order; group by `group`.
    final groups = <String?, List<TemplateItem>>{};
    for (final o in options) {
      groups.putIfAbsent(o.group, () => []).add(o);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final entry in groups.entries) ...[
          if (entry.key != null && entry.key!.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8, bottom: 4),
              child: Text(
                entry.key!.toUpperCase(),
                style: const TextStyle(
                  color: AppColors.textTertiary,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.5,
                ),
              ),
            ),
          for (final o in entry.value) _row(o),
        ],
        if (options.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 8),
            child: Text('Nothing to pick here.',
                style: TextStyle(color: AppColors.textTertiary, fontSize: 13)),
          ),
      ],
    );
  }

  Widget _row(TemplateItem o) {
    final i = _indexOf(o.name);
    final selected = i >= 0;
    final level = selected ? value[i].level : 0;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            onTap: () => _toggle(o.name, !selected),
            child: Row(
              children: [
                Icon(
                  selected ? Icons.check_box : Icons.check_box_outline_blank,
                  size: 20,
                  color: selected ? AppColors.primary : AppColors.textTertiary,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    o.name,
                    style: TextStyle(
                      fontSize: 14,
                      color: selected ? AppColors.textPrimary : AppColors.textSecondary,
                      fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (selected)
            Padding(
              padding: const EdgeInsets.only(left: 30, top: 4, bottom: 6),
              child: Row(
                children: [
                  for (int lvl = 1; lvl <= 5; lvl++)
                    Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: GestureDetector(
                        onTap: () => _setLevel(o.name, lvl),
                        child: Container(
                          width: 30,
                          height: 26,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: lvl <= level
                                ? AppColors.primary
                                : AppColors.surface,
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(
                              color: lvl <= level ? AppColors.primary : AppColors.border,
                            ),
                          ),
                          child: Text(
                            '$lvl',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: lvl <= level ? Colors.white : AppColors.textTertiary,
                            ),
                          ),
                        ),
                      ),
                    ),
                  const SizedBox(width: 4),
                  Text(
                    kLevelLabels[(level - 1).clamp(0, 4)],
                    style: const TextStyle(color: AppColors.textTertiary, fontSize: 12),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
