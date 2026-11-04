// SquadHire talent-support WhatsApp number. Shared by Contact Support page,
// the "Quit a client" flow on the talent dashboard, and any other surface
// that deeplinks the talent to chat with the SquadHire CRM team.
export const SUPPORT_PHONE_DIGITS = '919995266342';
export const SUPPORT_PHONE_DISPLAY = '+91 99952 66342';

export function whatsappDeepLink(message: string): string {
  return `https://wa.me/${SUPPORT_PHONE_DIGITS}?text=${encodeURIComponent(message)}`;
}

// Keep the dedicated business number so it can be restored later.
export const DEDICATED_BUSINESS_SUPPORT_PHONE_DIGITS = '919995266385';
export const DEDICATED_BUSINESS_SUPPORT_PHONE_DISPLAY = '+91 99952 66385';

// Temporarily route business/employer support to the talent-support number.
// To restore separate routing, use the dedicated business constants above.
export const BUSINESS_SUPPORT_PHONE_DIGITS = SUPPORT_PHONE_DIGITS;
export const BUSINESS_SUPPORT_PHONE_DISPLAY = SUPPORT_PHONE_DISPLAY;

export function businessWhatsappDeepLink(message: string): string {
  return `https://wa.me/${BUSINESS_SUPPORT_PHONE_DIGITS}?text=${encodeURIComponent(message)}`;
}
