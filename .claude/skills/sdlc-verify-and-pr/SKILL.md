---
name: sdlc-verify-and-pr
description: Run verification checks, write verification-report.md and the changelog entry, then (only after explicit user approval) push the story branch and open a draft GitHub PR. Use as the final step of the SDLC pipeline.
---

Preconditions: implementation committed locally on the story branch; `code-review-report.md` exists.

1. Run the real checks: `node frontend/accessibility.test.js` (only if the file exists on this branch), pytest if backend tests exist, and `git status` / `git diff main...HEAD --stat`. Record the actual output; never claim a result you did not see.
2. Write `docs/sdlc/<KEY>/verification-report.md`: AC -> evidence table, commands run with pass/fail, unresolved review findings, known gaps.
3. Add an entry to `CHANGELOG.md` (create it if missing) under the story key.
4. Commit these files locally with prefix `<KEY>: `. Present results and ask for approval (G4).
5. After G4, ask separately for approval to push and open a **draft** PR (G5). Only then, each as a **separate tool call** (the hook checks before a command runs, so a marker created in the same command does not count): create `.claude/state/push.approved`; `git push -u origin <branch>`; create `.claude/state/pr.approved`; `gh pr create --draft --base main` with a body containing a summary, AC mapping, test evidence and no confidential Jira text beyond the story key; finally delete both marker files.
6. Report the PR URL. Do not merge.
