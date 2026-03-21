import { Request, Response, NextFunction } from 'express';
import * as storageService from '../services/storage.service.js';

export async function presign(req: Request, res: Response, next: NextFunction) {
  try {
    const { fileName, contentType, folder } = req.body;
    const result = await storageService.getPresignedUploadUrl({
      userId: req.user!.id,
      fileName,
      contentType,
      folder,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function deleteFile(req: Request, res: Response, next: NextFunction) {
  try {
    const key = req.params.key; // Capture the named wildcard portion
    const result = await storageService.deleteFile(key);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
