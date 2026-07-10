import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:dio/dio.dart';
import '../../core/json.dart';
import '../../core/theme.dart';
import '../../models/language_entry.dart';
import '../../models/profile_extras.dart';
import '../../models/talent_profile.dart';
import '../../providers/providers.dart';
import '../../providers/talent_providers.dart';
import '../../widgets/language_picker.dart';
import '../../widgets/ui_kit.dart';
import 'widgets/leveled_picker.dart';
import 'widgets/portfolio_section.dart';
import 'widgets/profile_form_fields.dart';

class ProfileEditScreen extends ConsumerStatefulWidget {
  final String profileId;
  const ProfileEditScreen({super.key, required this.profileId});

  @override
  ConsumerState<ProfileEditScreen> createState() => _ProfileEditScreenState();
}

class _ProfileEditScreenState extends ConsumerState<ProfileEditScreen> {
  TalentProfile? _profile;
  List<TemplateItem> _skillOpts = [];
  List<TemplateItem> _toolOpts = [];
  List<TemplateItem> _aiOpts = [];
  List<TemplateItem> _catOpts = [];

  List<LeveledItem> _skills = [];
  List<LeveledItem> _tools = [];
  List<LeveledItem> _aiTools = [];
  List<LeveledItem> _categories = [];
  int _expYears = 0;
  int _expMonths = 0;
  List<LanguageEntry> _languages = [];

  bool _loading = true;
  bool _error = false;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  List<LeveledItem> _parseLeveled(dynamic raw, String innerKey) =>
      asObjectList(raw).map((m) => LeveledItem.fromJson(m, innerKey)).toList();

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = false;
    });
    try {
      final svc = ref.read(profilesServiceProvider);
      final profile = await svc.get(widget.profileId);
      final catId = profile.categoryId ?? '';
      final templates = await Future.wait([
        svc.templates(catId, 'skills'),
        svc.templates(catId, 'tools'),
        svc.templates(catId, 'ai-tools'),
        svc.templates(catId, 'portfolio-categories'),
      ]);
      final me = await ref.read(talentServiceProvider).getMe();

      final fd = profile.fieldData;
      final exp = asObject(fd['_experience']);
      _profile = profile;
      _skillOpts = templates[0];
      _toolOpts = templates[1];
      _aiOpts = templates[2];
      _catOpts = templates[3];
      _skills = _parseLeveled(fd['_skills'], 'skill');
      _tools = _parseLeveled(fd['_tools'], 'name');
      _aiTools = _parseLeveled(fd['_ai_tools'], 'name');
      _categories = _parseLeveled(fd['_categories'], 'category');
      _expYears = asInt(exp['years']) ?? 0;
      _expMonths = asInt(exp['months']) ?? 0;
      _languages = List.of(me.languagesSpoken);
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

  Map<String, dynamic> _fieldData() => {
        ...?_profile?.fieldData,
        '_experience': {'years': _expYears, 'months': _expMonths},
        '_skills': _skills.map((e) => e.toJson('skill')).toList(),
        '_tools': _tools.map((e) => e.toJson('name')).toList(),
        '_ai_tools': _aiTools.map((e) => e.toJson('name')).toList(),
        '_categories': _categories.map((e) => e.toJson('category')).toList(),
      };

  Future<void> _persist({required bool submit}) async {
    if (_saving) return;
    setState(() => _saving = true);
    try {
      final svc = ref.read(profilesServiceProvider);
      await svc.update(widget.profileId, _fieldData());
      await ref.read(talentServiceProvider).updateFields({
        'languages_spoken':
            _languages.where((e) => e.language.isNotEmpty).map((e) => e.toJson()).toList(),
      });
      if (submit) await svc.submit(widget.profileId);

      ref.invalidate(myProfilesProvider);
      ref.invalidate(profileDetailProvider(widget.profileId));
      ref.invalidate(onboardingProgressProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(submit ? 'Profile submitted for review' : 'Draft saved')),
      );
      if (submit) context.pop();
    } on DioException catch (e) {
      final msg = e.response?.data is Map
          ? (e.response?.data['message']?.toString() ?? 'Could not save')
          : 'Could not save';
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not save. Please try again.')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_profile?.displayName ?? 'Profile')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error
              ? AppErrorRetry(onRetry: _load)
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    _experienceCard(),
                    const SizedBox(height: 12),
                    if (_skillOpts.isNotEmpty) ...[
                      _leveledCard('Skills', Icons.auto_awesome_outlined, _skillOpts, _skills,
                          (v) => setState(() => _skills = v)),
                      const SizedBox(height: 12),
                    ],
                    if (_toolOpts.isNotEmpty) ...[
                      _leveledCard('Tools', Icons.build_outlined, _toolOpts, _tools,
                          (v) => setState(() => _tools = v)),
                      const SizedBox(height: 12),
                    ],
                    if (_aiOpts.isNotEmpty) ...[
                      _leveledCard('AI tools', Icons.smart_toy_outlined, _aiOpts, _aiTools,
                          (v) => setState(() => _aiTools = v)),
                      const SizedBox(height: 12),
                    ],
                    if (_catOpts.isNotEmpty) ...[
                      _leveledCard('Portfolio categories', Icons.category_outlined, _catOpts,
                          _categories, (v) => setState(() => _categories = v)),
                      const SizedBox(height: 12),
                    ],
                    TitledCard(
                      title: 'Languages',
                      icon: Icons.translate_outlined,
                      child: LanguagePicker(
                        value: _languages,
                        onChanged: (v) => setState(() => _languages = v),
                      ),
                    ),
                    const SizedBox(height: 12),
                    PortfolioSection(profileId: widget.profileId),
                    const SizedBox(height: 24),
                  ],
                ),
      bottomNavigationBar: (_loading || _error) ? null : _bar(),
    );
  }

  Widget _experienceCard() {
    final years = [for (int y = 0; y <= 50; y++) y];
    final months = [for (int m = 0; m <= 11; m++) m];
    return TitledCard(
      title: 'Experience',
      icon: Icons.work_history_outlined,
      child: Row(
        children: [
          Expanded(
            child: DropdownField<int>(
              label: 'Years',
              value: _expYears,
              items: years,
              onChanged: (v) => setState(() => _expYears = v ?? 0),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: DropdownField<int>(
              label: 'Months',
              value: _expMonths,
              items: months,
              onChanged: (v) => setState(() => _expMonths = v ?? 0),
            ),
          ),
        ],
      ),
    );
  }

  Widget _leveledCard(
    String title,
    IconData icon,
    List<TemplateItem> options,
    List<LeveledItem> value,
    ValueChanged<List<LeveledItem>> onChanged,
  ) {
    return TitledCard(
      title: title,
      icon: icon,
      child: LeveledPicker(options: options, value: value, onChanged: onChanged),
    );
  }

  Widget _bar() {
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
              child: OutlinedButton(
                onPressed: _saving ? null : () => _persist(submit: false),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: const Text('Save draft'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: ElevatedButton(
                onPressed: _saving ? null : () => _persist(submit: true),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: _saving
                    ? const SizedBox(
                        width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white))
                    : const Text('Save & submit'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
