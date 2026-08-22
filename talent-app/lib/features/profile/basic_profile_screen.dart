import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/india_locations.dart';
import '../../core/theme.dart';
import '../../models/basic_profile.dart';
import '../../models/job_preferences.dart';
import '../../models/language_entry.dart';
import '../../providers/jobs_providers.dart';
import '../../providers/providers.dart';
import '../../providers/talent_providers.dart';
import '../../widgets/file_upload_field.dart';
import '../../widgets/language_picker.dart';
import '../../widgets/ui_kit.dart';
import 'widgets/profile_form_fields.dart';

/// The talent Basic Profile — a single sectioned form. One "Save" persists to
/// `/talent/me/basic-profile`, `/talent/me` (name + languages) and
/// `/talent/jobs/preferences` (preferred locations / relocation / notice).
class BasicProfileScreen extends ConsumerStatefulWidget {
  const BasicProfileScreen({super.key});

  @override
  ConsumerState<BasicProfileScreen> createState() => _BasicProfileScreenState();
}

class _BasicProfileScreenState extends ConsumerState<BasicProfileScreen> {
  BasicProfile _p = BasicProfile();
  final _fullName = TextEditingController();
  List<LanguageEntry> _languages = [];
  List<PreferredLocation> _preferredLocations = [];
  final _notice = TextEditingController();
  bool _openToRelocation = false;
  bool _sameAsOfficial = false;

