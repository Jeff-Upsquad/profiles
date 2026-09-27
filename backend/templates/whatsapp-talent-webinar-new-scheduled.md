# WhatsApp template — `talent_webinar_new_scheduled`

New onboarding webinar scheduled → Notify-me subscribers for that language.
Sent via the SquadHire CRM system event `talent_webinar_new_scheduled`
(see `deliverCrmSystemEvent` in `backend/src/lib/crm-system-event.ts`).

## Meta submission spec

- Name: `talent_webinar_new_scheduled`
- Category: UTILITY
- Language: en
- Header: none
- Body:

```text
Hi {{1}}, good news — a new {{2}} onboarding webinar "{{3}}" is scheduled for {{4}}. Open your Training → Upcoming webinars and tap Register to save your seat. — Team UpSquad
```

- Buttons: none (the talent registers from Training → Upcoming webinars)
- Sample values for submission:
  - {{1}} = Anjali
  - {{2}} = Malayalam
  - {{3}} = Onboarding Q&A for Thailand talents
  - {{4}} = 30 September 2026, 7:00 pm IST

## CRM mapping (SquadHire CRM → Meta)

1. In Meta Business Manager → WhatsApp Templates, create the template above
   and wait for APPROVED status.
2. In the SquadHire CRM template map, add:
   `talent_webinar_new_scheduled` → the approved template name, with
   `body_params` order = `[talent_name, language, webinar_name, date_time_text]`.
3. The backend already sends `bodyParams` in that order plus a `data` payload
   (`talent_name`, `webinar_name`, `language`, `date_time`, `date_time_text`).
   Until the CRM maps the event it replies `{skipped:true}` and the backend
   logs `[crm-event] talent/talent_webinar_new_scheduled skipped` — in-app +
   push still deliver, only WhatsApp waits.

## Backend wiring (already shipped)

- Subscribe: `POST /talent/training/webinar-interests {language}`
- Unsubscribe: `DELETE /talent/training/webinar-interests/:language`
- Fan-out: `sendNewWebinarNotices()` in `backend/src/services/webinars.service.ts`,
  triggered on webinar create-with-published and on draft→published.
  Notification-panel type: `webinar_new_scheduled`, route `/talent/training`.
