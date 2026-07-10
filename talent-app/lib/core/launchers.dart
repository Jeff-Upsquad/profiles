import 'package:url_launcher/url_launcher.dart';

/// External-launch helpers. Each returns whether the launch was handed off to
/// the OS successfully, so callers decide how to surface a failure (usually a
/// SnackBar) — the helpers stay UI-free to avoid `BuildContext`-across-async.

Future<bool> openExternalUrl(String? url) async {
  final raw = (url ?? '').trim();
  if (raw.isEmpty) return false;
  // Bare domains ("acme.com") → assume https.
  final normalized =
      raw.contains('://') || raw.startsWith('mailto:') || raw.startsWith('tel:')
          ? raw
          : 'https://$raw';
  final uri = Uri.tryParse(normalized);
  if (uri == null) return false;
  try {
    return await launchUrl(uri, mode: LaunchMode.externalApplication);
  } catch (_) {
    return false;
  }
}

/// Opens a WhatsApp chat (wa.me) with an optional pre-filled message.
Future<bool> openWhatsApp({required String phone, String? message}) async {
  final digits = phone.replaceAll(RegExp(r'[^0-9]'), '');
  if (digits.isEmpty) return false;
  final query = (message == null || message.trim().isEmpty)
      ? ''
      : '?text=${Uri.encodeComponent(message)}';
  return openExternalUrl('https://wa.me/$digits$query');
}

/// Opens a maps app. Prefers an explicit maps URL, else geocodes the query.
Future<bool> openMaps({String? url, String? query}) async {
  if (url != null && url.trim().isNotEmpty) return openExternalUrl(url);
  final q = (query ?? '').trim();
  if (q.isEmpty) return false;
  return openExternalUrl(
    'https://www.google.com/maps/search/?api=1&query=${Uri.encodeComponent(q)}',
  );
}

Future<bool> dialPhone(String? phone) {
  final digits = (phone ?? '').replaceAll(RegExp(r'[^0-9+]'), '');
  if (digits.isEmpty) return Future.value(false);
  return openExternalUrl('tel:$digits');
}

Future<bool> sendEmail(String? email, {String? subject}) {
  final addr = (email ?? '').trim();
  if (addr.isEmpty) return Future.value(false);
  final q = (subject == null || subject.isEmpty)
      ? ''
      : '?subject=${Uri.encodeComponent(subject)}';
  return openExternalUrl('mailto:$addr$q');
}
