# Repository working rules

## Mandatory start-of-work check

- Before implementing any change, read this file first, then inspect the current branch, working tree, PR reviews, and latest CI run. Do not start editing until this check is complete.
- Use the latest failed CI logs as required context. After changes, rerun the relevant local checks and inspect every check on the newly pushed commit; keep fixing and pushing until all required checks pass.
- Do not claim CI is resolved while any required check is failed, pending, skipped unexpectedly, or belongs to an older commit.

## CI regression prevention

- Before committing or pushing code changes, run the complete `pnpm test` suite and `pnpm typecheck`; targeted tests alone do not establish that CI will pass.
- For browser, persistence, save, or document identity changes, also run the matching browser journey and inspect every related CI job, not just the first failed matrix entry.
- If CI fails, read the failed job logs for every platform and workflow. Fix the shared root cause, then rerun the complete affected checks locally before pushing.
- After rebasing onto `develop`, repeat the checks that cover the changed code because the merged tree is a new CI input.
- Do not treat a successful local targeted test, a green prior commit, or a queued check as evidence that the current commit is CI-clean.
- This restricted Windows environment may reject symlink creation with `EPERM`; record the exact affected tests and verify them in the matching Windows CI job instead of treating that sandbox limitation as a product regression.
- The local production build may fail with `spawn EPERM` when Vite resolves native Tailwind bindings in this environment; use the CI build result to verify it and report the local limitation accurately.

## Relevant regression note

Download fallback status is tied to the serialized spec snapshot. Name/project identity updates may create new spec objects; preserve the downloaded label only when the current content still matches the downloaded snapshot, ignoring `projectId`. Any edit made while workspace detection is pending must make the current document appear unsaved.
