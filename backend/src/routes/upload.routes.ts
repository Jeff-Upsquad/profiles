import { Router } from 'express';
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

// Key can contain slashes, so use a wildcard parameter
router.delete('/*', uploadController.deleteFile);

export default router;
