# Talent inactive WhatsApp event

When an admin selects **Send template message via WhatsApp CRM**, Profiles sends
`talent_marked_inactive` to the SquadHire CRM system-events webhook configured
by `SQUADHIRE_CRM_SYSTEM_EVENTS_URL`. The event includes:

- `talent.name` and `talent.phone`
- `data.reason`
- `body_params[0]`: Talent name
- `body_params[1]`: the entered inactivity reason

Map `talent_marked_inactive` to an approved WhatsApp template in SquadHire CRM.
Suggested template body:

> Hi {{1}}, your SquadHire Talent profile is inactive. Reason: {{2}}. Your
> profile is hidden and you will not receive new subscription requests. Please
> contact support to resolve this.

The API returns `delivery.whatsapp_sent: false` when the CRM has no mapped
template, the Talent has no phone number, or delivery fails. The account remains
inactive and the admin UI shows a delivery warning. The notification-panel
message is delivered separately when selected.
