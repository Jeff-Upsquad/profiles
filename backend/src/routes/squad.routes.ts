import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import * as ctrl from '../controllers/squad.controller.js';
import { createSquadInviteSchema, squadSignupSchema, updateSquadMemberSelfSchema, createSquadJobProfileSchema } from '../validators/squad.validators.js';

const router = Router();

// Public — squad member signup via invite (email + password only)
router.post('/signup', validate({ body: squadSignupSchema }), ctrl.squadSignup);

// Agency creates invites (requires agency)
const agencyInviteRouter = Router();
agencyInviteRouter.use(authenticate, requireRole('agency'));
agencyInviteRouter.post('/invite', validate({ body: createSquadInviteSchema }), ctrl.createInvite);
agencyInviteRouter.get('/list', ctrl.listInvites);

// Squad self-service (requires squad role)
const squadSelfRouter = Router();
squadSelfRouter.use(authenticate, requireRole('squad_member','squad_manager'));
squadSelfRouter.get('/me', ctrl.getSquadMe);
squadSelfRouter.put('/me', validate({ body: updateSquadMemberSelfSchema }), ctrl.updateSquadMe);
squadSelfRouter.get('/profiles', ctrl.listMyJobProfiles);
squadSelfRouter.post('/profiles', validate({ body: createSquadJobProfileSchema }), ctrl.createMyJobProfile);
squadSelfRouter.put('/profiles/:id', ctrl.updateMyJobProfile);
squadSelfRouter.delete('/profiles/:id', ctrl.deleteMyJobProfile);
squadSelfRouter.get('/allowed-categories', ctrl.getAllowedCategories);

export { agencyInviteRouter, squadSelfRouter };
export default router;
