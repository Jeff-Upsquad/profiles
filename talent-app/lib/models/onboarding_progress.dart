import '../core/json.dart';

/// The 5-stage onboarding strip shown on the dashboard.
/// Mirrors `OnboardingProgress` (src/hooks/useOnboardingProgress.ts).
class OnboardingProgress {
  final bool signedUp;
  final bool onboardingCompleted;
  final bool basicProfileCompleted;
  final bool jobProfileCompleted;
  final bool portfolioCompleted;

  const OnboardingProgress({
    this.signedUp = false,
    this.onboardingCompleted = false,
    this.basicProfileCompleted = false,
    this.jobProfileCompleted = false,
    this.portfolioCompleted = false,
  });

  factory OnboardingProgress.fromJson(Map<String, dynamic> json) {
    // Endpoint wraps the flags in `progress`; tolerate a flat shape too.
    final p = json['progress'] is Map ? asObject(json['progress']) : json;
    return OnboardingProgress(
      signedUp: asBool(p['signed_up']),
      onboardingCompleted: asBool(p['onboarding_completed']),
      basicProfileCompleted: asBool(p['basic_profile_completed']),
      jobProfileCompleted: asBool(p['job_profile_completed']),
      portfolioCompleted: asBool(p['portfolio_completed']),
    );
  }

  /// Ordered (label, done) stages for the strip.
  List<({String label, bool done})> get stages => [
        (label: 'Sign up', done: signedUp),
        (label: 'Training', done: onboardingCompleted),
        (label: 'Basic profile', done: basicProfileCompleted),
        (label: 'Job profile', done: jobProfileCompleted),
        (label: 'Portfolio', done: portfolioCompleted),
      ];

  int get completed => stages.where((s) => s.done).length;
  int get total => stages.length;
  bool get allDone => completed == total;
}
