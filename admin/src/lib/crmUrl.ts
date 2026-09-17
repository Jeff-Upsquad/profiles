// SquadHire CRM (shcrm) web origin. One place for every "open in CRM" link and
// the chromeless /embed/* iframes, so a domain move is a single env change.
export const CRM_URL = (
  process.env.NEXT_PUBLIC_SQUADHIRE_CRM_URL || 'https://shcrm.squadhub.in'
).replace(/\/$/, '');

/** Deep-link to the CRM card for a phone (CRM resolves by last digits). */
export function crmLookupUrl(digits: string): string {
  return `${CRM_URL}/app/leads/lookup?phone=${encodeURIComponent(digits)}`;
}

/** Chromeless single-lead WhatsApp thread, for the admin's CRM chat slider. */
export function crmLeadChatEmbedUrl(digits: string): string {
  return `${CRM_URL}/embed/lead-chat?phone=${encodeURIComponent(digits)}`;
}
