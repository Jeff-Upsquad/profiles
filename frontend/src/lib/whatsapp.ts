// SquadHire talent-support WhatsApp number. Shared by Contact Support page,
// the "Quit a client" flow on the talent dashboard, and any other surface
// that deeplinks the talent to chat with the SquadHire CRM team.
export const SUPPORT_PHONE_DIGITS = '919995266342';
export const SUPPORT_PHONE_DISPLAY = '+91 99952 66342';

export function whatsappDeepLink(message: string): string {
  return `https://wa.me/${SUPPORT_PHONE_DIGITS}?text=${encodeURIComponent(message)}`;
}

// Squad CRM business-support WhatsApp number. Used by the Business Portal login
// (password-reset help) and any other business/employer-facing surface that
// deeplinks the user to chat with the Squad CRM team. Distinct from the
// talent-support number above.
export const BUSINESS_SUPPORT_PHONE_DIGITS = '919995266385';
export const BUSINESS_SUPPORT_PHONE_DISPLAY = '+91 99952 66385';

export function businessWhatsappDeepLink(message: string): string {
  return `https://wa.me/${BUSINESS_SUPPORT_PHONE_DIGITS}?text=${encodeURIComponent(message)}`;
}
