import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import type { AppCheckinInput } from '../validators/app-install.validators.js';

/**
 * Record a launch-time check-in from the talent mobile app. Upserts the user's
 * current-state row (one per user) and, whenever the version or platform differs
 * from what we last saw, appends an immutable history event so adoption of new
 * builds can be charted over time.
 */
export async function recordCheckin(userId: string, input: AppCheckinInput) {
  const { version_name, version_code, platform } = input;
  const now = new Date().toISOString();

  const { data: prev, error: readErr } = await supabaseAdmin
    .from('talent_app_installs')
    .select('version_code, platform')
    .eq('user_id', userId)
    .maybeSingle();
  if (readErr) throw new AppError(500, readErr.message);

  // first_seen_at is intentionally omitted: on insert it defaults to now(); on
  // conflict (existing row) it is left untouched so it keeps the original value.
  const { error: upsertErr } = await supabaseAdmin
    .from('talent_app_installs')
    .upsert(
      { user_id: userId, version_name, version_code, platform, last_seen_at: now, updated_at: now },
      { onConflict: 'user_id' },
    );
  if (upsertErr) throw new AppError(500, upsertErr.message);

  const changed = !prev || prev.version_code !== version_code || prev.platform !== platform;
  if (changed) {
    const { error: evErr } = await supabaseAdmin
      .from('talent_app_install_events')
      .insert({ user_id: userId, version_name, version_code, platform });
    if (evErr) throw new AppError(500, evErr.message);
  }
}
