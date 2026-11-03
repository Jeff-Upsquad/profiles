# Talent signup WhatsApp OTP

Talent signup requires a six-digit WhatsApp code on the main/creator signup page
and the creative, sales and accountant applications. Codes expire after 10
minutes and allow five guesses. Resends replace old codes, at most once per
minute and five times per hour per phone number, with additional IP limits.
The test phone bypasses duplicate detection only; it still needs a real OTP.

## CRM setup required before releasing Profiles

The companion `worktree-talent-signup-otp` branch in **SquadHire CRM** registers
`talent_signup_verification_code` in System Automations. Release that catalog
entry before releasing Profiles. The migration enables this event using the
single existing, enabled talent-password-reset mapping's approved authentication
template, with `body_param_keys` set to `["code"]`. It fails safely if that
approved source mapping is missing or ambiguous. Production currently uses
`password_reset_otp` (`en_US`), which can also deliver six-digit signup codes.
The CRM receiver already fills both the authentication body and copy-code button.
The release workflow verifies this mapping before deploying required-OTP signup.

Profiles uses the existing `SQUADHIRE_CRM_SYSTEM_EVENTS_URL` and inbound secret.
Its webhook has `system_event: "talent_signup_verification_code"`, the normalized
recipient phone, and `data.code` containing the six-digit OTP. `body_params`
also contains the code. A skipped mapping or failed delivery returns an error;
the challenge cannot be used to sign up. Never deploy required-OTP signup until
the approved template mapping is ready.

## Release

1. Release the CRM event catalog entry above.
2. Follow `workflows/supabase-production.md`: verify the production target,
   dry-run and apply only migration **20261103143324** before dependent code.
   Verify its new CRM mapping is enabled, approved and uses the `code` parameter.
3. Release Profiles backend and frontend together using the normal workflow.
4. Request a code from signup using a tester-controlled WhatsApp number, enter
   it, and verify account creation and automatic sign-in. Repeat from an
   application form. Test incorrect/expired codes, changed phone/email, resends,
   and delivery failure. No signup can bypass the backend OTP check.

Verification is consumed atomically before account creation. If account creation
then fails, request a fresh code. Server-owned auth `app_metadata` records the
verified phone and timestamp. Challenge storage is backend-only with RLS and
explicit service-role grants; only keyed code hashes are stored.

## Local verification (no live sends)

```sh
backend/node_modules/.bin/tsx --test backend/src/services/talent-signup-otp.test.ts backend/src/services/auth-test-phone.test.ts backend/src/lib/signup-categories.test.ts backend/src/lib/social-media-creators.test.ts
# In an isolated PostgreSQL DB with anon, authenticated and service_role roles:
psql -v ON_ERROR_STOP=1 -f supabase/migrations/20261103143324_talent_signup_whatsapp_otp.sql -f supabase/tests/talent_signup_whatsapp_otp.sql
```
