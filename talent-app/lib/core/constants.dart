const String appName = 'SquadHire';
const String appTagline = 'Powered by UpSquad';

const String apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'https://squadhire.upsquadconnect.com/api',
);

/// SquadHire talent-support WhatsApp number (shared by Contact Support and the
/// "Quit a client" flow). Mirrors `src/lib/whatsapp.ts` on the web.
const String supportPhoneDigits = '919995266342';
const String supportPhoneDisplay = '+91 99952 66342';

/// WhatsApp-capable dialling codes for the password-reset phone picker.
/// Mirrors `frontend/src/constants/country-codes.ts` on the web.
class CountryCode {
  final String code;
  final String label;
  const CountryCode(this.code, this.label);
}

const List<CountryCode> countryCodes = [
  CountryCode('+91', 'IN +91'),
  CountryCode('+1', 'US +1'),
  CountryCode('+44', 'GB +44'),
  CountryCode('+61', 'AU +61'),
  CountryCode('+971', 'AE +971'),
  CountryCode('+966', 'SA +966'),
  CountryCode('+65', 'SG +65'),
  CountryCode('+60', 'MY +60'),
  CountryCode('+974', 'QA +974'),
  CountryCode('+968', 'OM +968'),
  CountryCode('+973', 'BH +973'),
  CountryCode('+965', 'KW +965'),
  CountryCode('+49', 'DE +49'),
  CountryCode('+33', 'FR +33'),
  CountryCode('+39', 'IT +39'),
  CountryCode('+34', 'ES +34'),
  CountryCode('+31', 'NL +31'),
  CountryCode('+46', 'SE +46'),
  CountryCode('+41', 'CH +41'),
  CountryCode('+353', 'IE +353'),
  CountryCode('+64', 'NZ +64'),
  CountryCode('+27', 'ZA +27'),
  CountryCode('+234', 'NG +234'),
  CountryCode('+254', 'KE +254'),
  CountryCode('+63', 'PH +63'),
  CountryCode('+62', 'ID +62'),
  CountryCode('+66', 'TH +66'),
  CountryCode('+84', 'VN +84'),
  CountryCode('+880', 'BD +880'),
  CountryCode('+92', 'PK +92'),
  CountryCode('+94', 'LK +94'),
  CountryCode('+977', 'NP +977'),
  CountryCode('+86', 'CN +86'),
  CountryCode('+81', 'JP +81'),
  CountryCode('+82', 'KR +82'),
  CountryCode('+55', 'BR +55'),
  CountryCode('+52', 'MX +52'),
  CountryCode('+7', 'RU +7'),
  CountryCode('+90', 'TR +90'),
  CountryCode('+48', 'PL +48'),
  CountryCode('+47', 'NO +47'),
  CountryCode('+45', 'DK +45'),
  CountryCode('+358', 'FI +358'),
  CountryCode('+43', 'AT +43'),
  CountryCode('+32', 'BE +32'),
  CountryCode('+351', 'PT +351'),
];
