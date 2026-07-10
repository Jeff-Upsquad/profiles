import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:package_info_plus/package_info_plus.dart';
import '../../core/constants.dart';
import '../../core/theme.dart';
import '../../models/language_entry.dart';
import '../../providers/providers.dart';
import '../../widgets/language_picker.dart';
import '../../widgets/ui_kit.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _age = TextEditingController();
  final _currentLocation = TextEditingController();
  final _nativePlace = TextEditingController();
  List<LanguageEntry> _languages = [];

  bool _loading = true;
  bool _saving = false;
  bool _error = false;
  bool _whatsapp = true;
  String _initialSnapshot = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _age.dispose();
    _currentLocation.dispose();
    _nativePlace.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = false;
    });
    try {
      final me = await ref.read(talentServiceProvider).getMe();
      _name.text = me.fullName ?? '';
      _phone.text = me.phone ?? '';
      _age.text = me.age?.toString() ?? '';
      _currentLocation.text = me.currentLocation ?? '';
      _nativePlace.text = me.nativePlace ?? '';
      _languages = List.of(me.languagesSpoken);
      _whatsapp = me.whatsappUpdatesEnabled;
      _initialSnapshot = _snapshot();
      if (mounted) setState(() => _loading = false);
    } catch (_) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = true;
        });
      }
    }
  }

  String _snapshot() => jsonEncode({
        'name': _name.text,
        'phone': _phone.text,
        'age': _age.text,
        'cur': _currentLocation.text,
        'nat': _nativePlace.text,
        'langs': _languages.map((e) => e.toJson()).toList(),
      });

  bool get _dirty => _snapshot() != _initialSnapshot;

  Future<void> _save() async {
    if (_saving) return;
    setState(() => _saving = true);
    try {
      await ref.read(talentServiceProvider).updateProfile(
            fullName: _name.text.trim(),
            phone: _phone.text.trim(),
            age: int.tryParse(_age.text.trim()),
            currentLocation: _currentLocation.text.trim(),
            nativePlace: _nativePlace.text.trim(),
            languages: _languages,
          );
      ref.invalidate(talentMeProvider);
      await ref.read(authProvider.notifier).refreshUser();
      _initialSnapshot = _snapshot();
      if (mounted) {
        setState(() {});
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Settings updated')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to update settings')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _toggleWhatsapp(bool next) async {
    setState(() => _whatsapp = next);
    try {
      await ref.read(talentServiceProvider).setWhatsappUpdates(next);
      ref.invalidate(talentMeProvider);
    } catch (_) {
      if (mounted) setState(() => _whatsapp = !next);
    }
  }

  @override
  Widget build(BuildContext context) {
    final email = ref.watch(authProvider).user?.email ?? '';

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error
              ? AppErrorRetry(onRetry: _load)
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    TitledCard(
                      title: 'Personal details',
                      icon: Icons.person_outline,
                      child: Column(
                        children: [
                          _field(_name, 'Full name', textInputAction: TextInputAction.next),
                          const SizedBox(height: 12),
                          TextField(
                            enabled: false,
                            controller: TextEditingController(text: email),
                            decoration: const InputDecoration(
                              labelText: 'Email',
                              helperText: 'Email cannot be changed',
                            ),
                          ),
                          const SizedBox(height: 12),
                          _field(_phone, 'Phone (WhatsApp)',
                              keyboardType: TextInputType.phone),
                          const SizedBox(height: 12),
                          _field(_age, 'Age', keyboardType: TextInputType.number),
                          const SizedBox(height: 12),
                          _field(_currentLocation, 'Current location'),
                          const SizedBox(height: 12),
                          _field(_nativePlace, 'Native place'),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    TitledCard(
                      title: 'Languages',
                      icon: Icons.translate_outlined,
                      child: LanguagePicker(
                        value: _languages,
                        onChanged: (v) => setState(() => _languages = v),
                      ),
                    ),
                    const SizedBox(height: 12),
                    _notificationsCard(),
                    const SizedBox(height: 12),
                    _securityCard(),
                    const SizedBox(height: 12),
                    _aboutCard(),
                    const SizedBox(height: 24),
                  ],
                ),
      bottomNavigationBar: (_loading || _error) ? null : _saveBar(),
    );
  }

  Widget _field(
    TextEditingController controller,
    String label, {
    TextInputType? keyboardType,
    TextInputAction? textInputAction,
  }) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      textInputAction: textInputAction,
      onChanged: (_) => setState(() {}),
      decoration: InputDecoration(labelText: label),
    );
  }

  Widget _notificationsCard() {
    return Card(
      child: SwitchListTile(
        value: _whatsapp,
        onChanged: _toggleWhatsapp,
        secondary: const Icon(Icons.chat_outlined, color: AppColors.success),
        title: const Text('WhatsApp updates',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
        subtitle: const Text('Get a WhatsApp message when a new opportunity arrives.'),
      ),
    );
  }

  Widget _securityCard() {
    return Card(
      child: ListTile(
        leading: const Icon(Icons.lock_outline, color: AppColors.textSecondary),
        title: const Text('Change password',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w500)),
        trailing: const Icon(Icons.chevron_right, color: AppColors.textTertiary),
        onTap: () => context.push('/more/change-password'),
      ),
    );
  }

  Widget _aboutCard() {
    return Card(
      child: Column(
        children: [
          ListTile(
            leading: const Icon(Icons.info_outline, color: AppColors.textSecondary),
            title: const Text('App version'),
            subtitle: FutureBuilder<PackageInfo>(
              future: PackageInfo.fromPlatform(),
              builder: (context, snapshot) {
                if (!snapshot.hasData) return const Text('...');
                return Text('v${snapshot.data!.version} (${snapshot.data!.buildNumber})');
              },
            ),
          ),
          const Divider(height: 1, indent: 16, endIndent: 16),
          const ListTile(
            leading: Icon(Icons.bolt_rounded, color: AppColors.textSecondary),
            title: Text('About'),
            subtitle: Text('$appName — $appTagline'),
          ),
        ],
      ),
    );
  }

  Widget _saveBar() {
    return SafeArea(
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: AppColors.border)),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                _dirty ? 'You have unsaved changes' : 'No changes yet',
                style: const TextStyle(color: AppColors.textTertiary, fontSize: 12.5),
              ),
            ),
            ElevatedButton(
              onPressed: (!_dirty || _saving) ? null : _save,
              child: _saving
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white),
                    )
                  : const Text('Save changes'),
            ),
          ],
        ),
      ),
    );
  }
}
