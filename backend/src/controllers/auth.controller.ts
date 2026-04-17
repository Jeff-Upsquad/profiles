import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service.js';
import * as businessAuthService from '../services/business-auth.service.js';

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
