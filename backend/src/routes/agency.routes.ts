import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import * as ctrl from '../controllers/agency.controller.js';
import {
  updateAgencyUserSchema,
  updateAgencyProfileSchema,
  createSquadMemberSchema,
  updateSquadMemberSchema,
  createAgencyMemberProfileSchema,
  updateAgencyMemberProfileSchema,
  createAgencyGeneralPortfolioSchema,
  updateAgencyGeneralPortfolioSchema,
  agencyPortfolioItemSchema,
} from '../validators/agency.validators.js';

const router = Router();
router.use(authenticate, requireRole('agency'));

// Agency user & profile
router.get('/me', ctrl.getMe);
router.put('/me', validate({ body: updateAgencyUserSchema }), ctrl.updateMe);
router.get('/profile', ctrl.getProfile);
router.put('/profile', validate({ body: updateAgencyProfileSchema }), ctrl.updateProfile);

// Squad members — direct create (agency) + invite flow
router.get('/squad', ctrl.listSquad);
router.post('/squad', validate({ body: createSquadMemberSchema }), ctrl.createSquad);
router.post('/squad/invite', async (req, _res, next) => {
  try {
    const { createSquadInviteSchema } = await import('../validators/squad.validators.js');
    const parsed = createSquadInviteSchema.parse(req.body);
    const { createSquadInvite } = await import('../services/squad.service.js');
    const data = await createSquadInvite(req.user!.id, parsed);
    _res.status(201).json(data);
  } catch (e) { next(e); }
});
router.put('/squad/:memberId', validate({ body: updateSquadMemberSchema }), ctrl.updateSquad);
router.delete('/squad/:memberId', ctrl.deleteSquad);

// Job profiles linked to squad members
router.get('/member-profiles', ctrl.listMemberProfiles);
router.post('/member-profiles', validate({ body: createAgencyMemberProfileSchema }), ctrl.createMemberProfile);
router.put('/member-profiles/:id', validate({ body: updateAgencyMemberProfileSchema }), ctrl.updateMemberProfile);
router.delete('/member-profiles/:id', ctrl.deleteMemberProfile);

// General portfolios (agency-level)
router.get('/general-portfolios', ctrl.listGeneral);
router.post('/general-portfolios', validate({ body: createAgencyGeneralPortfolioSchema }), ctrl.createGeneral);
router.put('/general-portfolios/:id', validate({ body: updateAgencyGeneralPortfolioSchema }), ctrl.updateGeneral);
router.delete('/general-portfolios/:id', ctrl.deleteGeneral);

// Portfolio items (for either member or general)
router.get('/portfolio', ctrl.listPortfolio);
router.post('/portfolio', validate({ body: agencyPortfolioItemSchema }), ctrl.addPortfolio);
router.delete('/portfolio/:itemId', ctrl.deletePortfolio);

// Total portfolio view
router.get('/total-portfolio', ctrl.getTotal);

// ── Talent-parity modules for agency (stubs returning empty/mock, so UI mirrors talent) ──
router.get('/subscriptions', (_req, res) => res.json([]));
router.get('/assignments', (_req, res) => res.json([]));
router.get('/clients', (_req, res) => res.json([]));
router.get('/notifications', (_req, res) => res.json([]));
router.get('/notifications/unread-count', (_req, res) => res.json({ count: 0 }));
router.get('/conversations', (_req, res) => res.json([]));
router.get('/conversations/unread-count', (_req, res) => res.json({ count: 0 }));
router.get('/training', (_req, res) => res.json({ courses: [], sops: [] }));
router.get('/training/incomplete-count', (_req, res) => res.json({ count: 0 }));

export default router;
