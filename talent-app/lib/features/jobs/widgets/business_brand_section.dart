import 'package:flutter/material.dart';
import '../../../core/format.dart';
import '../../../core/launchers.dart';
import '../../../core/theme.dart';
import '../../../core/tints.dart';
import '../../../models/job_card.dart';
import '../../../widgets/ui_kit.dart';

/// "About the business" — company snapshot plus an optional brand snapshot.
class BusinessBrandSection extends StatelessWidget {
  final BusinessProfileSnapshot business;
  final BrandProfileSnapshot? brand;

  const BusinessBrandSection({super.key, required this.business, this.brand});

  @override
  Widget build(BuildContext context) {
    final name = business.name ?? 'Business';
    final tint = tintFor(name);

    final facts = <(IconData, String)>[
      if (business.industry != null) (Icons.category_outlined, business.industry!),
      if (business.companySize != null)
        (Icons.groups_outlined, '${business.companySize} people'),
      if (business.foundedYear != null)
        (Icons.event_outlined, 'Founded ${business.foundedYear}'),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TitledCard(
          title: 'About the business',
          icon: Icons.business_outlined,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  LogoAvatar(
                    logoUrl: business.logoUrl,
                    initials: initialsFor(name),
                    bg: tint.bg,
                    fg: tint.fg,
                    size: 48,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name,
                          style: const TextStyle(
                            color: AppColors.textPrimary,
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        if (business.industry != null)
                          Text(
                            business.industry!,
                            style: const TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 13,
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
              if (facts.isNotEmpty) ...[
                const SizedBox(height: 12),
                Wrap(
                  spacing: 14,
                  runSpacing: 8,
                  children: [
                    for (final f in facts) InfoChip(icon: f.$1, label: f.$2),
                  ],
                ),
              ],
              if ((business.about ?? '').trim().isNotEmpty) ...[
                const SizedBox(height: 12),
                Text(
                  business.about!,
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 14,
                    height: 1.5,
                  ),
                ),
              ],
              if ((business.culture ?? '').trim().isNotEmpty) ...[
                const SizedBox(height: 12),
                const SectionLabel('Culture'),
                Text(
                  business.culture!,
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 14,
                    height: 1.5,
                  ),
                ),
              ],
              if (business.perks.isNotEmpty) ...[
                const SizedBox(height: 12),
                const SectionLabel('Perks'),
                KeywordChips(business.perks),
              ],
              if (business.website != null) ...[
                const SizedBox(height: 12),
                _WebsiteLink(url: business.website!),
              ],
            ],
          ),
        ),
        if (business.photos.isNotEmpty) ...[
          const SizedBox(height: 12),
          _PhotoStrip(photos: business.photos),
        ],
      ],
    );
  }
}

class _WebsiteLink extends StatelessWidget {
  final String url;
  const _WebsiteLink({required this.url});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => openExternalUrl(url),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.link, size: 16, color: AppColors.primary),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              url.replaceFirst(RegExp(r'^https?://'), ''),
              style: const TextStyle(
                color: AppColors.primary,
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}

class _PhotoStrip extends StatelessWidget {
  final List<String> photos;
  const _PhotoStrip({required this.photos});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 120,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 4),
        itemCount: photos.length,
        separatorBuilder: (_, _) => const SizedBox(width: 10),
        itemBuilder: (_, i) => ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: Image.network(
            photos[i],
            width: 160,
            height: 120,
            fit: BoxFit.cover,
            errorBuilder: (_, _, _) => Container(
              width: 160,
              height: 120,
              color: AppColors.divider,
              child: const Icon(Icons.image_not_supported_outlined,
                  color: AppColors.textTertiary),
            ),
          ),
        ),
      ),
    );
  }
}
