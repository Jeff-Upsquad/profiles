import 'package:flutter/material.dart';
import '../../../core/theme.dart';

class SubscriptionCardActions extends StatelessWidget {
  final VoidCallback onAccept;
  final VoidCallback onReject;
  final bool loading;
  final String? ctaLabel;

  const SubscriptionCardActions({
    super.key,
    required this.onAccept,
    required this.onReject,
    this.loading = false,
    this.ctaLabel,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: OutlinedButton(
            onPressed: loading ? null : onReject,
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.danger,
              side: const BorderSide(color: AppColors.danger, width: 1.5),
            ),
            child: const Text('Decline'),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          flex: 2,
          child: ElevatedButton(
            onPressed: loading ? null : onAccept,
            child: loading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : Text(ctaLabel ?? 'Accept'),
          ),
        ),
      ],
    );
  }
}
