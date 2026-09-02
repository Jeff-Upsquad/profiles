# Push — Commit, Merge, Push (No Deploy)

## Objective

Publish the current task to `origin/main` without deploying production.

## Steps

1. Run [CM](cm.md) completely.
2. Inspect the complete `origin/main..main` commit range and diff.
3. Push with `git push origin main`. Never force-push.
4. Report the pushed commit and explicitly state that production was not
   deployed.

## Edge cases

- If remote `main` advanced, fetch and reconcile safely; preserve both sets of
  changes.
- If new migrations are pushed, state that they are not applied by this
  workflow.
- If there is nothing to commit but local `main` is ahead, push the existing
  commits after confirming the user intended them to be included.
