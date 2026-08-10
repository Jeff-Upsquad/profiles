import { Request, Response, NextFunction } from 'express';
import * as sopService from '../services/training-sop.service.js';

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export async function listSops(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await sopService.listSops());
  } catch (err) { next(err); }
}

export async function getSop(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await sopService.getSop(req.params.id as string));
  } catch (err) { next(err); }
}

export async function createSop(req: Request, res: Response, next: NextFunction) {
  try {
    const createdBy = (req as any).user?.id ?? null;
    res.status(201).json(await sopService.createSop(req.body, createdBy));
  } catch (err) { next(err); }
}

export async function updateSop(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await sopService.updateSop(req.params.id as string, req.body));
  } catch (err) { next(err); }
}

export async function archiveSop(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await sopService.archiveSop(req.params.id as string));
  } catch (err) { next(err); }
}

export async function listPages(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await sopService.listPages(req.params.id as string));
  } catch (err) { next(err); }
}

export async function createPage(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await sopService.createPage(req.params.id as string, req.body));
  } catch (err) { next(err); }
}

export async function updatePage(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await sopService.updatePage(req.params.pageId as string, req.body));
  } catch (err) { next(err); }
}

export async function deletePage(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await sopService.deletePage(req.params.pageId as string));
  } catch (err) { next(err); }
}

export async function reorderPages(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await sopService.reorderPages(req.body.items));
  } catch (err) { next(err); }
}

export async function listBlocks(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await sopService.listBlocks(req.params.pageId as string));
  } catch (err) { next(err); }
}

export async function createBlock(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await sopService.createBlock(req.params.pageId as string, req.body));
  } catch (err) { next(err); }
}

export async function updateBlock(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await sopService.updateBlock(req.params.blockId as string, req.body));
  } catch (err) { next(err); }
}

export async function deleteBlock(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await sopService.deleteBlock(req.params.blockId as string));
  } catch (err) { next(err); }
}

export async function reorderBlocks(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await sopService.reorderBlocks(req.body.items));
  } catch (err) { next(err); }
}

export async function getPageWithBlocks(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await sopService.getPageWithBlocks(req.params.pageId as string));
  } catch (err) { next(err); }
}

export async function shareSop(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await sopService.shareSop(req.params.id as string, req.body));
  } catch (err) { next(err); }
}

export async function getSopShareStats(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await sopService.getSopShareStats(req.params.id as string));
  } catch (err) { next(err); }
}

// ---------------------------------------------------------------------------
// Talent
// ---------------------------------------------------------------------------

export async function getMySops(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ sops: await sopService.getMySops(req.user!.id) });
  } catch (err) { next(err); }
}

export async function getSopForTalent(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await sopService.getSopForTalent(req.user!.id, req.params.id as string));
  } catch (err) { next(err); }
}

export async function completeSop(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await sopService.completeSop(req.user!.id, req.params.id as string));
  } catch (err) { next(err); }
}
