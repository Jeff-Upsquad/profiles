import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/theme.dart';
import '../providers/conversations_providers.dart';
import '../providers/talent_providers.dart';
import 'talent_top_bar.dart';
import 'ui_kit.dart';

/// 4-tab shell matching the web phone chrome: Home · Chatroom · Notifications · More.
class AppBottomNav extends ConsumerWidget {
  final StatefulNavigationShell navigationShell;

  const AppBottomNav({super.key, required this.navigationShell});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final chatUnread = ref.watch(conversationsUnreadProvider).value ?? 0;
    final alertsUnread = ref.watch(unreadNotificationsProvider).value ?? 0;
    final trainingBadge = ref.watch(incompleteTrainingCountProvider).value ?? 0;
    final index = navigationShell.currentIndex;
    final isChat = index == 1;

    return Scaffold(
      backgroundColor: isChat ? Colors.white : AppColors.surface,
      body: Column(
        children: [
          TalentTopBar(flush: isChat),
          Expanded(child: navigationShell),
        ],
      ),
      bottomNavigationBar: Material(
        color: Colors.white,
        child: Container(
          decoration: const BoxDecoration(
            border: Border(top: BorderSide(color: Color(0xFFE4E4E7))),
          ),
          padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom),
          child: SizedBox(
            height: 64,
            child: Row(
              children: [
                _Tab(
                  icon: Icons.home_outlined,
                  selectedIcon: Icons.home,
                  label: 'Home',
                  selected: index == 0,
                  onTap: () => _go(0),
                ),
                _Tab(
                  icon: Icons.chat_bubble_outline,
                  selectedIcon: Icons.chat_bubble,
                  label: 'Chatroom',
                  selected: index == 1,
                  badge: chatUnread,
                  onTap: () => _go(1),
                ),
                _Tab(
                  icon: Icons.notifications_none,
                  selectedIcon: Icons.notifications,
                  label: 'Notifications',
                  selected: index == 2,
                  badge: alertsUnread,
                  onTap: () => _go(2),
                ),
                _Tab(
                  icon: Icons.apps_outlined,
                  selectedIcon: Icons.apps,
                  label: 'More',
                  selected: index == 3,
                  badge: trainingBadge,
                  onTap: () => _go(3),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _go(int index) {
    navigationShell.goBranch(
      index,
      initialLocation: index == navigationShell.currentIndex,
    );
  }
}

class _Tab extends StatelessWidget {
  final IconData icon;
  final IconData selectedIcon;
  final String label;
  final bool selected;
  final int badge;
  final VoidCallback onTap;

  const _Tab({
    required this.icon,
    required this.selectedIcon,
    required this.label,
    required this.selected,
    required this.onTap,
    this.badge = 0,
  });

  @override
  Widget build(BuildContext context) {
    final color = selected ? AppColors.textPrimary : const Color(0xFF71717A);
    return Expanded(
      child: InkWell(
        onTap: onTap,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Icon(selected ? selectedIcon : icon, size: 22, color: color),
                if (badge > 0)
                  Positioned(
                    right: -10,
                    top: -6,
                    child: CountBadge(badge),
                  ),
              ],
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w500,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
