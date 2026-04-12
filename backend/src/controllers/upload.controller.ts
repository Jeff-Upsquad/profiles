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

export async function uploadFile(req: Request, res: Response, next: NextFunction) {
  try {
    const fileName = req.query.fileName as string;
    const folder = req.query.folder as string | undefined;
    const contentType = req.headers['content-type'] || 'application/octet-stream';

    if (!fileName) {
      res.status(400).json({ message: 'fileName query parameter is required' });
      return;
    }

    const result = await storageService.uploadFile({
      userId: req.user!.id,
      fileName,
      contentType,
      folder,
      body: req.body as Buffer,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function deleteFile(req: Request, res: Response, next: NextFunction) {
  try {
    const key = req.params.key as string;
    const result = await storageService.deleteFile(key);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
