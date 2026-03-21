import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service.js';

export async function signupTalent(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.signupTalent(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function signupBusiness(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.signupBusiness(req.body);
    res.status(201).json(result);
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

export async function logout(_req: Request, res: Response) {
  // JWT-based — client just discards the token. No server-side action needed.
  res.json({ message: 'Logged out successfully' });
}

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.getMe(req.user!.id, req.user!.role);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
