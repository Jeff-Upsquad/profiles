import 'package:intl/intl.dart';

// ─── Price ───────────────────────────────────────────────────────────────────

String formatPrice(num? amount, String? currency) {
  if (amount == null) return '';
  final cur = (currency != null && currency.isNotEmpty) ? currency : 'INR';
  try {
    final format = NumberFormat.simpleCurrency(name: cur, decimalDigits: 0);
    return format.format(amount);
  } catch (_) {
    return '$cur ${amount.toStringAsFixed(0)}';
  }
}

// ─── Relative expiry ─────────────────────────────────────────────────────────

/// "in 3 days" / "5 hours ago" / "in 20 minutes". Mirrors the web's
/// Intl.RelativeTimeFormat usage for the "Expires …" line.
String? formatRelativeExpiry(String? iso) {
  if (iso == null || iso.isEmpty) return null;
  final d = DateTime.tryParse(iso);
  if (d == null) return null;

  final diff = d.difference(DateTime.now());
  final abs = diff.abs();

  if (abs.inHours < 1) return _relative(diff.inMinutes, 'minute');
  if (abs.inDays < 1) return _relative(diff.inHours, 'hour');
  return _relative(diff.inDays, 'day');
}

String _relative(int value, String unit) {
  if (value == 0) return 'now';
  final plural = value.abs() == 1 ? unit : '${unit}s';
  return value > 0 ? 'in $value $plural' : '${value.abs()} $plural ago';
}

// ─── Working-day ordering ────────────────────────────────────────────────────

const List<String> _weekOrder = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'];

int weekIndex(String day) {
  final key = day.trim().toLowerCase();
  final prefix = key.length >= 2 ? key.substring(0, 2) : key;
  final i = _weekOrder.indexOf(prefix);
  return i == -1 ? _weekOrder.length : i;
}

bool isWeekend(String day) {
  final i = weekIndex(day);
  return i == 5 || i == 6;
}

// ─── Day grouping (Today / Yesterday / date) ─────────────────────────────────

final DateFormat _dayFormatter = DateFormat('MMM d, yyyy');
final DateFormat _timeFormatter = DateFormat('h:mm a');

String dayLabel(String? iso) {
  if (iso == null || iso.isEmpty) return 'Unknown date';
  final d = DateTime.tryParse(iso);
  if (d == null) return 'Unknown date';
  final local = d.toLocal();
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final that = DateTime(local.year, local.month, local.day);
  final diffDays = today.difference(that).inDays;
  if (diffDays == 0) return 'Today';
  if (diffDays == 1) return 'Yesterday';
  return _dayFormatter.format(local);
}

String dayKey(String? iso) {
  if (iso == null || iso.isEmpty) return 'unknown';
  final d = DateTime.tryParse(iso);
  if (d == null) return 'unknown';
  final local = d.toLocal();
  final m = local.month.toString().padLeft(2, '0');
  final day = local.day.toString().padLeft(2, '0');
  return '${local.year}-$m-$day';
}

String timeLabel(String? iso) {
  if (iso == null || iso.isEmpty) return '';
  final d = DateTime.tryParse(iso);
  if (d == null) return '';
  return _timeFormatter.format(d.toLocal());
}
