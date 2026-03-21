import { Request, Response, NextFunction } from 'express';
import * as adminService from '../services/admin.service.js';

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function getDashboardStats(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.getDashboardStats();
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function getCategories(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.getCategories();
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function createCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.createCategory(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.updateCategory(req.params.id as string, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function archiveCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const { is_active } = req.body;
    const result = await adminService.archiveCategory(req.params.id as string, is_active ?? false);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Category Fields
// ---------------------------------------------------------------------------

export async function getCategoryFields(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.getCategoryFields(req.params.id as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function createField(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.createField(req.params.id as string, req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateField(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.updateField(req.params.fieldId as string, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function deleteField(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.deleteField(req.params.fieldId as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function reorderFields(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.reorderFields(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Field Options
// ---------------------------------------------------------------------------

export async function getFieldOptions(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.getFieldOptions(req.params.fieldId as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function createOption(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.createOption(req.params.fieldId as string, req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateOption(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.updateOption(req.params.optId as string, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function deleteOption(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.deleteOption(req.params.optId as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function reorderOptions(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.reorderOptions(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Profile Reviews
// ---------------------------------------------------------------------------

export async function getReviewQueue(req: Request, res: Response, next: NextFunction) {
  try {
    const categoryId = req.query.category_id as string | undefined;
    const result = await adminService.getReviewQueue(categoryId);
    res.json({ profiles: result });
  } catch (err) {
    next(err);
  }
}

export async function getReviewProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.getReviewProfile(req.params.profileId as string);
    res.json({ profile: result });
  } catch (err) {
    next(err);
  }
}

export async function approveProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.approveProfile(req.params.profileId as string, req.user!.id);
    res.json({ profile: result });
  } catch (err) {
    next(err);
  }
}

export async function rejectProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const { reason } = req.body;
    if (!reason) {
      res.status(400).json({ message: 'Rejection reason is required' });
      return;
    }
    const result = await adminService.rejectProfile(req.params.profileId as string, req.user!.id, reason);
    res.json({ profile: result });
  } catch (err) {
    next(err);
  }
}

export async function bulkApproveProfiles(req: Request, res: Response, next: NextFunction) {
  try {
    const { profile_ids } = req.body;
    const result = await adminService.bulkApproveProfiles(profile_ids, req.user!.id);
    res.json({ results: result });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// User Management
// ---------------------------------------------------------------------------

export async function getTalentUsers(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.getTalentUsers();
    res.json({ users: result });
  } catch (err) {
    next(err);
  }
}

export async function getBusinessUsers(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.getBusinessUsers();
    res.json({ users: result });
  } catch (err) {
    next(err);
  }
}

export async function suspendUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { suspend } = req.body;
    const result = await adminService.suspendUser(req.params.id as string, suspend ?? true);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Recycle Bin
// ---------------------------------------------------------------------------

export async function getRecycleBin(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.getRecycleBin();
    res.json({ profiles: result });
  } catch (err) {
    next(err);
  }
}

export async function restoreProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.restoreProfile(req.params.profileId as string);
    res.json({ profile: result });
  } catch (err) {
    next(err);
  }
}

export async function permanentlyDeleteProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminService.permanentlyDeleteProfile(req.params.profileId as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
