/// Static reference lists shared by the profile/settings forms. Mirror the web
/// (`LanguagePicker.tsx`) so the app and web collect identical values.
library;

const List<String> kLanguages = [
  'Hindi',
  'Bengali',
  'Telugu',
  'Marathi',
  'Tamil',
  'Urdu',
  'Gujarati',
  'Kannada',
  'Malayalam',
  'Odia',
  'English',
];

const List<({String value, String label})> kProficiencyLevels = [
  (value: 'native', label: 'Native'),
  (value: 'fluent', label: 'Fluent'),
  (value: 'intermediate', label: 'Intermediate'),
  (value: 'basic', label: 'Basic'),
];

String proficiencyLabel(String value) {
  for (final p in kProficiencyLevels) {
    if (p.value == value) return p.label;
  }
  return value;
}
