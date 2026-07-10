import 'package:flutter/material.dart';
import '../../core/constants.dart';
import '../../core/launchers.dart';
import '../../core/theme.dart';

class ContactSupportScreen extends StatelessWidget {
  const ContactSupportScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Contact support')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 72,
                height: 72,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: AppColors.success.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Icon(Icons.chat_outlined, size: 36, color: AppColors.success),
              ),
              const SizedBox(height: 20),
              Text(
                'We’re here to help',
                style: Theme.of(context).textTheme.titleLarge,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              const Text(
                'Message the SquadHire team on WhatsApp and we’ll get back to you.',
                style: TextStyle(color: AppColors.textSecondary, fontSize: 14, height: 1.5),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 28),
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton.icon(
                  onPressed: () async {
                    final ok = await openWhatsApp(
                      phone: supportPhoneDigits,
                      message: 'Hi SquadHire team, I need some help.',
                    );
                    if (!ok && context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Could not open WhatsApp')),
                      );
                    }
                  },
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.success),
                  icon: const Icon(Icons.chat),
                  label: const Text('Chat on WhatsApp'),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                supportPhoneDisplay,
                style: const TextStyle(color: AppColors.textTertiary, fontSize: 13),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
