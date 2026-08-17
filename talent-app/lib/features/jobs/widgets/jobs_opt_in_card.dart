import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme.dart';
import '../../../providers/jobs_providers.dart';

/// Shown when the talent has not opted into the jobs marketplace. Opting in
/// with defaults; matching preferences are refined later in Basic Profile.
class JobsOptInCard extends ConsumerStatefulWidget {
  const JobsOptInCard({super.key});

  @override
  ConsumerState<JobsOptInCard> createState() => _JobsOptInCardState();
}

class _JobsOptInCardState extends ConsumerState<JobsOptInCard> {
  bool _busy = false;

  Future<void> _optIn() async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await ref.read(jobsServiceProvider).optIn(const {});
      ref.invalidate(jobOptInProvider);
      invalidateJobs(ref);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("You're in! We'll match you with job openings.")),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not opt in. Please try again.')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 48,
              height: 48,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: AppColors.accentWash,
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Icon(Icons.work_outline, size: 24, color: AppColors.primary),
            ),
            const SizedBox(height: 24),
            Text(
              'Find your next job',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 10),
            const Text(
              'Opt in to get matched with full-time and part-time job openings from businesses hiring on SquadHire. Apply, interview, and get offers — all in one place.',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 14, height: 1.5),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 28),
            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton(
                onPressed: _busy ? null : _optIn,
                child: _busy
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white),
                      )
                    : const Text('Opt in to job openings'),
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'You can opt out any time.',
              style: TextStyle(color: AppColors.textTertiary, fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }
}
