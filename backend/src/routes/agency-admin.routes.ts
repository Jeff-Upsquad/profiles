import { Router } from 'express';
import * as ctrl from '../controllers/agency-admin.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { z } from 'zod';

const router = Router();

const checkDupSchema = z.object({
  email: z.string().optional(),
  phone: z.string().optional(),
  exclude_id: z.string().optional(),
});

const updateAgencySchema = z.object({
  agency_name: z.string().min(1).max(300).optional(),
  agency_short_name: z.string().max(20).nullable().optional(),
  contact_person: z.string().max(200).nullable().optional(),
  contact_email: z.string().email().nullable().optional().or(z.literal('')),
  email: z.string().email().nullable().optional().or(z.literal('')),
  phone: z.string().max(20).nullable().optional(),
  whatsapp_number: z.string().max(20).nullable().optional(),
  website: z.string().max(500).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  location: z.string().max(300).nullable().optional(),
  logo_url: z.string().url().nullable().optional().or(z.literal('')),
  is_active: z.boolean().optional(),
}).passthrough();

router.get('/stats', ctrl.getStats);
router.get('/pending', ctrl.getPending);
router.get('/', ctrl.listAgencies);
router.post('/check-duplicate', ctrl.checkDuplicate);
router.get('/check-duplicate', validate({ query: checkDupSchema }), ctrl.checkDuplicate);
router.post('/bulk-approve', ctrl.bulkApprove);
router.get('/:id', ctrl.getDetail);
router.put('/:id', validate({ body: updateAgencySchema }), ctrl.updateAgency);
router.patch('/:id/approve', ctrl.approve);
router.patch('/:id/reject', ctrl.reject);
router.patch('/:id/active', ctrl.setActive);
router.patch('/:id/suspend', ctrl.suspend);
router.patch('/:id/blacklist', ctrl.blacklist);
router.delete('/:id', ctrl.remove);

export default router;
