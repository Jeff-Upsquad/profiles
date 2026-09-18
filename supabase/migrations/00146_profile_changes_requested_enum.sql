-- "Request changes" review outcome for job profiles.
--
-- Sits between Approve and Reject: the reviewer ticks what the talent has to
-- fix, the profile leaves the review queue into `changes_requested`, and the
-- talent resubmits once done (→ back to pending_review). Distinct from
-- `rejected`, which is terminal from the reviewer's side.

-- Kept in its own migration: Postgres refuses to *use* a freshly added enum
-- value inside the transaction that added it, and 00147 references it in an
-- index predicate.
ALTER TYPE profile_status_enum ADD VALUE IF NOT EXISTS 'changes_requested';
