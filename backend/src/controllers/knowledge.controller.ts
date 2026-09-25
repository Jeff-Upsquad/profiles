import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler.middleware.js';

// Knowledge Center — what Squad Bot knows. Content arrives from SquadHub
// Resources (track 'knowledge'); the admin module is read-only here, with an
// "Edit in SquadHub" link per item.

// --- SquadHub → SquadHire (signed) ------------------------------------------

// Page/block shape is the training sync's; kept loose so a new block type in
// SquadHub never bounces a knowledge publish.
const pageSchema = z.object({
  id: z.string().min(1),
  parent_id: z.string().nullable(),
  title: z.string().min(1).max(300),
  summary: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  position: z.number().int().min(0),
  blocks: z.array(z.object({
    id: z.string().min(1),
    type: z.string().min(1),
    position: z.number().int().min(0),
    text_content: z.unknown().optional(),
    caption: z.string().nullable().optional(),
  }).passthrough()).default([]),
});

const syncSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(300),
  summary: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  knowledge_categories: z.array(z.string().min(1).max(100)).max(50).default([]),
  visible: z.boolean(),
  pages: z.array(pageSchema).max(500).default([]),
});

export async function syncFromSquadhub(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = syncSchema.parse(req.body);
    const svc = await import('../services/knowledge.service.js');
    res.json({ success: true, ...(await svc.syncKnowledgeItem(payload as any)) });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, err.errors[0]?.message ?? 'Invalid knowledge payload'));
      return;
    }
    next(err);
  }
}

export async function categoriesForSquadhub(_req: Request, res: Response, next: NextFunction) {
  try {
    const svc = await import('../services/knowledge.service.js');
    res.json({ categories: await svc.listKnowledgeCategories() });
  } catch (err) {
    next(err);
  }
}

// --- Admin ------------------------------------------------------------------

export async function listCategories(_req: Request, res: Response, next: NextFunction) {
  try {
    const svc = await import('../services/knowledge.service.js');
    const [categories, counts] = await Promise.all([svc.listKnowledgeCategories(), svc.knowledgeCategoryCounts()]);
    res.json({ categories: categories.map((c) => ({ ...c, count: counts[c.key] ?? 0 })) });
  } catch (err) {
    next(err);
  }
}

export async function listItems(req: Request, res: Response, next: NextFunction) {
  try {
    const svc = await import('../services/knowledge.service.js');
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    res.json({ items: await svc.listKnowledgeItems({ category, q }) });
  } catch (err) {
    next(err);
  }
}

export async function getItem(req: Request, res: Response, next: NextFunction) {
  try {
    const svc = await import('../services/knowledge.service.js');
    res.json(await svc.getKnowledgeItem(req.params.id as string));
  } catch (err) {
    next(err);
  }
}

export async function listSuggestions(req: Request, res: Response, next: NextFunction) {
  try {
    const svc = await import('../services/knowledge.service.js');
    const status = req.query.status === 'approved' || req.query.status === 'rejected' ? req.query.status : 'pending';
    res.json({ suggestions: await svc.listKnowledgeSuggestions(status) });
  } catch (err) {
    next(err);
  }
}

// --- Learning loop: review drafted suggestions --------------------------------

const approveSchema = z.object({
  question: z.string().trim().min(3).max(200),
  answer: z.string().trim().min(1).max(8000),
  categories: z.array(z.string().min(1).max(100)).min(1, 'Pick at least one category').max(50),
});

function reviewer(req: Request): { authUserId: string | null; name: string } {
  // Staff users sign in with their own token (no auth.users row); admins do.
  if (req.staff) return { authUserId: null, name: req.staff.name || req.staff.email };
  return { authUserId: req.user?.id ?? null, name: (req.user?.email ?? 'admin').split('@')[0] };
}

export async function approveSuggestion(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = approveSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, parsed.error.errors[0]?.message ?? 'Invalid answer');
    const svc = await import('../services/knowledge-learning.service.js');
    res.json(await svc.approveSuggestion(req.params.id as string, parsed.data, reviewer(req)));
  } catch (err) {
    next(err);
  }
}

export async function rejectSuggestion(req: Request, res: Response, next: NextFunction) {
  try {
    const svc = await import('../services/knowledge-learning.service.js');
    res.json(await svc.rejectSuggestion(req.params.id as string, reviewer(req)));
  } catch (err) {
    next(err);
  }
}
