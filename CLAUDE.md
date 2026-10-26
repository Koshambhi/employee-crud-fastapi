# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- Install: `pip install fastapi uvicorn pydantic` (no requirements.txt; a local `.venv/` exists and is untracked)
- Run: `uvicorn app:app --reload` from the repo root, then open http://localhost:8000. The root directory matters because `app.py` uses relative paths (`frontend/`).
- Accessibility test (exists only on branch `EPAM-69950` until that is merged to `main`; skip if absent): `node frontend/accessibility.test.js`. It is dependency-free (no package.json, no test runner). It parses `frontend/index.html` with regexes and throws on the first failed assertion.
- There is no Python test suite and no linter configured.

## Architecture

Two pieces, no build step:

- **Backend** ([app.py](app.py)): a single-file FastAPI app. Employees live in the module-level `employees` list (dicts) with a global `next_id` counter, so data resets on every restart. CRUD handlers do linear scans by `id` and raise 404 on a miss. `GET /` returns `frontend/index.html`, and `frontend/` is also mounted at `/static`. CORS is open to all origins.
- **Frontend** ([frontend/](frontend/)): vanilla HTML/CSS/JS. [script.js](frontend/script.js) hardcodes `API_URL = "http://localhost:8000"`, so the API host and port must change there if the server moves.

The `Employee` Pydantic model in `app.py` (name, age, position, department, email, salary, experience, optional id) is the contract. Adding a field means updating the model, the form and table in `index.html`, and `script.js`.

## Agentic SDLC pipeline

Start with `claude --agent sdlc-orchestrator` and give it a Jira story link. The orchestrator (main agent) runs skills `sdlc-intake`, `sdlc-design`, `sdlc-verify-and-pr` and subagents `employee-crud-design-reviewer`, `employee-crud-developer`, `employee-crud-code-reviewer` (all in `.claude/`). Per-story artifacts go in `docs/sdlc/<STORY-KEY>/`.

- Gates G1-G5 need explicit user approval: requirements, design, start of implementation, review/verification, push + **draft** PR. Merging is always human.
- Jira is read-only. If the Jira MCP call fails, the pipeline asks the user to paste the story and AC.
- `.claude/hooks/require-approval.py` blocks `git merge`, commits on `main`, and `git push` / `gh pr create` unless `.claude/state/push.approved` / `pr.approved` exist (gitignored; created only after G5 approval).

## Conventions

- Branches and commits are prefixed with the Jira key, e.g. `EPMCDMETST-69950: ...`.
- Where present, the accessibility test asserts specific labels, ARIA attributes and required-field hints in `index.html`. Re-run it after editing the form markup.
- The README mentions an `employees.json` "future DB" that does not exist; persistence is not implemented.
