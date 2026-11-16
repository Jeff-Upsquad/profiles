# WhatsApp template — `business_assignment_offer_accepted`

Notify the business when a talent accepts its subscription/assignment offer or
counter-offer. This is separate from accepting a card invitation.

- Name: `business_assignment_offer_accepted`
- Category: UTILITY
- Language: en
- Body:

```text
Hi {{1}}, {{2}} has accepted your offer for {{3}}. Open the card to review the agreed offer and continue with selection.
```

- Body parameters: business contact name, talent name, card title.
- Example values: Jeff, Fuhad AK, Video editing assignment.
- Button: URL, label `View card`.
- URL: `https://squadhire.upsquadconnect.com/business/card/{{1}}`
- URL parameter: the primary card ID, including for briefs grouped by tier.

Business messages use Squad CRM (`crm.squadhub.in`), whose system-event receiver
finds an APPROVED template with exactly this name in its configured workspace.
Create/approve the template there and sync it into CRM before expecting delivery.
No SquadHire CRM automation mapping is required for this business event.

The trigger respects the business's WhatsApp card-alert preference. It sends
immediately, independently of applicant/bid batching and cooldowns. Business-side
acceptance of a talent bid does not trigger this business notification. WhatsApp
failure cannot block acceptance or the existing in-app notification.
