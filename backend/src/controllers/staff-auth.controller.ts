import { Request, Response, NextFunction } from 'express';
import * as service from '../services/staff-auth.service.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import type { StaffLoginInput, StaffSsoExchangeInput } from '../validators/staff-auth.validators.js';

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body as StaffLoginInput;
    const result = await service.login(email, password);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * "Sign in with SquadHub": the staff portal redirected the user to SquadHub,
 * which sent back a one-time code. Exchange it for a staff session. Public —
 * authentication is proven by the code, not a staff JWT.
 */
export async function ssoExchange(req: Request, res: Response, next: NextFunction) {
  try {
    const { code } = req.body as StaffSsoExchangeInput;
    const result = await service.loginViaSquadhub(code);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.staff) throw new AppError(401, 'Unauthenticated');
    res.json({
      user: {
        id: req.staff.id,
        email: req.staff.email,
        name: req.staff.name,
        role: 'staff',
      },
      grants: req.staff.grants,
    });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      await service.logout(auth.slice(7));
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
