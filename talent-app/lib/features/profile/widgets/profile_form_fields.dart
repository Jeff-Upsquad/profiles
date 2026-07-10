import 'package:flutter/material.dart';
import '../../../core/india_locations.dart';
import '../../../core/theme.dart';
import '../../../models/job_preferences.dart';

/// A labelled text field. Uses [controller] when given, otherwise seeds from
/// [value] once (parent owns the value via [onChanged]).
class LabeledField extends StatelessWidget {
  final String label;
  final String value;
  final TextEditingController? controller;
  final ValueChanged<String>? onChanged;
  final TextInputType? keyboardType;
  final int maxLines;
  final TextCapitalization textCapitalization;

  const LabeledField({
    super.key,
    required this.label,
    this.value = '',
    this.controller,
    this.onChanged,
    this.keyboardType,
    this.maxLines = 1,
    this.textCapitalization = TextCapitalization.none,
  });

  @override
  Widget build(BuildContext context) {
    if (controller != null) {
      return TextField(
        controller: controller,
        onChanged: onChanged,
        keyboardType: keyboardType,
        maxLines: maxLines,
        textCapitalization: textCapitalization,
        decoration: InputDecoration(labelText: label),
      );
    }
    return TextFormField(
      initialValue: value,
      onChanged: onChanged,
      keyboardType: keyboardType,
      maxLines: maxLines,
      textCapitalization: textCapitalization,
      decoration: InputDecoration(labelText: label),
    );
  }
}

/// A dropdown form field. Guards against a value not present in [items].
class DropdownField<T> extends StatelessWidget {
  final String label;
  final T? value;
  final List<T> items;
  final ValueChanged<T?> onChanged;
  final String Function(T)? itemLabel;

  const DropdownField({
    super.key,
    required this.label,
    required this.value,
    required this.items,
    required this.onChanged,
    this.itemLabel,
  });

  @override
  Widget build(BuildContext context) {
    final safe = (value != null && items.contains(value)) ? value : null;
    return DropdownButtonFormField<T>(
      initialValue: safe,
      isExpanded: true,
      decoration: InputDecoration(labelText: label),
      items: [
        for (final item in items)
          DropdownMenuItem(
            value: item,
            child: Text(itemLabel != null ? itemLabel!(item) : '$item'),
          ),
      ],
      onChanged: onChanged,
    );
  }
}

/// A wrap of toggleable filter chips backed by a `(value, label)` option list.
class MultiSelectChips extends StatelessWidget {
  final List<({String value, String label})> options;
  final List<String> selected;
  final ValueChanged<List<String>> onChanged;

  const MultiSelectChips({
    super.key,
    required this.options,
    required this.selected,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final o in options)
          FilterChip(
            label: Text(o.label),
            selected: selected.contains(o.value),
            onSelected: (on) {
              final next = [...selected];
              if (on) {
                if (!next.contains(o.value)) next.add(o.value);
              } else {
                next.remove(o.value);
              }
              onChanged(next);
            },
            selectedColor: AppColors.primary.withValues(alpha: 0.12),
            checkmarkColor: AppColors.primary,
            labelStyle: TextStyle(
              color: selected.contains(o.value) ? AppColors.primary : AppColors.textSecondary,
              fontWeight: FontWeight.w600,
              fontSize: 13,
            ),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
              side: BorderSide(
                color: selected.contains(o.value) ? AppColors.primary : AppColors.border,
              ),
            ),
            backgroundColor: Colors.white,
            showCheckmark: false,
          ),
      ],
    );
  }
}

/// A repeatable group of form rows with add/remove controls.
class RepeatableList extends StatelessWidget {
  final List<dynamic> items;
  final Widget Function(int index) itemBuilder;
  final VoidCallback onAdd;
  final ValueChanged<int> onRemove;
  final String addLabel;
  final String emptyLabel;

  const RepeatableList({
    super.key,
    required this.items,
    required this.itemBuilder,
    required this.onAdd,
    required this.onRemove,
    required this.addLabel,
    required this.emptyLabel,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (items.isEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(emptyLabel,
                style: const TextStyle(color: AppColors.textTertiary, fontSize: 13)),
          ),
        for (int i = 0; i < items.length; i++)
          Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Align(
                  alignment: Alignment.centerRight,
                  child: InkWell(
                    onTap: () => onRemove(i),
                    child: const Padding(
                      padding: EdgeInsets.all(2),
                      child: Icon(Icons.close, size: 18, color: AppColors.textTertiary),
                    ),
                  ),
                ),
                itemBuilder(i),
              ],
            ),
          ),
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton.icon(
            onPressed: onAdd,
            icon: const Icon(Icons.add, size: 18),
            label: Text(addLabel),
          ),
        ),
      ],
    );
  }
}

/// From (year/month) → To (year/month) selectors used by education/experience.
class FromToRow extends StatelessWidget {
  final int? fromYear;
  final int? fromMonth;
  final int? toYear;
  final int? toMonth;
  final void Function(int? fy, int? fm, int? ty, int? tm) onChanged;

  const FromToRow({
    super.key,
    required this.fromYear,
    required this.fromMonth,
    required this.toYear,
    required this.toMonth,
    required this.onChanged,
  });

