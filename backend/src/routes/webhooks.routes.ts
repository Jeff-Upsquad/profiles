import { Router } from 'express';
import * as webhooksController from '../controllers/webhooks.controller.js';
import * as squadcrmWebhookController from '../controllers/squadcrm-webhook.controller.js';
import {
  verifySquadhubSecret,
  verifySquadcrmSecret,
} from '../middleware/webhookAuth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  ingestSubscriptionCardSchema,
  manualAssignTalentSchema,
  removeAssignedTalentSchema,
  removeTalentFromCardSchema,
  externalIdParamSchema,
  cardSelectionWebhookSchema,
  cardSelectionUndoWebhookSchema,
  cardActivationWebhookSchema,
  talentAcceptedWebhookSchema,
} from '../validators/subscription.validators.js';

const router = Router();

router.post(
  '/squadhub/cards',
  verifySquadhubSecret,
  validate({ body: ingestSubscriptionCardSchema }),
  webhooksController.ingestSubscriptionCard
);

// SquadHub admin hand-picked a talent for a soft-published card. Upserts a
// pending recipient row so the talent sees the card in their subscription
// tab. Idempotent on (card_id, talent_user_id).
router.post(
  '/squadhub/cards/manual-assignments',
  verifySquadhubSecret,
  validate({ body: manualAssignTalentSchema }),
  webhooksController.manualAssignTalent
);

// SquadHub admin removed a previously-assigned talent. Drops the recipient
// row so the card disappears from the talent's subscription tab. Idempotent.
router.post(
  '/squadhub/cards/manual-assignments/remove',
  verifySquadhubSecret,
  validate({ body: removeAssignedTalentSchema }),
  webhooksController.removeAssignedTalent
);

// SquadHub admin auto-accepted a card on a talent's behalf
// (POST /admin/subscription-cards/:id/auto-accept-talent). Mirrors the
// status to 'accepted' here and surfaces the talent in the linked
// business dashboard, so the SquadHire portal stays in sync.
router.post(
  '/squadhub/cards/talent-accepted',
  verifySquadhubSecret,
  validate({ body: talentAcceptedWebhookSchema }),
  webhooksController.handleTalentAccepted
);

// Hide a previously-shared talent from the linked business's dashboard.
// Idempotent: returns { removed: 0 } if the row was already gone.
router.post(
  '/squadhub/cards/:externalId/remove-talent',
  verifySquadhubSecret,
  validate({ params: externalIdParamSchema, body: removeTalentFromCardSchema }),
  webhooksController.removeTalentFromCard
);

// SquadHub admin selected (or un-selected) a recipient for a card.
router.post(
  '/squadhub/cards/selection',
  verifySquadhubSecret,
  validate({ body: cardSelectionWebhookSchema }),
  webhooksController.handleCardSelection
);

router.post(
  '/squadhub/cards/undo-selection',
  verifySquadhubSecret,
  validate({ body: cardSelectionUndoWebhookSchema }),
  webhooksController.handleCardSelectionUndo
);

// SquadHub admin finalized the selection — moves the card from
// Selected → Assigned and flips the talent's My Clients tab accordingly.
router.post(
  '/squadhub/cards/activation',
  verifySquadhubSecret,
  validate({ body: cardActivationWebhookSchema }),
  webhooksController.handleCardActivation
);

// Returns the full talent recipient list for a card (by SquadHub external_id).
// SquadHub admin calls this to show the full broadcast audience.
router.post(
  '/squadhub/cards/recipients',
  verifySquadhubSecret,
  webhooksController.getCardRecipients
);

// SquadHire CRM (shcrm) reports a Kanban card move so we can mirror the new
// stage onto lead_submissions.status. Pairs with the outbound webhook in
// automation.service.ts:onLeadStatusChanged for two-way status sync. Loop
// guarded via the source='crm_webhook' flag inside updateLeadStatus.
router.post(
  '/squadcrm/lead-stage',
  verifySquadcrmSecret,
  squadcrmWebhookController.handleLeadStageChanged,
);

export default router;
