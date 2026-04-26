// Parser/validator for externally-hosted portfolio video links.
//
// Supports YouTube, Vimeo, Loom, Dropbox.
// Single source of truth — imported by both backend (server-side validation)
// and frontend (live URL detection in the uploader UI).
//
// NOTE: Google Drive was previously supported but removed because of
// reliability issues in production (sign-in walls on supposedly-public
// shares, third-party-cookie blocking in modern browsers). Existing rows
// with provider='gdrive' remain in the database (the CHECK constraint still
// allows them) and continue to render via the lightbox iframe — the parser
// just won't accept new Drive URLs. See plan
// .claude/plans/i-want-to-know-adaptive-lobster.md for context.

export type VideoProvider = 'youtube' | 'vimeo' | 'loom' | 'dropbox';

export interface ParsedVideo {
  provider: VideoProvider;
  /** Canonical/normalized form of the user-supplied share URL. */
  externalUrl: string;
  /** URL to use as iframe src or <video src>. */
  embedUrl: string;
  /** Whether the embed should be rendered as <iframe> or native <video>. */
  renderMode: 'iframe' | 'video';
  /** Optional poster image URL (deterministic for YouTube). */
  thumbnailUrl?: string;
}

const HOST_ALLOWLIST: Record<VideoProvider, RegExp> = {
  youtube: /^(www\.|m\.)?(youtube\.com|youtu\.be)$/i,
  vimeo: /^(www\.|player\.)?vimeo\.com$/i,
  loom: /^(www\.)?loom\.com$/i,
  dropbox: /^(www\.)?dropbox\.com$/i,
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

function parseVimeo(u: URL): ParsedVideo | null {
  // Accepts vimeo.com/123456789 or player.vimeo.com/video/123456789
  const m =
    u.pathname.match(/^\/(?:video\/)?(\d{6,})(?:\/|$)/) ||
    u.pathname.match(/^\/(\d{6,})(?:\/|$)/);
  if (!m) return null;
  const id = m[1];
  return {
    provider: 'vimeo',
    externalUrl: `https://vimeo.com/${id}`,
    embedUrl: `https://player.vimeo.com/video/${id}`,
    renderMode: 'iframe',
  };
}

function parseLoom(u: URL): ParsedVideo | null {
  const m = u.pathname.match(/^\/share\/([a-f0-9]{24,})(?:\/|$)/i);
  if (!m) return null;
  const id = m[1].toLowerCase();
  return {
    provider: 'loom',
    externalUrl: `https://www.loom.com/share/${id}`,
    embedUrl: `https://www.loom.com/embed/${id}`,
    renderMode: 'iframe',
  };
}

function parseDropbox(u: URL): ParsedVideo | null {
  // Accept either legacy /s/... or modern /scl/fi|fo/... share paths.
  if (!/^\/(s|scl)\//.test(u.pathname)) return null;
  // Force raw=1 so the URL streams the file bytes (playable in <video>).
  // Drop any dl=0/dl=1 params.
  const params = new URLSearchParams(u.search);
  params.delete('dl');
  params.set('raw', '1');
  const embedUrl = `https://${u.hostname}${u.pathname}?${params.toString()}`;
  // Canonicalize by stripping raw flag in the display URL.
  const externalParams = new URLSearchParams(u.search);
  externalParams.delete('raw');
  externalParams.delete('dl');
  const qs = externalParams.toString();
  const externalUrl =
    `https://${u.hostname}${u.pathname}` + (qs ? `?${qs}` : '');
  return {
    provider: 'dropbox',
    externalUrl,
    embedUrl,
    renderMode: 'video',
  };
}

const PARSERS: Record<VideoProvider, (u: URL) => ParsedVideo | null> = {
  youtube: parseYouTube,
  vimeo: parseVimeo,
  loom: parseLoom,
  dropbox: parseDropbox,
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

export const SUPPORTED_PROVIDERS: VideoProvider[] = [
  'youtube',
  'vimeo',
  'loom',
  'dropbox',
];

export const PROVIDER_DISPLAY_NAME: Record<VideoProvider, string> = {
  youtube: 'YouTube',
  vimeo: 'Vimeo',
  loom: 'Loom',
  dropbox: 'Dropbox',
};

/**
 * Display label for any provider that may exist in the database, including
 * legacy providers no longer accepted by the parser. Used by display
 * components rendering historical rows (e.g. existing GDrive items still
 * render via the lightbox iframe even though new pastes are rejected).
 */
export function legacyProviderDisplayName(provider: string): string {
  if (provider in PROVIDER_DISPLAY_NAME) {
    return PROVIDER_DISPLAY_NAME[provider as VideoProvider];
  }
  if (provider === 'gdrive') return 'Google Drive';
  return 'Video';
}
