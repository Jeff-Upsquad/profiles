import { Request, Response, NextFunction } from 'express';
import * as howItWorksService from '../services/how-it-works.service.js';

export async function getVideos(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await howItWorksService.getVideos();
    res.json(data);
  } catch (err) { next(err); }
}

export async function getActiveVideos(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await howItWorksService.getActiveVideos();
    res.json(data);
  } catch (err) { next(err); }
}

export async function createVideo(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await howItWorksService.createVideo(req.body);
    res.status(201).json(data);
  } catch (err) { next(err); }
}

export async function updateVideo(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await howItWorksService.updateVideo(req.params.id as string, req.body);
    res.json(data);
  } catch (err) { next(err); }
}

export async function deleteVideo(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await howItWorksService.deleteVideo(req.params.id as string);
    res.json(data);
  } catch (err) { next(err); }
}
