import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import type { RegisterPushTokenInput, UnregisterPushTokenInput } from '../validators/push.validators.js';

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { token, platform } = req.body as RegisterPushTokenInput;

    const { error } = await supabaseAdmin
      .from('push_tokens')
      .upsert(
        { user_id: req.user.id, token, platform, last_seen_at: new Date().toISOString() },
        { onConflict: 'user_id,token' },
      );
    if (error) throw new AppError(500, error.message);

    res.json({ registered: true });
  } catch (err) {
    next(err);
  }
}

export async function unregister(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { token } = req.body as UnregisterPushTokenInput;

    await supabaseAdmin
      .from('push_tokens')
      .delete()
      .eq('user_id', req.user.id)
      .eq('token', token);

    res.json({ unregistered: true });
  } catch (err) {
    next(err);
  }
}

export async function appConfig(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const minVersion = process.env.TALENT_APP_MIN_VERSION ?? '1.0.0';
    const downloadUrl = process.env.TALENT_APP_DOWNLOAD_URL ?? '';

    res.json({ min_version: minVersion, download_url: downloadUrl });
  } catch (err) {
    next(err);
  }
}
