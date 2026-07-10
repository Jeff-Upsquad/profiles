import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';
import '../../models/talent_profile.dart';
import '../../providers/talent_providers.dart';
import '../../widgets/shimmer_loading.dart';
import '../../widgets/ui_kit.dart';

class ProfileCreateScreen extends ConsumerStatefulWidget {
  const ProfileCreateScreen({super.key});

  @override
  ConsumerState<ProfileCreateScreen> createState() => _ProfileCreateScreenState();
}

class _ProfileCreateScreenState extends ConsumerState<ProfileCreateScreen> {
  String? _busyId;

  Future<void> _pick(ProfileCategory cat) async {
    if (_busyId != null) return;
    setState(() => _busyId = cat.id);
    final svc = ref.read(profilesServiceProvider);
    try {
      final gate = await svc.profileGate(cat.id);
      if (gate.locked) {
        if (mounted) _showGate(cat, gate.chapterTitle);
        return;
      }
      final profile = await svc.create(cat.id, const {});
      ref.invalidate(myProfilesProvider);
      if (mounted) context.pushReplacement('/more/profiles/edit/${profile.id}');
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not start this profile — you may already have one here.'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  void _showGate(ProfileCategory cat, String? chapter) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Training required'),
        content: Text(
          chapter != null
              ? 'Complete the "$chapter" training before creating a ${cat.name} profile.'
              : 'Complete the required training before creating this profile.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('Later')),
          ElevatedButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              context.push('/more/training');
            },
            child: const Text('Go to training'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final categories = ref.watch(creatableCategoriesProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('New profile')),
      body: categories.when(
        loading: () => const ShimmerCardList(),
        error: (_, _) => AppErrorRetry(onRetry: () => ref.invalidate(creatableCategoriesProvider)),
        data: (items) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const Text(
              'Choose a category for your new profile.',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
            ),
            const SizedBox(height: 16),
            for (final cat in items)
              Card(
                margin: const EdgeInsets.only(bottom: 10),
                clipBehavior: Clip.antiAlias,
                child: ListTile(
                  leading: const Icon(Icons.category_outlined, color: AppColors.primary),
                  title: Text(cat.name,
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                  trailing: _busyId == cat.id
                      ? const SizedBox(
                          width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.chevron_right, color: AppColors.textTertiary),
                  onTap: () => _pick(cat),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
