---
name: sdlc-intake
description: Fetch a Jira story (read-only) via the Jira MCP tools, or from text the user pastes, and write docs/sdlc/<KEY>/requirements.md. Use as step 1 of the SDLC pipeline.
---

Input: a Jira story link (key is the last path segment, e.g. `EPMCDMETST-12345`).

1. Try the Jira MCP tools (e.g. an EPAM Jira or Atlassian connector) to **read** the story: summary, description, acceptance criteria, linked issues. Use read tools only.
2. If the call fails with a real error (not authorized, not found, tool unavailable), do not retry in a loop and do not guess. Tell the user exactly what failed and ask them to paste the description and acceptance criteria.
3. Write `docs/sdlc/<KEY>/requirements.md` with: story key and title, summary, numbered acceptance criteria (AC1, AC2, ...), constraints, explicit assumptions, and open questions. Keep wording close to the source; mark anything inferred as an assumption.
4. Show the file content to the user and stop for approval (gate G1). Nothing is committed here.
