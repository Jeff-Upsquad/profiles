# Applicant cancellations — Squad Hiring Bot

## Separate applicant cards

A person can have a Partner Program card, a Jobs card, or both. The cards share a WhatsApp conversation but have separate application states.

- Partner Program cancellations belong in **Cancelled Applicants Partner Program**.
- Jobs cancellations belong in **Cancelled Applicants Jobs**.
- Each pipeline has **Cancelled No Response** first and **Cancelled Not Interested** second.

## No response

For applicants still in onboarding with outstanding requested profile changes: first reminder after 20 hours, second reminder 24 hours later, final warning 24 hours later, and cancellation another 24 hours later. Move each applicable existing program card to its own Cancelled No Response stage. Resubmitting all requested changes stops the sequence. An applicant who completed onboarding in either track is excluded from this automatic timeout. Never overwrite Not Interested with No Response.

## Not interested

When an applicant says they do not want to continue an application, first ask:

“Which application are you no longer interested in? Please choose Partner Program, Jobs, or Both.”

Show three WhatsApp reply buttons: **Partner Program**, **Jobs**, **Both**.

- Partner Program: cancel only that application and move only its card to Cancelled Applicants Partner Program → Cancelled Not Interested.
- Jobs: cancel only that application and move only its card to Cancelled Applicants Jobs → Cancelled Not Interested.
- Both: cancel both existing applications and move both cards to Cancelled Not Interested in their respective pipelines.

Ask before moving any card, even when the first statement mentions a program. Do not interpret “yes”, “no”, silence, or an unrelated decline as Both. The exact choice must answer a recent cancellation question. If they change their mind, clear the question and keep their applications. Do not create cards for programs they never applied to. Declining one vacancy or quitting active client work is not an application cancellation; hand active-work requests to the team.

Confirm cancellation only after the update succeeds. If an update fails, send it to the team for checking. Automatic moves are disabled when the bot is off, in draft, practice, or approval mode. Administrators can restore cancelled applications; a bot must hand restoration requests to the team.

The three-button question is a reusable interactive WhatsApp message sent in response to the applicant. It needs no approved Meta template within the open 24-hour reply window. Outside that window, do not send free-form messages.
