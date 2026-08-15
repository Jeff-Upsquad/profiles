/// Maps a web `link_url` (from a notification) or an FCM `route` payload to an
/// in-app router path. Returns null when there's no matching native surface.
String? mapNotificationRoute(String? linkOrRoute) {
  final raw = (linkOrRoute ?? '').trim();
  if (raw.isEmpty) return null;

  // Already an app route.
  const appRoots = [
    '/home', '/jobs', '/offers', '/notifications', '/more',
    '/job/', '/job-profile/', '/interview/', '/offer/', '/messages',
  ];
  for (final r in appRoots) {
    if (raw == r || raw.startsWith(r)) return raw;
  }

  // Strip any origin, then the query string.
  final path = raw.replaceFirst(RegExp(r'^https?://[^/]+'), '').split('?').first;

  final interview = RegExp(r'/job-openings/interviews/([^/]+)').firstMatch(path);
  if (interview != null) return '/interview/${interview.group(1)}';

  final offer = RegExp(r'/job-openings/offers/([^/]+)').firstMatch(path);
  if (offer != null) return '/offer/${offer.group(1)}';

  final profile = RegExp(r'/job-openings/profiles/([^/]+)').firstMatch(path);
  if (profile != null) return '/job-profile/${profile.group(1)}';

  final job = RegExp(r'/job-openings/([^/]+)/?$').firstMatch(path);
  if (job != null && job.group(1) != 'interviews' && job.group(1) != 'offers') {
    return '/job/${job.group(1)}';
  }

  if (path.contains('/job-openings')) return '/jobs';
  if (path.contains('/subscriptions') || path.contains('/assignments')) {
    return '/offers';
  }
  if (path.contains('/my-clients')) return '/more/my-clients';
  final intro = RegExp(r'/talent/messages/([^/]+)').firstMatch(path);
  if (intro != null) return '/messages/${intro.group(1)}';
  if (path.contains('/messages')) return '/messages';

  if (path.contains('/notifications')) return '/notifications';
  if (path.contains('/training')) return '/more/training';
  if (path.contains('/dashboard')) return '/home';
  return null;
}
