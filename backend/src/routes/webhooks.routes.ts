import { Router } from 'express';
import * as webhooksController from '../controllers/webhooks.controller.js';
import { verifySquadhubSecret } from '../middleware/webhookAuth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  ingestSubscriptionCardSchema,
  manualAssignTalentSchema,
  removeAssignedTalentSchema,
  removeTalentFromCardSchema,
  externalIdParamSchema,
  cardSelectionWebhookSchema,
  cardSelectionUndoWebhookSchema,
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

export default router;
