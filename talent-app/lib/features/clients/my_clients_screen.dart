import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants.dart';
import '../../core/format.dart';
import '../../core/launchers.dart';
import '../../core/theme.dart';
import '../../core/tints.dart';
import '../../models/my_clients.dart';
import '../../providers/talent_providers.dart';
import '../../widgets/shimmer_loading.dart';
import '../../widgets/ui_kit.dart';
import '../subscriptions/widgets/empty_state.dart';

class MyClientsScreen extends ConsumerWidget {
  const MyClientsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final clients = ref.watch(myClientsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('My Clients')),
      body: clients.when(
        loading: () => const ShimmerCardList(),
        error: (_, _) => AppErrorRetry(
          onRetry: () => ref.invalidate(myClientsProvider),
        ),
        data: (data) => RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(myClientsProvider);
            await ref.read(myClientsProvider.future);
          },
          child: data.isEmpty
              ? ListView(
                  children: const [
                    Padding(
                      padding: EdgeInsets.only(top: 80),
                      child: EmptyState(
                        icon: Icons.handshake_outlined,
                        title: 'No clients yet',
                        subtitle:
                            'When you’re assigned to a retainer, your clients and earnings show up here.',
                      ),
                    ),
                  ],
                )
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    _EarningsCard(data: data),
                    if (data.assigned.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      const SectionLabel('Active clients'),
                      for (final c in data.assigned)
                        _ClientCard(client: c, active: true),
                    ],
                    if (data.selected.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      const SectionLabel('Awaiting activation'),
                      for (final c in data.selected)
                        _ClientCard(client: c, active: false),
                    ],
                  ],
                ),
        ),
      ),
    );
  }
}

class _EarningsCard extends StatelessWidget {
  final MyClientsData data;
  const _EarningsCard({required this.data});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.primary, AppColors.primaryDark],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Monthly earnings',
            style: TextStyle(color: Colors.white.withValues(alpha: 0.85), fontSize: 13),
          ),
          const SizedBox(height: 4),
          Text(
            formatMoney(data.monthlyEarnings, data.earningsCurrency),
            style: const TextStyle(color: Colors.white, fontSize: 30, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              _mini('${data.assigned.length}', 'Active'),
              _divider(),
              _mini(_hours(data.hoursPerWeek), 'per week'),
              _divider(),
              _mini(_hours(data.hoursPerMonth), 'per month'),
            ],
          ),
        ],
      ),
    );
  }

  String _hours(num h) => h == h.roundToDouble() ? '${h.toInt()}h' : '${h}h';

  Widget _divider() => Container(
        width: 1,
        height: 32,
        margin: const EdgeInsets.symmetric(horizontal: 16),
        color: Colors.white.withValues(alpha: 0.2),
      );

  Widget _mini(String value, String label) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(value,
              style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700)),
          Text(label,
              style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 11)),
        ],
      );
}

class _ClientCard extends StatelessWidget {
  final MyClientRow client;
  final bool active;
  const _ClientCard({required this.client, required this.active});

  Future<void> _quit(BuildContext context) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Quit this client?'),
        content: Text(
          'We’ll open WhatsApp so you can let the SquadHire team know you want to stop working with ${client.displayName}.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Continue'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    final sent = await openWhatsApp(
      phone: supportPhoneDigits,
      message: 'Hi SquadHire team, I’d like to stop working with ${client.displayName}.',
    );
    if (!sent && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not open WhatsApp')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final tint = tintFor(client.displayName);
    final priceText = (client.priceLabel ?? '').trim().isNotEmpty
        ? client.priceLabel!
        : formatMoney(client.monthlyPrice, client.currency);

    return Card(
      margin: const EdgeInsets.only(top: 10),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                LogoAvatar(
                  initials: initialsFor(client.displayName),
                  bg: tint.bg,
                  fg: tint.fg,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        client.displayName,
                        style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      if ((client.subscriptionName ?? client.planName) != null)
                        Text(
                          client.subscriptionName ?? client.planName!,
                          style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                        ),
                    ],
                  ),
                ),
                Pill(
                  label: active ? 'Active' : 'Selected',
                  variant: active ? BadgeVariant.green : BadgeVariant.yellow,
                ),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 14,
              runSpacing: 8,
              children: [
                if (priceText.isNotEmpty)
                  InfoChip(icon: Icons.payments_outlined, label: priceText),
                if ((client.hoursLabel ?? '').isNotEmpty)
                  InfoChip(icon: Icons.schedule, label: client.hoursLabel!),
                if (client.workingDays.isNotEmpty)
                  InfoChip(
                    icon: Icons.calendar_today_outlined,
                    label: client.workingDays.map(humanize).join(', '),
                  ),
              ],
            ),
            if (active) ...[
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () => _quit(context),
                  style: TextButton.styleFrom(foregroundColor: AppColors.textTertiary),
                  child: const Text('Quit client'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
