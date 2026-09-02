# CMPD — Commit, Merge, Push, Deploy

## Objective

Ship the current worktree's scoped changes through the complete production
pipeline. The user's CMPD request authorizes all four stages; do not pause for a
separate confirmation unless a conflict, migration risk, or scope problem is
discovered.

## Steps

1. Run the complete [CM workflow](cm.md): inspect, validate, stage only
   task-owned files, commit, update local `main`, and fast-forward merge.
2. Before pushing, inspect `origin/main..main` so every commit about to ship is
   understood. Re-check that range for Supabase migrations.
3. Apply required production migrations before dependent application code. If
   there is no authenticated path, stop and provide the exact manual action;
   never claim the deploy applied them.
4. Run the complete [PD workflow](pd.md): push `main`, deploy with
   `scripts/deploy.sh`, and verify the production checkout, processes, Nginx,
   and public health endpoints.
5. Give the user the [test handoff](test-handoff.md).
6. Report the deployed commit, current branch/status, and any non-blocking demo
   deployment warning.

## Important rules

- Do not clean up the branch or worktree. CU is a separate, explicit workflow.
- Do not stage unrelated files or force-push.
- Do not deploy from a feature worktree; merge and deploy from the primary
  checkout at `/Users/jeffzeena/Profiles`.
- A successful production stage is not made unsuccessful by the optional demo
  cascade, but the demo failure must be disclosed.

## Stop conditions

- Required validation fails.
- A merge/rebase conflict needs product judgment.
- A migration cannot be safely applied.
- The deploy reaches production but health verification fails—begin rollback or
  report the precise blocker instead of declaring success.
