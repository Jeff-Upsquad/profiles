// Parser/validator for externally-hosted portfolio video links.
//
// Currently scoped to YouTube only. Talents can paste a YouTube share URL
// alongside direct uploads. Vimeo, Loom, and Dropbox were previously
// accepted; they were trimmed back when the link feature was narrowed
// after Google Drive caused production issues. Existing rows of any
// historical provider still render via legacyProviderDisplayName.
//
// Single source of truth — imported by both backend (server-side
// validation) and frontend (live URL detection in the uploader UI).

export type VideoProvider = 'youtube';

export interface ParsedVideo {
  provider: VideoProvider;
  /** Canonical/normalized form of the user-supplied share URL. */
  externalUrl: string;
  /** URL to use as iframe src. */
  embedUrl: string;
  /** Always 'iframe' for YouTube. Kept as a discriminator in case other
   *  providers return for native <video> playback (e.g. Dropbox direct
   *  URLs in an earlier iteration). */
  renderMode: 'iframe' | 'video';
  /** Deterministic poster image URL. */
  thumbnailUrl?: string;
}

const HOST_ALLOWLIST: Record<VideoProvider, RegExp> = {
  youtube: /^(www\.|m\.)?(youtube\.com|youtu\.be)$/i,
};

/** Lightweight URL safety check — only https, no userinfo. */
function safeUrl(input: string): URL | null {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  if (u.username || u.password) return null;
  return u;
}

function matchHost(u: URL): VideoProvider | null {
  for (const [provider, pattern] of Object.entries(HOST_ALLOWLIST) as [
    VideoProvider,
    RegExp,
  ][]) {
    if (pattern.test(u.hostname)) return provider;
  }
  return null;
}

// ---------- Provider parsers ----------

function parseYouTube(u: URL): ParsedVideo | null {
  let id: string | null = null;
  if (u.hostname.endsWith('youtu.be')) {
    id = u.pathname.slice(1).split('/')[0] || null;
  } else if (u.pathname === '/watch') {
    id = u.searchParams.get('v');
  } else {
    const m = u.pathname.match(/^\/(?:embed|shorts)\/([\w-]{11})/);
    if (m) id = m[1];
  }
  if (!id || !/^[\w-]{11}$/.test(id)) return null;
  return {
    provider: 'youtube',
    externalUrl: `https://www.youtube.com/watch?v=${id}`,
    embedUrl: `https://www.youtube.com/embed/${id}`,
    renderMode: 'iframe',
    thumbnailUrl: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
  };
}

const PARSERS: Record<VideoProvider, (u: URL) => ParsedVideo | null> = {
  youtube: parseYouTube,
};

/**
 * Parse a user-pasted share URL into a structured embed descriptor.
 * Returns null if the URL is not from a supported provider, or is malformed,
 * or fails the safety guard (non-https, contains userinfo, etc.).
 */
export function parseVideoUrl(input: string): ParsedVideo | null {
  if (!input || typeof input !== 'string') return null;
  const u = safeUrl(input);
  if (!u) return null;
  const provider = matchHost(u);
  if (!provider) return null;
  return PARSERS[provider](u);
}

export const SUPPORTED_PROVIDERS: VideoProvider[] = ['youtube'];

export const PROVIDER_DISPLAY_NAME: Record<VideoProvider, string> = {
  youtube: 'YouTube',
};

/**
 * Display label for any provider that may exist in the database, including
 * legacy providers no longer accepted by the parser. Used by display
 * components rendering historical rows.
 */
export function legacyProviderDisplayName(provider: string): string {
  if (provider in PROVIDER_DISPLAY_NAME) {
    return PROVIDER_DISPLAY_NAME[provider as VideoProvider];
  }
  if (provider === 'vimeo') return 'Vimeo';
  if (provider === 'loom') return 'Loom';
  if (provider === 'dropbox') return 'Dropbox';
  if (provider === 'gdrive') return 'Google Drive';
  return 'Video';
}
