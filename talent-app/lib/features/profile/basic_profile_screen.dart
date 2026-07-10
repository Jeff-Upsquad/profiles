import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/india_locations.dart';
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Basic profile')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error
              ? AppErrorRetry(onRetry: _load)
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    _basicDetails(),
                    const SizedBox(height: 12),
                    _languagesSection(),
                    const SizedBox(height: 12),
                    _addressSection(),
                    const SizedBox(height: 12),
                    _educationSection(),
                    const SizedBox(height: 12),
                    _experienceSection(),
                    const SizedBox(height: 12),
                    _jobPreferenceSection(),
                    if (_p.employmentType.contains('freelance')) ...[
                      const SizedBox(height: 12),
                      _freelanceSection(),
                    ],
                    const SizedBox(height: 12),
                    _pictureSection(),
                    const SizedBox(height: 12),
                    _idProofsSection(),
                    const SizedBox(height: 12),
                    _bankSection(),
                    const SizedBox(height: 12),
                    _resumeSection(),
                    const SizedBox(height: 24),
                  ],
                ),
      bottomNavigationBar: (_loading || _error)
          ? null
          : SaveBar(saving: _saving, onSave: _save),
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
