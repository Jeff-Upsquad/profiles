import 'package:intl/intl.dart';

/// Date / time / number formatting shared across the app.
///
/// User-facing dates render as "D Month YYYY" (e.g. 8 June 2026); dense list
/// contexts use the compact "8 Jun 2026". All parse tolerantly and treat a
/// bare `YYYY-MM-DD` as local midnight (mirrors the web's `fmtDate`).

final DateFormat _dMMMMy = DateFormat('d MMMM yyyy'); // 8 June 2026
final DateFormat _dMMMy = DateFormat('d MMM yyyy'); // 8 Jun 2026
final DateFormat _dMMM = DateFormat('d MMM'); // 8 Jun
final DateFormat _time = DateFormat('h:mm a'); // 2:30 PM

DateTime? _parse(String? iso) {
  final v = (iso ?? '').trim();
  if (v.isEmpty) return null;
  final s = v.length == 10 ? '${v}T00:00:00' : v;
  return DateTime.tryParse(s);
}

/// "8 June 2026" — the primary user-facing date format.
String formatDate(String? iso) {
  final d = _parse(iso);
  return d == null ? '' : _dMMMMy.format(d.toLocal());
}

/// "8 Jun 2026" — compact, for cards and dense rows.
String formatDateShort(String? iso) {
  final d = _parse(iso);
  return d == null ? '' : _dMMMy.format(d.toLocal());
}

/// "8 Jun, 2:30 PM".
String formatDateTime(String? iso) {
  final d = _parse(iso);
  if (d == null) return '';
  final l = d.toLocal();
  return '${_dMMM.format(l)}, ${_time.format(l)}';
}

/// "2:30 PM".
String formatTime(String? iso) {
  final d = _parse(iso);
  return d == null ? '' : _time.format(d.toLocal());
}

/// Relative "time ago" for feeds/threads: "just now", "5m ago", "3h ago",
/// "2d ago", then falls back to a short date.
String timeAgo(String? iso) {
  final d = _parse(iso);
  if (d == null) return '';
  final diff = DateTime.now().difference(d.toLocal());
  if (diff.inSeconds < 60) return 'just now';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
  if (diff.inHours < 24) return '${diff.inHours}h ago';
  if (diff.inDays < 7) return '${diff.inDays}d ago';
  return formatDateShort(iso);
}

/// "full_time" / "work-from-home" → "Full time" / "Work from home".
String humanize(String? token) {
  final t = (token ?? '').trim();
  if (t.isEmpty) return '';
  final words = t.replaceAll(RegExp(r'[_-]+'), ' ').trim().split(RegExp(r'\s+'));
  return words
      .map((w) => w.isEmpty ? '' : '${w[0].toUpperCase()}${w.substring(1)}')
      .join(' ');
}

/// Up-to-two-letter initials for an avatar; defaults to "T" (talent).
String initialsFor(String? name) {
  final n = (name ?? '').trim();
  if (n.isEmpty) return 'T';
  final parts = n.split(RegExp(r'\s+')).take(2);
  final out = parts.map((p) => p.isEmpty ? '' : p[0].toUpperCase()).join();
  return out.isEmpty ? 'T' : out;
}

/// Crude HTML → plain text for the frozen offer-letter sections (block tags
/// become line breaks, entities are decoded). Good enough until a rich renderer
/// is added.
String htmlToText(String? html) {
  if (html == null || html.isEmpty) return '';
  final s = html
      .replaceAll(RegExp(r'<\s*br\s*/?>', caseSensitive: false), '\n')
      .replaceAll(
          RegExp(r'</\s*(p|div|li|h[1-6]|tr)\s*>', caseSensitive: false), '\n')
      .replaceAll(RegExp(r'<\s*li[^>]*>', caseSensitive: false), '• ')
      .replaceAll(RegExp(r'<[^>]+>'), '')
      .replaceAll('&nbsp;', ' ')
      .replaceAll('&amp;', '&')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&#39;', "'")
      .replaceAll('&quot;', '"');
  return s.replaceAll(RegExp(r'\n{3,}'), '\n\n').trim();
}

/// ₹ for INR (and empty currency), otherwise "USD " style prefix.
String currencySymbol(String? currency) {
  if (currency == null || currency.isEmpty || currency == 'INR') return '₹';
  return '$currency ';
}

final NumberFormat _grouped = NumberFormat.decimalPattern('en_IN');

/// "₹15,000" — a single grouped amount with a currency symbol.
String formatMoney(num? amount, String? currency) {
  if (amount == null) return '';
  return '${currencySymbol(currency)}${_grouped.format(amount)}';
}

/// "₹15,000–₹20,000/mo" — a salary/package range with a period suffix.
/// Collapses to a single amount when min == max or one side is missing.
String? formatSalaryRange(
  num? min,
  num? max,
  String? currency,
  String? period,
) {
  if (min == null && max == null) return null;
  final suffix = (period == 'annual' || period == 'yearly') ? '/yr' : '/mo';
  final lo = min ?? max;
  final hi = max ?? min;
  final range = (lo != null && hi != null && lo != hi)
      ? '${formatMoney(lo, currency)}–${formatMoney(hi, currency)}'
      : formatMoney(lo, currency);
  return '$range$suffix';
}
