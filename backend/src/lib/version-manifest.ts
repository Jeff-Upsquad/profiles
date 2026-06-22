import fs from 'fs';
import path from 'path';

/**
 * The shape the mobile in-app updaters poll for. Mirrors the SquadHub partner
 * app's manifest exactly so the Flutter (talent-app) and Expo (admin-lite)
 * clients can share one server contract:
 *
 *   GET /api/<app>/version  ->  { success: true, data: VersionManifest }
 */
export interface VersionManifest {
  version_code: number;
  version_name: string;
  apk_url: string;
  sha256: string;
  release_notes: string;
  force_update: boolean;
  min_supported_version_code: number;
}

/**
 * Build a hot-reloading reader for one app's release manifest JSON file
 * (mirrors `partner-app.ts` on the SquadHub web server). The manifest is read
 * from disk, cached, and re-read whenever the file changes (5s poll), so a
 * release script can flip the manifest on the VPS without restarting the API.
 * If the file is missing/unreadable the reader returns `fallback`, so the
 * endpoint never 500s — clients just see "no update available".
 *
 * The path is resolved lazily on first use (env override, else `defaultFile`
 * relative to the process cwd) so `dotenv` has already populated `process.env`.
 */
export function createManifestLoader(opts: {
  /** Used only in log lines, e.g. 'talent-app/version'. */
  label: string;
  /** Name of the env var that may override the manifest path. */
  envVar: string;
  /** Default filename, resolved against process.cwd() when the env var is unset. */
  defaultFile: string;
  /** Returned whenever the file can't be read (keeps the endpoint up). */
  fallback: VersionManifest;
}): () => VersionManifest {
  let filePath: string | null = null;
  let cached: VersionManifest | null = null;
  let watching = false;

  const resolvePath = (): string => {
    if (filePath) return filePath;
    const fromEnv = process.env[opts.envVar];
    filePath = fromEnv ? path.resolve(fromEnv) : path.resolve(process.cwd(), opts.defaultFile);
    return filePath;
  };

  const load = (): VersionManifest => {
    const p = resolvePath();
    try {
      cached = JSON.parse(fs.readFileSync(p, 'utf8')) as VersionManifest;
      return cached;
    } catch (err) {
      console.warn(`[${opts.label}] manifest not loaded:`, (err as Error).message, 'at', p, '— using fallback');
      cached = null;
      return opts.fallback;
    }
  };

  const ensureWatch = (): void => {
    if (watching) return;
    watching = true;
    try {
      fs.watchFile(resolvePath(), { interval: 5000 }, () => {
        console.log(`[${opts.label}] manifest changed, reloading`);
        load();
      });
    } catch {
      /* ignore — falls back to a fresh read on each request */
    }
  };

  return () => {
    ensureWatch();
    return cached ?? load();
  };
}
