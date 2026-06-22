import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme.dart';
import '../../services/update_controller.dart';

/// Inline "update available" card for optional updates — designed to sit at the
/// top of the home list, just below the app bar. Mirrors the partner app's
/// UpdateCard: brand-badged header, collapsible "What's new" list, inline
/// download progress, and Later / Update actions. Forced updates render nothing
/// here (the blocking [UpdateGate] handles them). Includes its own trailing
/// spacing so the host list can drop it in unconditionally.
class UpdateCard extends ConsumerStatefulWidget {
  const UpdateCard({super.key});

  @override
  ConsumerState<UpdateCard> createState() => _UpdateCardState();
}

class _UpdateCardState extends ConsumerState<UpdateCard> {
  bool _expanded = false;

  List<String> _parseReleaseNotes(String raw) {
    return raw
        .split('\n')
        .map((l) => l.trim().replaceFirst(RegExp(r'^[-*•–]\s*'), '').trim())
        .where((l) => l.isNotEmpty)
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(updateControllerProvider);
    final info = s.info;
    // Only optional updates render as a card; forced updates use UpdateGate.
    if (info == null || info.isForce) return const SizedBox.shrink();

    final m = info.manifest;
    final changes = _parseReleaseNotes(m.releaseNotes);
    final notifier = ref.read(updateControllerProvider.notifier);

    return Column(
      children: [
        Container(
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: AppColors.border),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header: gradient badge + title/subtitle + version chip.
              Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [AppColors.primary, AppColors.primaryDark],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(13),
                    ),
                    child: const Icon(Icons.system_update_alt,
                        color: Colors.white, size: 24),
                  ),
                  const SizedBox(width: 14),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Update available',
                            style: TextStyle(
                                color: AppColors.textPrimary,
                                fontWeight: FontWeight.bold,
                                fontSize: 17)),
                        SizedBox(height: 2),
                        Text('A new version is ready to install',
                            style: TextStyle(
                                color: AppColors.textTertiary, fontSize: 13)),
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: AppColors.infoBg,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text('v${m.versionName}',
                        style: const TextStyle(
                            color: AppColors.textSecondary,
                            fontWeight: FontWeight.w600,
                            fontSize: 12)),
                  ),
                ],
              ),

              // Collapsible "What's new".
              if (changes.isNotEmpty) ...[
                const SizedBox(height: 14),
                InkWell(
                  borderRadius: BorderRadius.circular(10),
                  onTap: () => setState(() => _expanded = !_expanded),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Row(
                      children: [
                        const Icon(Icons.auto_awesome_outlined,
                            size: 16, color: AppColors.textTertiary),
                        const SizedBox(width: 8),
                        const Text("What's new",
                            style: TextStyle(
                                color: AppColors.textSecondary,
                                fontWeight: FontWeight.w600,
                                fontSize: 14)),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            '${changes.length} change${changes.length == 1 ? '' : 's'}',
                            style: const TextStyle(
                                color: AppColors.textTertiary, fontSize: 12),
                          ),
                        ),
                        Icon(_expanded ? Icons.expand_less : Icons.expand_more,
                            size: 20, color: AppColors.textTertiary),
                      ],
                    ),
                  ),
                ),
                if (_expanded)
                  Padding(
                    padding: const EdgeInsets.only(top: 6, left: 2, right: 2),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        for (final line in changes)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 4),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Container(
                                  margin: const EdgeInsets.only(top: 7),
                                  width: 5,
                                  height: 5,
                                  decoration: const BoxDecoration(
                                    color: AppColors.primary,
                                    shape: BoxShape.circle,
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Text(line,
                                      style: const TextStyle(
                                          color: AppColors.textSecondary,
                                          fontSize: 13)),
                                ),
                              ],
                            ),
                          ),
                      ],
                    ),
                  ),
              ],

              // Download progress, shown inline while installing.
              if (s.downloading) ...[
                const SizedBox(height: 16),
                ClipRRect(
                  borderRadius: BorderRadius.circular(99),
                  child: LinearProgressIndicator(
                    value: s.progress,
                    minHeight: 6,
                    color: AppColors.primary,
                    backgroundColor: AppColors.divider,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  s.progress != null
                      ? 'Downloading… ${(s.progress! * 100).round()}%'
                      : 'Preparing…',
                  style: const TextStyle(
                      color: AppColors.textTertiary, fontSize: 12),
                ),
              ],

              if (s.error != null) ...[
                const SizedBox(height: 12),
                Text(s.error!,
                    style:
                        const TextStyle(color: AppColors.danger, fontSize: 13)),
              ],

              // Actions: subtle "Later" + the prominent "Update".
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed: s.downloading ? null : notifier.dismiss,
                    style: TextButton.styleFrom(
                      foregroundColor: AppColors.textTertiary,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 11),
                    ),
                    child: const Text('Later',
                        style: TextStyle(fontWeight: FontWeight.w600)),
                  ),
                  const SizedBox(width: 8),
                  ElevatedButton.icon(
                    onPressed: s.downloading ? null : () => notifier.onUpdate(m),
                    icon: const Icon(Icons.file_download_outlined, size: 18),
                    label: Text(s.downloading ? 'Updating…' : 'Update',
                        style: const TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
      ],
    );
  }
}
