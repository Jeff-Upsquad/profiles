import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/constants.dart';
import '../../core/theme.dart';
import '../../services/update_controller.dart';

/// App-level **blocking** dialog for forced updates only. Mounted at the top of
/// the widget tree (via MaterialApp.builder) so it gates every screen until the
/// user installs. Optional updates are handled by the inline [UpdateCard], so
/// this renders nothing unless a forced update is pending. Mirrors the partner
/// app's UpdateGate.
class UpdateGate extends ConsumerWidget {
  const UpdateGate({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(updateControllerProvider);
    final info = s.info;
    if (info == null || !info.isForce) return const SizedBox.shrink();

    final m = info.manifest;
    final notifier = ref.read(updateControllerProvider.notifier);

    return Stack(
      children: [
        const ModalBarrier(dismissible: false, color: Colors.black54),
        Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Material(
              color: AppColors.card,
              borderRadius: BorderRadius.circular(20),
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
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
                          child: Text('Update required',
                              style: TextStyle(
                                  color: AppColors.textPrimary,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 18)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'A newer version (${m.versionName}) is required to keep using $appName.',
                      style: const TextStyle(
                          color: AppColors.textSecondary, fontSize: 14),
                    ),
                    if (m.releaseNotes.trim().isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(m.releaseNotes.trim(),
                          style: const TextStyle(
                              color: AppColors.textTertiary, fontSize: 13)),
                    ],
                    if (s.downloading) ...[
                      const SizedBox(height: 20),
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
                          style: const TextStyle(
                              color: AppColors.danger, fontSize: 13)),
                    ],
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed:
                            s.downloading ? null : () => notifier.onUpdate(m),
                        icon: const Icon(Icons.file_download_outlined, size: 18),
                        label: Text(s.downloading ? 'Updating…' : 'Update now',
                            style: const TextStyle(fontWeight: FontWeight.bold)),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