  static const _months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  @override
  Widget build(BuildContext context) {
    final years = [for (int y = DateTime.now().year; y >= 1980; y--) y];
    final months = [for (int m = 1; m <= 12; m++) m];

    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: DropdownField<int>(
                label: 'From year',
                value: fromYear,
                items: years,
                onChanged: (v) => onChanged(v, fromMonth, toYear, toMonth),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: DropdownField<int>(
                label: 'Month',
                value: fromMonth,
                items: months,
                itemLabel: (m) => _months[m - 1],
                onChanged: (v) => onChanged(fromYear, v, toYear, toMonth),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: DropdownField<int>(
                label: 'To year',
                value: toYear,
                items: years,
                onChanged: (v) => onChanged(fromYear, fromMonth, v, toMonth),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: DropdownField<int>(
                label: 'Month',
                value: toMonth,
                items: months,
                itemLabel: (m) => _months[m - 1],
                onChanged: (v) => onChanged(fromYear, fromMonth, toYear, v),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

/// A simplified preferred-locations editor. Each row is one (country, state)
/// with comma-separated districts + cities; rows are grouped by country into
/// the nested `PreferredLocation[]` the API expects.
class PreferredLocationsEditor extends StatefulWidget {
  final List<PreferredLocation> value;
  final ValueChanged<List<PreferredLocation>> onChanged;

  const PreferredLocationsEditor({
    super.key,
    required this.value,
    required this.onChanged,
  });

  @override
  State<PreferredLocationsEditor> createState() => _PreferredLocationsEditorState();
}

class _LocRow {
  String country;
  String state;
  String districts;
  String cities;
  _LocRow({this.country = 'India', this.state = '', this.districts = '', this.cities = ''});
}

class _PreferredLocationsEditorState extends State<PreferredLocationsEditor> {
  late List<_LocRow> _rows;

  @override
  void initState() {
    super.initState();
    _rows = [];
    for (final loc in widget.value) {
      if (loc.states.isEmpty) {
        _rows.add(_LocRow(country: loc.country));
      } else {
        for (final s in loc.states) {
          _rows.add(_LocRow(
            country: loc.country,
            state: s.state,
            districts: s.districts.join(', '),
            cities: s.cities.join(', '),
          ));
        }
      }
    }
  }

  List<String> _csv(String s) =>
      s.split(',').map((e) => e.trim()).where((e) => e.isNotEmpty).toList();

  void _emit() {
    final byCountry = <String, List<PreferredLocationState>>{};
    for (final r in _rows) {
      if (r.country.isEmpty) continue;
      byCountry.putIfAbsent(r.country, () => []);
      if (r.state.isNotEmpty || r.districts.isNotEmpty || r.cities.isNotEmpty) {
        byCountry[r.country]!.add(PreferredLocationState(
          state: r.state,
          districts: _csv(r.districts),
          cities: _csv(r.cities),
        ));
      }
    }
    widget.onChanged([
      for (final e in byCountry.entries)
        PreferredLocation(country: e.key, states: e.value),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (int i = 0; i < _rows.length; i++)
          Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              children: [
                Align(
                  alignment: Alignment.centerRight,
                  child: InkWell(
                    onTap: () => setState(() {
                      _rows.removeAt(i);
                      _emit();
                    }),
                    child: const Icon(Icons.close, size: 18, color: AppColors.textTertiary),
                  ),
                ),
                DropdownField<String>(
                  label: 'Country',
                  value: _rows[i].country.isEmpty ? null : _rows[i].country,
                  items: kCountries,
                  onChanged: (v) => setState(() {
                    _rows[i].country = v ?? '';
                    _emit();
                  }),
                ),
                const SizedBox(height: 10),
                if (_rows[i].country == 'India')
                  DropdownField<String>(
                    label: 'State',
                    value: _rows[i].state.isEmpty ? null : _rows[i].state,
                    items: kIndianStates,
                    onChanged: (v) => setState(() {
                      _rows[i].state = v ?? '';
                      _emit();
                    }),
                  )
                else
                  LabeledField(
                    key: ValueKey('state_$i'),
                    label: 'State',
                    value: _rows[i].state,
                    onChanged: (v) {
                      _rows[i].state = v;
                      _emit();
                    },
                  ),
                const SizedBox(height: 10),
                LabeledField(
                  key: ValueKey('districts_$i'),
                  label: 'Districts (comma separated)',
                  value: _rows[i].districts,
                  onChanged: (v) {
                    _rows[i].districts = v;
                    _emit();
                  },
                ),
                const SizedBox(height: 10),
                LabeledField(
                  key: ValueKey('cities_$i'),
                  label: 'Cities (comma separated)',
                  value: _rows[i].cities,
                  onChanged: (v) {
                    _rows[i].cities = v;
                    _emit();
                  },
                ),
              ],
            ),
          ),
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton.icon(
            onPressed: () => setState(() => _rows.add(_LocRow())),
            icon: const Icon(Icons.add, size: 18),
            label: const Text('Add location'),
          ),
        ),
      ],
    );
  }
}

/// A sticky bottom save bar.
class SaveBar extends StatelessWidget {
  final bool saving;
  final VoidCallback onSave;
  final String label;

  const SaveBar({
    super.key,
    required this.saving,
    required this.onSave,
    this.label = 'Save',
  });

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: AppColors.border)),
        ),
        child: SizedBox(
          height: 48,
          child: ElevatedButton(
            onPressed: saving ? null : onSave,
            child: saving
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white),
                  )
                : Text(label),
          ),
        ),
      ),
    );
  }
}