  bool _loading = true;
  bool _error = false;
  bool _saving = false;
  int _active = 0;
  final Map<int, GlobalKey> _tabKeys = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _fullName.dispose();
    _notice.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = false;
    });
    try {
      final bp = await ref.read(basicProfileServiceProvider).get();
      final me = await ref.read(talentServiceProvider).getMe();
      final prefs = await ref.read(jobsServiceProvider).getOptIn();
      _p = bp;
      _fullName.text = me.fullName ?? '';
      _languages = List.of(me.languagesSpoken);
      _preferredLocations = List.of(prefs.preferredLocations);
      _notice.text = prefs.noticePeriodDays?.toString() ?? '';
      _openToRelocation = prefs.openToRelocation;
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

  Future<void> _save() async {
    if (_saving) return;
    FocusScope.of(context).unfocus();
    setState(() => _saving = true);
    try {
      if (_sameAsOfficial) _copyOfficialToCurrent();

      await ref.read(basicProfileServiceProvider).update(_p);
      await ref.read(talentServiceProvider).updateFields({
        'full_name': _fullName.text.trim(),
        'languages_spoken':
            _languages.where((e) => e.language.isNotEmpty).map((e) => e.toJson()).toList(),
      });
      await ref.read(jobsServiceProvider).updatePreferences({
        'preferred_locations': _preferredLocations.map((e) => e.toJson()).toList(),
        'preferred_job_types': [
          if (_p.availability.contains('full_time')) 'Full-time',
          if (_p.availability.contains('part_time')) 'Part-time',
        ],
        'open_to_relocation': _openToRelocation,
        'expected_salary_monthly':
            _p.expectedSalaryFullTime ?? _p.expectedSalaryPartTime,
        'notice_period_days': int.tryParse(_notice.text.trim()),
      });

      ref.invalidate(talentMeProvider);
      ref.invalidate(jobOptInProvider);
      ref.invalidate(onboardingProgressProvider);
      await ref.read(authProvider.notifier).refreshUser();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Basic profile saved')),
        );
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

  void _copyOfficialToCurrent() {
    _p.currentAddress = _p.permanentAddress;
    _p.country = _p.permanentCountry;
    _p.state = _p.permanentState;
    _p.currentDistrict = _p.permanentDistrict;
    _p.city = _p.permanentCity;
    _p.pinCode = _p.permanentPinCode;
  }

  /// Sections in form order; the freelance tab only appears when freelance
  /// work is selected (mirrors the old stacked layout). Completion checks
  /// mirror the web's BasicProfileForm heuristics.
  List<_SectionSpec> get _sections => [
        _SectionSpec(
          label: 'Basic details',
          icon: Icons.person_outline,
          build: _basicDetails,
          done: () => _fullName.text.trim().isNotEmpty,
        ),
        _SectionSpec(
          label: 'Languages',
          icon: Icons.translate_outlined,
          build: _languagesSection,
          done: () => _languages.isNotEmpty &&
              _languages.any((l) => l.proficiency == 'native'),
        ),
        _SectionSpec(
          label: 'Address',
          icon: Icons.home_outlined,
          build: _addressSection,
          done: () => _p.permanentCountry.isNotEmpty &&
              _p.permanentState.isNotEmpty &&
              _p.permanentDistrict.isNotEmpty &&
              _p.permanentCity.isNotEmpty,
        ),
        _SectionSpec(
          label: 'Education & courses',
          icon: Icons.school_outlined,
          build: _educationSection,
          done: () => _p.educationCourses
              .any((e) => e.courseName.isNotEmpty && e.institution.isNotEmpty),
        ),
        _SectionSpec(
          label: 'Experience',
          icon: Icons.work_history_outlined,
          build: _experienceSection,
          done: () => _p.experience
              .any((e) => e.companyName.isNotEmpty && e.designation.isNotEmpty),
        ),
        _SectionSpec(
          label: 'Job preference',
          icon: Icons.tune,
          build: _jobPreferenceSection,
          done: () => _p.availability.isNotEmpty && _p.jobType.isNotEmpty,
        ),
        if (_p.employmentType.contains('freelance'))
          _SectionSpec(
            label: 'Freelance',
            icon: Icons.handshake_outlined,
            build: _freelanceSection,
            done: () => _p.freelanceAvailable,
          ),
        _SectionSpec(
          label: 'Profile picture',
          icon: Icons.account_circle_outlined,
          build: _pictureSection,
          done: () => _p.profilePictureUrl?.isNotEmpty ?? false,
        ),
        _SectionSpec(
          label: 'ID proofs',
          icon: Icons.badge_outlined,
          build: _idProofsSection,
          done: () => _p.aadhaarNumber.isNotEmpty || _p.panNumber.isNotEmpty,
          optional: true,
        ),
        _SectionSpec(
          label: 'Bank account',
          icon: Icons.account_balance_outlined,
          build: _bankSection,
          done: () => _p.bankAccountHolder.isNotEmpty &&
              _p.bankAccountNumber.isNotEmpty &&
              _p.bankIfscCode.isNotEmpty,
          optional: true,
        ),
        _SectionSpec(
          label: 'Resume',
          icon: Icons.description_outlined,
          build: _resumeSection,
          done: () => _p.resumeUrl?.isNotEmpty ?? false,
          optional: true,
        ),
      ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Basic profile')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error
              ? AppErrorRetry(onRetry: _load)
              : Builder(builder: (_) {
                  final sections = _sections;
                  final active = _active.clamp(0, sections.length - 1);
                  return Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                        child: _headerCard(sections),
                      ),
                      const SizedBox(height: 10),
                      _tabStrip(sections, active),
                      Expanded(
                        child: SingleChildScrollView(
                          padding: const EdgeInsets.all(16),
                          child: sections[active].build(),
                        ),
                      ),
                    ],
                  );
                }),
      bottomNavigationBar: (_loading || _error)
          ? null
          : _navBar(),
    );
  }

  // ─── Header / tabs / nav ──────────────────────────────────────────────────

  /// One-line header: title + "done/total" pill + small progress ring.
  Widget _headerCard(List<_SectionSpec> sections) {
    final counted = sections.where((s) => !s.optional).toList();
    final doneCount = counted.where((s) => s.done()).length;
    final pct = counted.isEmpty
        ? 0
        : (doneCount / counted.length * 100).round();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              'Complete your profile.',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.2,
                    color: AppColors.textPrimary,
                  ),
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              '$doneCount/${counted.length}',
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: AppColors.textSecondary,
              ),
            ),
          ),
          const SizedBox(width: 8),
          SizedBox(
            width: 36,
            height: 36,
            child: Stack(
              alignment: Alignment.center,
              children: [
                CircularProgressIndicator(
                  value: pct / 100,
                  strokeWidth: 4,
                  strokeCap: StrokeCap.round,
                  backgroundColor: AppColors.border,
                  valueColor: const AlwaysStoppedAnimation(AppColors.primary),
                ),
                Text(
                  '$pct%',
                  style: const TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// Horizontally scrollable section tabs — tap to open that section.
  Widget _tabStrip(List<_SectionSpec> sections, int active) {
    return SizedBox(
      height: 40,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Row(
          children: [
            for (var i = 0; i < sections.length; i++) _tabChip(sections, i, active),
          ],
        ),
      ),
    );
  }

  Widget _tabChip(List<_SectionSpec> sections, int i, int active) {
    final s = sections[i];
    final isActive = i == active;
    final complete = s.done();
    final Color bg;
    final Color fg;
    var borderColor = AppColors.border;
    if (isActive) {
      bg = AppColors.primary;
      fg = Colors.white;
    } else if (complete) {
      bg = AppColors.successBg;
      fg = const Color(0xFF15803D);
      borderColor = const Color(0xFFBBF7D0);
    } else {
      bg = AppColors.card;
      fg = AppColors.textSecondary;
    }
    final key = (_tabKeys[i] ??= GlobalKey());
    return Padding(
      key: key,
      padding: const EdgeInsets.only(right: 6),
      child: Material(
        color: bg,
        borderRadius: BorderRadius.circular(999),
        child: InkWell(
          borderRadius: BorderRadius.circular(999),
          onTap: () => _selectTab(i),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: borderColor),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                complete
                    ? Icon(Icons.check,
                        size: 14,
                        color: isActive ? Colors.white : const Color(0xFF16A34A))
                    : Icon(Icons.close,
                        size: 13,
                        color:
                            isActive ? const Color(0xFFFCA5A5) : AppColors.danger),
                const SizedBox(width: 6),
                Text(
                  s.label,
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                    color: fg,
                  ),
                ),
                if (!complete && !isActive && s.optional) ...[
                  const SizedBox(width: 4),
                  const Text(
                    '· Optional',
                    style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w500,
                        color: AppColors.textMuted),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _selectTab(int i) {
    setState(() => _active = i);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final ctx = _tabKeys[i]?.currentContext;
      if (ctx != null) {
        Scrollable.ensureVisible(
          ctx,
          duration: const Duration(milliseconds: 250),
          alignment: 0.5,
        );
      }
    });
  }

  /// Prev | Save | Next bar (mirrors the web's sticky action bar).
  Widget _navBar() {
    final sections = _sections;
    final active = _active.clamp(0, sections.length - 1);
    return SafeArea(
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: AppColors.border)),
        ),
        child: Row(
          children: [
            OutlinedButton(
              onPressed:
                  active == 0 ? null : () => setState(() => _active = active - 1),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(48, 48),
                padding: EdgeInsets.zero,
              ),
              child: const Icon(Icons.arrow_back_ios_new, size: 16),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: SizedBox(
                height: 48,
                child: ElevatedButton(
                  onPressed: _saving ? null : _save,
                  child: _saving
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2.4, color: Colors.white),
                        )
                      : const Text('Save'),
                ),
              ),
            ),
            const SizedBox(width: 10),
            OutlinedButton(
              onPressed: active >= sections.length - 1
                  ? null
                  : () => setState(() => _active = active + 1),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(48, 48),
                padding: EdgeInsets.zero,
              ),
              child: const Icon(Icons.arrow_forward_ios, size: 16),
            ),
          ],
        ),
      ),
    );
  }

  // ─── Sections ──────────────────────────────────────────────────────────────

  Widget _basicDetails() {
    return TitledCard(
      title: 'Basic details',
      icon: Icons.person_outline,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextField(
            controller: _fullName,
            decoration: const InputDecoration(labelText: 'Full name'),
          ),
          const SizedBox(height: 16),
          const SectionLabel('Work preference'),
          MultiSelectChips(
            options: const [
              (value: 'salary', label: 'Salaried job'),
              (value: 'freelance', label: 'Freelance'),
              (value: 'partner_program', label: 'Partner program'),
            ],
            selected: _p.employmentType,
            onChanged: (v) => setState(() {
              // Partner program implies freelance (mirrors the web).
              final next = {...v};
              if (next.contains('partner_program')) next.add('freelance');
              if (!next.contains('freelance')) next.remove('partner_program');
              _p.employmentType = next.toList();
            }),
          ),
        ],
      ),
    );
  }

  Widget _languagesSection() {
    return TitledCard(
      title: 'Languages',
      icon: Icons.translate_outlined,
      child: LanguagePicker(
        value: _languages,
        onChanged: (v) => setState(() => _languages = v),
      ),
    );
  }

  Widget _addressSection() {
    return TitledCard(
      title: 'Address',
      icon: Icons.home_outlined,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionLabel('Official address'),
          _addressBlock(official: true),
          const SizedBox(height: 12),
          CheckboxListTile(
            value: _sameAsOfficial,
            onChanged: (v) => setState(() => _sameAsOfficial = v ?? false),
            contentPadding: EdgeInsets.zero,
            controlAffinity: ListTileControlAffinity.leading,
            title: const Text('Current address is the same as official',
                style: TextStyle(fontSize: 14)),
          ),
          if (!_sameAsOfficial) ...[
            const SizedBox(height: 8),
            const SectionLabel('Current address'),
            _addressBlock(official: false),
          ],
        ],
      ),
    );
  }

  Widget _addressBlock({required bool official}) {
    final country = official ? _p.permanentCountry : _p.country;
    final isIndia = country == 'India';
    return Column(
      children: [
        LabeledField(
          label: 'Address',
          value: official ? _p.permanentAddress : _p.currentAddress,
          maxLines: 2,
          onChanged: (v) => setState(() =>
              official ? _p.permanentAddress = v : _p.currentAddress = v),
        ),
        const SizedBox(height: 12),
        DropdownField<String>(
          label: 'Country',
          value: country.isEmpty ? null : country,
          items: kCountries,
          onChanged: (v) => setState(() =>
              official ? _p.permanentCountry = v ?? '' : _p.country = v ?? ''),
        ),
        const SizedBox(height: 12),
        if (isIndia)
          DropdownField<String>(
            label: 'State',
            value: (official ? _p.permanentState : _p.state).isEmpty
                ? null
                : (official ? _p.permanentState : _p.state),
            items: kIndianStates,
            onChanged: (v) => setState(() =>
                official ? _p.permanentState = v ?? '' : _p.state = v ?? ''),
          )
        else
          LabeledField(
            label: 'State',
            value: official ? _p.permanentState : _p.state,
            onChanged: (v) => setState(
                () => official ? _p.permanentState = v : _p.state = v),
          ),
        const SizedBox(height: 12),
        LabeledField(
          label: 'District',
          value: official ? _p.permanentDistrict : _p.currentDistrict,
          onChanged: (v) => setState(() =>
              official ? _p.permanentDistrict = v : _p.currentDistrict = v),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: LabeledField(
                label: 'City',
                value: official ? _p.permanentCity : _p.city,
                onChanged: (v) => setState(
                    () => official ? _p.permanentCity = v : _p.city = v),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: LabeledField(
                label: 'PIN code',
                value: official ? _p.permanentPinCode : _p.pinCode,
                keyboardType: TextInputType.number,
                onChanged: (v) => setState(() =>
                    official ? _p.permanentPinCode = v : _p.pinCode = v),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _educationSection() {
    return TitledCard(
      title: 'Education & courses',
      icon: Icons.school_outlined,
      child: RepeatableList(
        items: _p.educationCourses,
        emptyLabel: 'No education added yet.',
        addLabel: 'Add education',
        onAdd: () => setState(() => _p.educationCourses = [..._p.educationCourses, EducationEntry()]),
        onRemove: (i) => setState(() {
          final l = [..._p.educationCourses]..removeAt(i);
          _p.educationCourses = l;
        }),
        itemBuilder: (i) {
          final e = _p.educationCourses[i];
          return Column(
            children: [
              FromToRow(
                fromYear: e.fromYear,
                fromMonth: e.fromMonth,
                toYear: e.toYear,
                toMonth: e.toMonth,
                onChanged: (fy, fm, ty, tm) => setState(() {
                  e.fromYear = fy;
                  e.fromMonth = fm;
                  e.toYear = ty;
                  e.toMonth = tm;
                }),
              ),
              const SizedBox(height: 10),
              LabeledField(
                label: 'Course / program',
                value: e.courseName,
                onChanged: (v) => setState(() => e.courseName = v),
              ),
              const SizedBox(height: 10),
              LabeledField(
                label: 'Institution',
                value: e.institution,
                onChanged: (v) => setState(() => e.institution = v),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _experienceSection() {
    return TitledCard(
      title: 'Experience',
      icon: Icons.work_history_outlined,
      child: RepeatableList(
        items: _p.experience,
        emptyLabel: 'No experience added yet.',
        addLabel: 'Add experience',
        onAdd: () => setState(() => _p.experience = [..._p.experience, ExperienceEntry()]),
        onRemove: (i) => setState(() {
          final l = [..._p.experience]..removeAt(i);
          _p.experience = l;
        }),
        itemBuilder: (i) {
          final e = _p.experience[i];
          return Column(
            children: [
              FromToRow(
                fromYear: e.fromYear,
                fromMonth: e.fromMonth,
                toYear: e.toYear,
                toMonth: e.toMonth,
                onChanged: (fy, fm, ty, tm) => setState(() {
                  e.fromYear = fy;
                  e.fromMonth = fm;
                  e.toYear = ty;
                  e.toMonth = tm;
                }),
              ),
              const SizedBox(height: 10),
              LabeledField(
                label: 'Company',
                value: e.companyName,
                onChanged: (v) => setState(() => e.companyName = v),
              ),
              const SizedBox(height: 10),
              LabeledField(
                label: 'Designation',
                value: e.designation,
                onChanged: (v) => setState(() => e.designation = v),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _jobPreferenceSection() {
    final wantsFullTime = _p.availability.contains('full_time');
    final wantsPartTime = _p.availability.contains('part_time');
    return TitledCard(
      title: 'Job preference',
      icon: Icons.tune,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionLabel('Availability'),
          MultiSelectChips(
            options: const [
              (value: 'full_time', label: 'Full time'),
              (value: 'part_time', label: 'Part time'),
            ],
            selected: _p.availability,
            onChanged: (v) => setState(() => _p.availability = v),
          ),
          if (wantsFullTime) ...[
            const SizedBox(height: 12),
            LabeledField(
              label: 'Expected monthly salary — full time (₹)',
              value: _p.expectedSalaryFullTime?.toString() ?? '',
              keyboardType: TextInputType.number,
              onChanged: (v) => setState(() => _p.expectedSalaryFullTime = int.tryParse(v)),
            ),
          ],
          if (wantsPartTime) ...[
            const SizedBox(height: 12),
            LabeledField(
              label: 'Expected monthly salary — part time (₹)',
              value: _p.expectedSalaryPartTime?.toString() ?? '',
              keyboardType: TextInputType.number,
              onChanged: (v) => setState(() => _p.expectedSalaryPartTime = int.tryParse(v)),
            ),
          ],
          const SizedBox(height: 16),
          const SectionLabel('Work type'),
          MultiSelectChips(
            options: const [
              (value: 'remote', label: 'Remote'),
              (value: 'office', label: 'Office'),
              (value: 'hybrid', label: 'Hybrid'),
              (value: 'field', label: 'Field'),
            ],
            selected: _p.jobType,
            onChanged: (v) => setState(() => _p.jobType = v),
          ),
          const Divider(height: 28),
          const SectionLabel('Job openings — where you want to work'),
          PreferredLocationsEditor(
            value: _preferredLocations,
            onChanged: (v) => setState(() => _preferredLocations = v),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: LabeledField(
                  label: 'Notice period (days)',
                  value: _notice.text,
                  controller: _notice,
                  keyboardType: TextInputType.number,
                ),
              ),
            ],
          ),
          SwitchListTile(
            value: _openToRelocation,
            onChanged: (v) => setState(() => _openToRelocation = v),
            contentPadding: EdgeInsets.zero,
            title: const Text('Open to relocation', style: TextStyle(fontSize: 14)),
          ),
        ],
      ),
    );
  }

  Widget _freelanceSection() {
    return TitledCard(
      title: 'Freelance preference',
      icon: Icons.handshake_outlined,
      child: SwitchListTile(
        value: _p.freelanceAvailable,
        onChanged: (v) => setState(() => _p.freelanceAvailable = v),
        contentPadding: EdgeInsets.zero,
        title: const Text('Available to take freelance work', style: TextStyle(fontSize: 14)),
      ),
    );
  }

  Widget _pictureSection() {
    return TitledCard(
      title: 'Profile picture',
      icon: Icons.account_circle_outlined,
      child: FileUploadField(
        label: 'Photo (JPG or PNG)',
        value: _p.profilePictureUrl,
        folder: 'profile-pictures',
        allowedExtensions: const ['jpg', 'jpeg', 'png'],
        imagePreview: true,
        onChanged: (url) => setState(() => _p.profilePictureUrl = url),
      ),
    );
  }

  Widget _idProofsSection() {
    return TitledCard(
      title: 'ID proofs',
      icon: Icons.badge_outlined,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          LabeledField(
            label: 'Aadhaar number',
            value: _p.aadhaarNumber,
            keyboardType: TextInputType.number,
            onChanged: (v) => setState(() => _p.aadhaarNumber = v),
          ),
          const SizedBox(height: 12),
          FileUploadField(
            label: 'Aadhaar card copy',
            value: _p.aadhaarFileUrl,
            folder: 'aadhaar',
            allowedExtensions: const ['jpg', 'jpeg', 'png', 'pdf'],
            onChanged: (url) => setState(() => _p.aadhaarFileUrl = url),
          ),
          const SizedBox(height: 16),
          LabeledField(
            label: 'PAN number',
            value: _p.panNumber,
            textCapitalization: TextCapitalization.characters,
            onChanged: (v) => setState(() => _p.panNumber = v.toUpperCase()),
          ),
          const SizedBox(height: 12),
          FileUploadField(
            label: 'PAN card copy',
            value: _p.panFileUrl,
            folder: 'pan',
            allowedExtensions: const ['jpg', 'jpeg', 'png', 'pdf'],
            onChanged: (url) => setState(() => _p.panFileUrl = url),
          ),
        ],
      ),
    );
  }

  Widget _bankSection() {
    return TitledCard(
      title: 'Bank account',
      icon: Icons.account_balance_outlined,
      child: Column(
        children: [
          LabeledField(
            label: 'Account holder name',
            value: _p.bankAccountHolder,
            onChanged: (v) => setState(() => _p.bankAccountHolder = v),
          ),
          const SizedBox(height: 12),
          LabeledField(
            label: 'Bank name',
            value: _p.bankName,
            onChanged: (v) => setState(() => _p.bankName = v),
          ),
          const SizedBox(height: 12),
          LabeledField(
            label: 'Account number',
            value: _p.bankAccountNumber,
            keyboardType: TextInputType.number,
            onChanged: (v) => setState(() => _p.bankAccountNumber = v),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: LabeledField(
                  label: 'IFSC code',
                  value: _p.bankIfscCode,
                  textCapitalization: TextCapitalization.characters,
                  onChanged: (v) => setState(() => _p.bankIfscCode = v.toUpperCase()),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: LabeledField(
                  label: 'Branch',
                  value: _p.bankBranchName,
                  onChanged: (v) => setState(() => _p.bankBranchName = v),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _resumeSection() {
    return TitledCard(
      title: 'Resume',
      icon: Icons.description_outlined,
      child: FileUploadField(
        label: 'Resume (PDF)',
        value: _p.resumeUrl,
        folder: 'resumes',
        allowedExtensions: const ['pdf'],
        onChanged: (url) => setState(() => _p.resumeUrl = url),
      ),
    );
  }
}

/// One tab in the basic-profile section strip.
class _SectionSpec {
  final String label;
  final IconData icon;
  final Widget Function() build;
  final bool Function() done;
  final bool optional;

  const _SectionSpec({
    required this.label,
    required this.icon,
    required this.build,
    required this.done,
    this.optional = false,
  });
}
