import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';
import '../core/theme.dart';

class ShimmerCardList extends StatelessWidget {
  final int itemCount;

  /// Shrink-wrapped column for embedding inside a parent scroll view
  /// (the Home feed), which already provides scrolling + padding.
  final bool embedded;

  const ShimmerCardList({super.key, this.itemCount = 3, this.embedded = false});

  const ShimmerCardList.embedded({super.key, this.itemCount = 3})
    : embedded = true;

  @override
  Widget build(BuildContext context) {
    if (embedded) {
      return Column(
        children: [
          for (var i = 0; i < itemCount; i++) ...[
            if (i > 0) const SizedBox(height: 12),
            const _ShimmerCard(),
          ],
        ],
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      physics: const NeverScrollableScrollPhysics(),
      itemCount: itemCount,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (_, __) => const _ShimmerCard(),
    );
  }
}

class _ShimmerCard extends StatelessWidget {
  const _ShimmerCard();

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Shimmer.fromColors(
        baseColor: AppColors.divider,
        highlightColor: Colors.white,
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _block(80, 20),
              const SizedBox(height: 12),
              _block(200, 18),
              const SizedBox(height: 8),
              _block(140, 14),
              const SizedBox(height: 20),
              Container(
                height: 60,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              const SizedBox(height: 16),
              _block(160, 14),
              const SizedBox(height: 8),
              _block(120, 14),
            ],
          ),
        ),
      ),
    );
  }

  Widget _block(double width, double height) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(6),
      ),
    );
  }
}
