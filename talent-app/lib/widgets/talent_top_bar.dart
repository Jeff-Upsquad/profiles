import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/constants.dart';
import '../core/format.dart';
import '../core/theme.dart';
import '../providers/providers.dart';
import 'ui_kit.dart';

/// Mobile-only brand + account chrome. Matches `TalentTopBar.tsx`.
class TalentTopBar extends ConsumerWidget {
  final bool flush;
  const TalentTopBar({super.key, this.flush = false});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    final me = ref.watch(talentMeProvider).value;
    final agencyMe = ref.watch(agencyMeProvider).value;
    if (user == null) return const SizedBox.shrink();

    final isAgency = user.isAgency;
    String name;
    String email;
    String? photo;
    if (isAgency) {
      final agencyName = (agencyMe?['agency_name'] as String?) ?? user.fullName ?? '';
      name = agencyName.trim().isEmpty ? user.email : agencyName.trim();
      email = (agencyMe?['email'] as String?) ?? user.email;
      photo = agencyMe?['logo_url'] as String?;
    } else {
      name = (user.fullName ?? me?.fullName ?? user.email).trim();
      email = (user.email.isNotEmpty ? user.email : me?.email) ?? '';
      photo = me?.profilePhotoUrl;
    }
    final initials = initialsFor(name.isEmpty ? email : name);

    return Material(
      color: Colors.white.withValues(alpha: 0.95),
      child: Container(
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: AppColors.border)),
        ),
        padding: EdgeInsets.fromLTRB(16, 10, 16, flush ? 10 : 10),
        child: SafeArea(
          bottom: false,
          child: Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () => context.go('/home'),
                  behavior: HitTestBehavior.opaque,
                  child: Row(
                    children: [
                      const BrandMark(size: 32),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              appName,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                letterSpacing: -0.28,
                                color: AppColors.textPrimary,
                                height: 1.15,
                              ),
                            ),
                            const Text(
                              appTagline,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 10,
                                color: AppColors.textMuted,
                                height: 1.2,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 12),
              _AvatarMenu(
                name: name,
                email: email,
                photoUrl: photo,
                initials: initials,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AvatarMenu extends ConsumerWidget {
  final String name;
  final String email;
  final String? photoUrl;
  final String initials;

  const _AvatarMenu({
    required this.name,
    required this.email,
    required this.photoUrl,
    required this.initials,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return PopupMenuButton<String>(
      tooltip: 'Account menu',
      offset: const Offset(0, 8),
      position: PopupMenuPosition.under,
      color: Colors.white,
      elevation: 12,
      shadowColor: Colors.black38,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppColors.border),
      ),
      onSelected: (value) {
        final isAgency = ref.read(authProvider).user?.isAgency == true;
        switch (value) {
          case 'profile':
            if (isAgency) {
              context.push(
                '/more/webview?title=${Uri.encodeComponent('Agency Profile')}&path=${Uri.encodeComponent('/agency/profile')}',
              );
            } else {
              context.push('/basic-profile');
            }
          case 'settings':
            if (isAgency) {
              context.push(
                '/more/webview?title=${Uri.encodeComponent('Settings')}&path=${Uri.encodeComponent('/agency/settings')}',
              );
            } else {
              context.push('/more/settings');
            }
          case 'logout':
            ref.read(authProvider.notifier).logout();
        }
      },
      itemBuilder: (context) {
        final isAgency = ref.read(authProvider).user?.isAgency == true;
        return [
          PopupMenuItem<String>(
            enabled: false,
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (name.isNotEmpty)
                  Text(
                    name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                if (email.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      email,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12, color: AppColors.textTertiary),
                    ),
                  ),
              ],
            ),
          ),
          const PopupMenuDivider(height: 1),
          _item('profile', Icons.person_outline, isAgency ? 'Agency profile' : 'Basic profile'),
          _item('settings', Icons.settings_outlined, 'Account settings'),
          _item('logout', Icons.logout, 'Logout'),
        ];
      },
      child: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: AppColors.primary,
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white, width: 2),
          boxShadow: const [
            BoxShadow(color: Color(0x14000000), blurRadius: 4, offset: Offset(0, 1)),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        alignment: Alignment.center,
        child: photoUrl != null && photoUrl!.isNotEmpty
            ? Image.network(
                photoUrl!,
                width: 36,
                height: 36,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => _initials(),
              )
            : _initials(),
      ),
    );
  }

  Widget _initials() => Text(
        initials,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      );

  PopupMenuItem<String> _item(String value, IconData icon, String label) {
    return PopupMenuItem<String>(
      value: value,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
      child: Row(
        children: [
          Icon(icon, size: 16, color: AppColors.textTertiary),
          const SizedBox(width: 10),
          Text(
            label,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}
