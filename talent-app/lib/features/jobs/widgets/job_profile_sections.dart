import 'package:flutter/material.dart';
import '../../../core/format.dart';
import '../../../core/launchers.dart';
import '../../../core/theme.dart';
import '../../../models/job_card.dart';
import '../../../widgets/ui_kit.dart';

/// The job-profile body: role details, responsibilities, requirements, skills,
/// schedule, education, benefits, growth, and location. Shared by the job
/// detail screen and the standalone job-profile view.
class JobProfileSections extends StatelessWidget {
  final JobProfileSnapshot details;
  final String? description;

  const JobProfileSections({
    super.key,
    required this.details,
    this.description,
  });

  @override
  Widget build(BuildContext context) {
    final about = (description ?? details.description ?? '').trim();

    final quickRows = <(String, String)>[
      if (details.employmentType != null)
        ('Employment', humanize(details.employmentType)),
      if (details.workMode != null) ('Work mode', humanize(details.workMode)),
      if (details.experienceLabel != null) ('Experience', details.experienceLabel!),
      if (details.education != null) ('Education', details.education!),
      if (details.workingDays.isNotEmpty)
        ('Working days', details.workingDays.map(humanize).join(', ')),
      if (details.workingHoursStart != null && details.workingHoursEnd != null)
        ('Hours', '${details.workingHoursStart} – ${details.workingHoursEnd}'),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (about.isNotEmpty) ...[
          TitledCard(
            title: 'About the role',
            icon: Icons.description_outlined,
            child: Text(
              about,
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 14,
                height: 1.5,
              ),
            ),
          ),
          const SizedBox(height: 12),
        ],
        if (quickRows.isNotEmpty) ...[
          TitledCard(
            title: 'Role details',
            icon: Icons.badge_outlined,
            child: Column(
              children: [
                for (final row in quickRows) _KeyValue(k: row.$1, v: row.$2),
              ],
            ),
          ),
          const SizedBox(height: 12),
        ],
        _bulletCard('Responsibilities', Icons.checklist_outlined, details.responsibilities),
        _bulletCard('Requirements', Icons.rule_outlined, details.requirements),
        _chipCard('Skills', Icons.auto_awesome_outlined, details.skills),
        _chipCard('Benefits', Icons.card_giftcard_outlined, details.benefits),
        if ((details.growthPath ?? '').trim().isNotEmpty) ...[
          TitledCard(
            title: 'Growth path',
            icon: Icons.trending_up_outlined,
            child: Text(
              details.growthPath!,
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 14,
                height: 1.5,
              ),
            ),
          ),
          const SizedBox(height: 12),
        ],
        _location(context),
      ],
    );
  }

  Widget _bulletCard(String title, IconData icon, List<String> items) {
    if (items.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TitledCard(title: title, icon: icon, child: BulletList(items)),
    );
  }

  Widget _chipCard(String title, IconData icon, List<String> items) {
    if (items.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TitledCard(title: title, icon: icon, child: KeywordChips(items)),
    );
  }

  Widget _location(BuildContext context) {
    final loc = details.location;
    if (loc == null) return const SizedBox.shrink();
    final line = [loc.address, loc.city, loc.region]
        .whereType<String>()
        .where((s) => s.isNotEmpty)
        .join(', ');
    if (line.isEmpty && loc.label == null) return const SizedBox.shrink();
    return TitledCard(
      title: 'Location',
      icon: Icons.place_outlined,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            line.isNotEmpty ? line : loc.label!,
            style: const TextStyle(
              color: AppColors.textSecondary,
              fontSize: 14,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: () async {
              final ok = await openMaps(
                url: loc.googleMapsUrl,
                query: line.isNotEmpty ? line : loc.label,
              );
              if (!ok && context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Could not open maps')),
                );
              }
            },
            icon: const Icon(Icons.map_outlined, size: 18),
            label: const Text('Open in Maps'),
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            ),
          ),
        ],
      ),
    );
  }
}

class _KeyValue extends StatelessWidget {
  final String k;
  final String v;
  const _KeyValue({required this.k, required this.v});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 108,
            child: Text(
              k,
              style: const TextStyle(color: AppColors.textTertiary, fontSize: 13),
            ),
          ),
          Expanded(
            child: Text(
              v,
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
