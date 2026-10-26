---
name: sdlc-design
description: Produce architecture.md and impl-plan.md for an approved requirements.md in the Employee CRUD repo. Use as step 2 of the SDLC pipeline.
---

Precondition: `docs/sdlc/<KEY>/requirements.md` exists and was approved at G1.

1. Read `app.py`, `frontend/index.html`, `frontend/script.js`, `frontend/accessibility.test.js` (if present) and `CLAUDE.md` so the design fits the real code.
2. Write `docs/sdlc/<KEY>/architecture.md`: affected components, API/model changes, data flow, security and accessibility considerations, alternatives considered (briefly), risks.
3. Write `docs/sdlc/<KEY>/impl-plan.md`: ordered steps with exact files to change, a test for every acceptance criterion (AC id -> test), validation commands, and rollback notes.
4. Do not edit source code. Tell the orchestrator both files are ready for the design reviewer.
