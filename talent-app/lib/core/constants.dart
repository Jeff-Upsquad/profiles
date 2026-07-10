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
