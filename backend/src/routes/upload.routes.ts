import express, { Router } from 'express';
import * as uploadController from '../controllers/upload.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { presignSchema } from '../validators/upload.validators.js';

const router = Router();

// All upload routes require authentication
router.use(authenticate);

router.post(
  '/presigned-url',
  validate({ body: presignSchema }),
  uploadController.presign
);

// Direct file upload (avoids CORS with R2)
router.post(
  '/file',
  express.raw({ type: ['image/*', 'application/pdf', 'video/*'], limit: '50mb' }),
  uploadController.uploadFile
);

// Key can contain slashes, so use a wildcard parameter (path-to-regexp v8 syntax)
router.delete('/*key', uploadController.deleteFile);

export default router;
