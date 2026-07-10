import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/theme.dart';
import '../providers/jobs_providers.dart';
import '../providers/providers.dart';
import '../providers/talent_providers.dart';

/// The redesigned 5-tab shell: Home · Jobs · Offers · Alerts · More.
/// Jobs, Offers and Alerts carry live unread badges.
class AppBottomNav extends ConsumerWidget {
  final StatefulNavigationShell navigationShell;

  const AppBottomNav({super.key, required this.navigationShell});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final jobsUnread = ref.watch(jobsUnreadCountProvider).value ?? 0;
    final offersUnread = ref.watch(unreadCountProvider).value ?? 0;
    final alertsUnread = ref.watch(unreadNotificationsProvider).value ?? 0;

    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: navigationShell.currentIndex,
        onDestinationSelected: (index) {
          navigationShell.goBranch(
            index,
            initialLocation: index == navigationShell.currentIndex,
          );
        },
        destinations: [
          const NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home),
            label: 'Home',
          ),
          NavigationDestination(
            icon: _badged(const Icon(Icons.work_outline), jobsUnread),
            selectedIcon: _badged(const Icon(Icons.work), jobsUnread),
            label: 'Jobs',
          ),
          NavigationDestination(
            icon: _badged(const Icon(Icons.mail_outline), offersUnread),
            selectedIcon: _badged(const Icon(Icons.mail), offersUnread),
            label: 'Offers',
          ),
          NavigationDestination(
            icon: _badged(const Icon(Icons.notifications_none), alertsUnread),
            selectedIcon: _badged(const Icon(Icons.notifications), alertsUnread),
            label: 'Alerts',
          ),
          const NavigationDestination(
            icon: Icon(Icons.menu),
            selectedIcon: Icon(Icons.menu_open),
            label: 'More',
          ),
        ],
      ),
    );
  }

  Widget _badged(Widget child, int count) {
    return Badge(
      isLabelVisible: count > 0,
      label: Text('$count'),
      backgroundColor: AppColors.primary,
      child: child,
    );
  }
}
