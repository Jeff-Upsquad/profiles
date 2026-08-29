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

// Public preview for agency to see how they appear to businesses (category-filtered)
router.get('/preview', ctrl.getPublicPreview);
router.get('/public-view/:agencyId', ctrl.getPublicPreview);

// ── Requirement cards for agency (mirrors talent subscriptions feed) ──
router.get('/subscriptions', async (req, res, next) => {
  try {
    const { listForAgency } = await import('../services/agency-cards.service.js');
    const status = typeof req.query.status === 'string' ? req.query.status : 'pending';
    const items = await listForAgency(req.user!.id, { status, card_type: 'subscription' });
    res.json(items);
  } catch (e) { next(e); }
});
router.get('/subscriptions/unread-count', async (req, res, next) => {
  try {
    const { getUnreadCountAgency } = await import('../services/agency-cards.service.js');
    const count = await getUnreadCountAgency(req.user!.id);
    res.json({ count });
  } catch (e) { next(e); }
});
router.get('/assignments', async (req, res, next) => {
  try {
    const { listForAgency } = await import('../services/agency-cards.service.js');
    const status = typeof req.query.status === 'string' ? req.query.status : 'pending';
    const items = await listForAgency(req.user!.id, { status, card_type: 'assignment' });
    res.json(items);
  } catch (e) { next(e); }
});
// Hiring cards for agencies
router.get('/jobs', async (req, res, next) => {
  try {
    const { listForAgency } = await import('../services/agency-cards.service.js');
    const status = typeof req.query.status === 'string' ? req.query.status : 'pending';
    const items = await listForAgency(req.user!.id, { status, card_type: 'hiring' });
    res.json(items);
  } catch (e) { next(e); }
});
router.get('/cards', async (req, res, next) => {
  try {
    const { listForAgency } = await import('../services/agency-cards.service.js');
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const cardType = typeof req.query.card_type === 'string' ? req.query.card_type : undefined;
    const items = await listForAgency(req.user!.id, { status, card_type: cardType });
    res.json(items);
  } catch (e) { next(e); }
});

// Accept / decline a card (mirrors talent respond), gated on completed profile.
router.patch('/cards/:recipientId/respond', async (req, res, next) => {
  try {
    const { respondToSubscriptionSchema } = await import('../validators/subscription.validators.js');
    const params = { recipientId: req.params.recipientId };
    const body = respondToSubscriptionSchema.parse(req.body);
    const { assertAgencyCanRespond } = await import('../services/respond-gate.js');
    await assertAgencyCanRespond(req.user!.id);
    const { respondCard } = await import('../services/agency-cards.service.js');
    const result = await respondCard(req.user!.id, params.recipientId as string, body.action);
    res.json(result);
  } catch (e) { next(e); }
});

// Bidding on a card (mirrors talent assignment-offers), gated on completed profile.
router.get('/cards/:recipientId/offer', async (req, res, next) => {
  try {
    const { getOfferForAgencyRecipient } = await import('../services/agency-offers.service.js');
    const data = await getOfferForAgencyRecipient(req.user!.id, req.params.recipientId as string);
    res.json(data);
  } catch (e) { next(e); }
});
router.post('/cards/:recipientId/offer', async (req, res, next) => {
  try {
    const { submitOfferSchema } = await import('../validators/assignment-offers.validators.js');
    const body = submitOfferSchema.parse(req.body);
    const { assertAgencyCanRespond } = await import('../services/respond-gate.js');
    await assertAgencyCanRespond(req.user!.id);
    const { agencySubmitOrCounter } = await import('../services/agency-offers.service.js');
    const offer = await agencySubmitOrCounter(req.user!.id, req.params.recipientId as string, body);
    res.json({ offer });
  } catch (e) { next(e); }
});
router.post('/cards/:recipientId/offer/respond', async (req, res, next) => {
  try {
    const { talentOfferRespondSchema } = await import('../validators/assignment-offers.validators.js');
    const body = talentOfferRespondSchema.parse(req.body);
    const { assertAgencyCanRespond } = await import('../services/respond-gate.js');
    await assertAgencyCanRespond(req.user!.id);
    const { agencyRespondToOffer } = await import('../services/agency-offers.service.js');
    const offer = await agencyRespondToOffer(req.user!.id, req.params.recipientId as string, body);
    res.json({ offer });
  } catch (e) { next(e); }
});
// All offers across cards (for Bidding tab)
router.get('/offers', async (req, res, next) => {
  try {
    const { listAllAgencyOffers } = await import('../services/agency-offers.service.js');
    const offers = await listAllAgencyOffers(req.user!.id);
    res.json({ offers });
  } catch (e) { next(e); }
});

// Manual backfill: re-run card matching for this agency (use after profile/services update)
router.post('/cards/backfill', async (req, res, next) => {
  try {
    const { backfillCardsForAgency } = await import('../services/card-backfill.service.js');
    const inserted = await backfillCardsForAgency(req.user!.id);
    res.json({ inserted });
  } catch (e) { next(e); }
});

// End generic card action routes (must stay before /clients etc.)

router.get('/clients', (_req, res) => res.json([]));
router.get('/notifications', (_req, res) => res.json([]));
router.get('/notifications/unread-count', (_req, res) => res.json({ count: 0 }));
router.get('/conversations', (_req, res) => res.json([]));
router.get('/conversations/unread-count', (_req, res) => res.json({ count: 0 }));
router.get('/training', (_req, res) => res.json({ courses: [], sops: [] }));
router.get('/training/incomplete-count', (_req, res) => res.json({ count: 0 }));

export default router;
