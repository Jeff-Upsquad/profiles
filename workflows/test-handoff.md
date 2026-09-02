# Test Handoff — What to Test

## Objective

Whenever Profiles becomes testable—after CMPD, PD, deploy, a localhost preview,
or a mobile build—tell the user where to go, what changed, and exactly how to
confirm it.

## Required output

Lead with the available surface and use plain language:

```text
Deployed — here's what to test:

Where: <production or localhost URL / mobile app>

What changed:
- <user-visible behavior>

How to test:
1. <action>
2. <expected result>

Heads up:
- <only relevant caveats or manual steps>
```

## Rules

- Cover the entire deployed range, not only the current agent's commit.
- Translate implementation details into behavior the user can see.
- Separate instructions by surface when frontend, admin, staff, admin-lite, or
  mobile behavior differs.
- State plainly when runtime verification was not possible.
- Put migrations, environment changes, cache refreshes, or required re-login
  under a visible manual-actions/heads-up section.
- For a non-user-facing release, say that there is no UI change and name the
  operational verification performed.
