import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service.js';
import * as businessAuthService from '../services/business-auth.service.js';
import * as passwordResetService from '../services/password-reset.service.js';

export async function signupTalent(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.signupTalent(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function businessLogin(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await businessAuthService.businessLogin({
      email: req.body.email,
      phone: req.body.phone,
      password: req.body.password,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function businessSignup(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await businessAuthService.businessSignup({
      email: req.body.email,
      phone: req.body.phone,
      name: req.body.name,
      company_name: req.body.company_name,
      password: req.body.password,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function businessChangePassword(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await businessAuthService.changeBusinessPassword(req.user!.id, {
      current_password: req.body.current_password,
      new_password: req.body.new_password,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function requestAccess(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await businessAuthService.requestAccess({
      email: req.body.email,
      phone: req.body.phone,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function checkCandidateStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.checkCandidateStatus(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.login(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) {
      res.status(400).json({ error: 'refresh_token is required' });
      return;
    }
    const result = await authService.refreshToken(refresh_token);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function businessRefresh(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing token' });
      return;
    }
    const oldToken = authHeader.slice(7);
    const result = await businessAuthService.refreshSession(oldToken, req.user!.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.forgotPassword(req.body.email);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.resetPassword(req.body.access_token, req.body.new_password);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ─── Self-serve WhatsApp password reset ──────────────────────────────────────

export async function passwordResetLookup(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await passwordResetService.lookupAccountByPhone(req.body.phone);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function passwordResetSend(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await passwordResetService.sendTempPassword(req.body.reset_ticket);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function passwordResetVerify(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await passwordResetService.verifyTempPassword(
      req.body.reset_ticket,
      req.body.temp_password,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.changePassword(req.user!.id, req.body.new_password);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    // For business users, invalidate the session server-side
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      await businessAuthService.businessLogout(token);
    }
    res.json({ message: 'Logged out successfully' });
  } catch {
    res.json({ message: 'Logged out successfully' });
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.getMe(req.user!.id, req.user!.role);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
