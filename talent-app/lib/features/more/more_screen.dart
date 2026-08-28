import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';
import '../../providers/providers.dart';
import '../../providers/talent_providers.dart';
import '../../widgets/ui_kit.dart';

class MoreScreen extends ConsumerWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    final onboarded = user?.isOnboarded ?? true;
    final access = ref.watch(moduleAccessProvider).value;
    final accessLoading = ref.watch(moduleAccessProvider).isLoading;
    final trainingBadge = ref.watch(incompleteTrainingCountProvider).value ?? 0;

    bool locked(String? module) {
      if (module == null) return false;
      if (accessLoading) return !onboarded;
      if (access?.unlocked.contains(module) == true) return false;
      if (access?.isLocked(module) == true) return true;
      return !onboarded;
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        const Text(
          'More',
          style: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.w600,
            letterSpacing: -0.48,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: 4),
        const Text(
          'Profile, training, and account',
          style: TextStyle(fontSize: 14, color: AppColors.textTertiary),
        ),
        const SizedBox(height: 24),
        GroupedCard(
          title: 'Profile',
          children: [
            MoreRow(
              icon: Icons.person_outline,
              label: 'Basic Profile',
              description: 'Your personal details and job preferences',
              locked: locked('basic-profile'),
              onTap: () => context.push(
                '/more/webview?title=${Uri.encodeComponent('Basic Profile')}&path=${Uri.encodeComponent('/talent/basic-profile')}',
              ),
            ),
            MoreRow(
              icon: Icons.badge_outlined,
              label: 'Job Profiles',
              description: 'Role-specific profiles businesses discover',
              locked: locked('profiles'),
              onTap: () => context.push(
                '/more/webview?title=${Uri.encodeComponent('Job Profiles')}&path=${Uri.encodeComponent('/talent/profiles')}',
              ),
            ),
            MoreRow(
              icon: Icons.groups_outlined,
              label: 'My Clients',
              description: 'Businesses you are working with',
              locked: locked('subscriptions'),
              onTap: () => context.push(
                '/more/webview?title=${Uri.encodeComponent('My Clients')}&path=${Uri.encodeComponent('/talent/my-clients')}',
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        GroupedCard(
          title: 'Account',
          children: [
            MoreRow(
              icon: Icons.settings_outlined,
              label: 'Settings',
              description: 'Login details and account preferences',
              locked: locked('settings'),
              onTap: () => context.push(
                '/more/webview?title=${Uri.encodeComponent('Settings')}&path=${Uri.encodeComponent('/talent/settings')}',
              ),
            ),
            MoreRow(
              icon: Icons.play_circle_outline,
              label: 'Training Program',
              description: 'Courses, SOPs, and assigned lessons',
              badge: trainingBadge,
              onTap: () => context.push(
                '/more/webview?title=${Uri.encodeComponent('Training Program')}&path=${Uri.encodeComponent('/talent/training')}',
              ),
            ),
            MoreRow(
              icon: Icons.chat_outlined,
              label: 'Contact Support',
              description: 'Chat with the UpSquad team',
              onTap: () => context.push(
                '/more/webview?title=${Uri.encodeComponent('Contact Support')}&path=${Uri.encodeComponent('/talent/contact-support')}',
              ),
            ),
          ],
        ),
      ],
    );
  }
}
