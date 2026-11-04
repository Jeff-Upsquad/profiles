export const BUSINESS_LINK_FIELDS = [
  { key: 'website', label: 'Website' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'x', label: 'X / Twitter' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'other', label: 'Other social media' },
] as const;
export type BusinessLinkKey = typeof BUSINESS_LINK_FIELDS[number]['key'];
export type BusinessLinks = Partial<Record<BusinessLinkKey, string>>;

/** Only public HTTP(S) links are rendered; ignore empty or malformed legacy data. */
export function normalizeBusinessLink(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 500) return null;
  const input = value.trim();
  if (/^[a-z][a-z\d+.-]*:/i.test(input) && !/^https?:\/\//i.test(input)) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || !url.hostname.includes('.')) return null;
    return url.href;
  } catch { return null; }
}

export function businessProfileLinks(profile: { company_website?: unknown; website?: unknown; social_links?: unknown; socials?: unknown } | null | undefined): BusinessLinks {
  const links: BusinessLinks = {};
  if (!profile) return links;
  const website = normalizeBusinessLink(profile.company_website || profile.website);
  if (website) links.website = website;
  const socials = profile.social_links || profile.socials;
  if (socials && typeof socials === 'object') for (const field of BUSINESS_LINK_FIELDS) {
    if (field.key === 'website') continue;
    const url = normalizeBusinessLink((socials as Record<string, unknown>)[field.key]);
    if (url) links[field.key] = url;
  }
  return links;
}
export function hasBusinessLink(links: BusinessLinks): boolean {
  return Object.values(links).some(value => normalizeBusinessLink(value) !== null);
}

/** Read only explicit client identity links, never campaign reference links. */
export function cardBusinessLinks(content: Record<string, unknown>): { label: string; url: string }[] {
  const snapshot = content.business_profile && typeof content.business_profile === 'object' ? content.business_profile as Record<string, unknown> : {};
  const explicit = content.client_links && typeof content.client_links === 'object' && !Array.isArray(content.client_links) ? content.client_links as Record<string, unknown> : {};
  const profile = businessProfileLinks({ company_website: explicit.website || content.company_website || snapshot.website, social_links: { ...((snapshot.socials as object) || {}), ...((content.social_links as object) || {}), ...explicit } });
  const links: { label: string; url: string }[] = BUSINESS_LINK_FIELDS.flatMap(field => profile[field.key] ? [{ label: field.label, url: profile[field.key]! }] : []);
  const additional = content.additional_requirements as Record<string, unknown> | undefined;
  const raw = additional?.client_links;
  for (const value of Array.isArray(raw) ? raw : []) {
    const url = normalizeBusinessLink(value);
    if (!url || links.some(link => link.url === url)) continue;
    const host = new URL(url).hostname.replace(/^www\./, '');
    const key = host === 'twitter.com' ? 'x' : host.split('.')[0];
    links.push({ label: BUSINESS_LINK_FIELDS.find(field => field.key === key)?.label || host, url });
  }
  return links;
}
