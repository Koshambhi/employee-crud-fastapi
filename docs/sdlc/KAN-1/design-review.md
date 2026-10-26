# KAN-1 Design review

Reviewed: `architecture.md`, `impl-plan.md` against `requirements.md` (G1-approved), `app.py`, `frontend/index.html`, `frontend/script.js`, `frontend/style.css`.

## Verdict: APPROVE WITH CHANGES

No blockers. The design is sound, fits the single-file/vanilla-JS code, keeps the API and `Employee` model unchanged, and maps every AC to a plan step and a test. The Major findings below should be fixed in the plan before G3 because each would cause a defect or a failing test during implementation.

## Coverage of acceptance criteria
| AC | Plan step | Test | Status |
|---|---|---|---|
| AC1 labels, ARIA, hints | 1, 2 | Node static checks plus manual screen reader | Covered (see M3 on hint wiring) |
| AC2 no invalid submit | 3 | `validateValues` unit cases plus static check | Covered (see M1, M2) |
| AC3 feedback | 4, 5 | Static plus manual | Covered (see m3) |
| AC4 keyboard and ARIA | 1, 5 | Static plus manual | Covered |

## Blockers
None.

## Major

**M1. The Node test cannot `require` `script.js` as planned** (impl-plan step 6, `frontend/script.js`).
`script.js` calls `loadEmployees()` at top level (line 91) and uses `document` and `fetch`. Requiring it in Node throws a `ReferenceError`. The plan only mentions guarding `module.exports`.
Fix: also guard the bootstrap, for example `if (typeof document !== "undefined") { wire listeners; loadEmployees(); }`. Alternatively, put the pure `RULES`, `validateValues` and `escapeHtml` in a small `if (typeof module !== "undefined")` block placed before any DOM access. Say so explicitly in step 6.

**M2. Native constraint attributes will conflict with the Salary rule** (architecture "Validation", plan step 1).
`<input type="number">` without `step` defaults to `step=1`, so `checkValidity()` reports `stepMismatch` for 1234.50. The architecture says `checkValidity()` and `validity` supply the checks. The existing `script.js` uses `parseFloat` for salary. Likewise `type="email"` natively accepts `a@b` (no TLD), while the rule requires `x@y.z`. A non-numeric entry in a number field yields `value === ""` with `badInput`, which would be reported as "required".
Fix: set `step="any"` (or `0.01`) on salary. State that the JS `RULES` map is the single source of truth, with native attributes serving only as hints, so the two cannot disagree. Handle `validity.badInput` with a "Enter a number" message.

**M3. Architecture and plan disagree on field wiring** (architecture "Markup" vs plan step 1).
The architecture uses `aria-describedby="x-hint x-error"` and a form `aria-describedby="required-hint"` with the text "Fields marked * are required. All fields are required." The plan uses only `<id>-error` and the text "Fields marked * are required." The Node AC1 test asserts `aria-describedby` targets exist, so the implementer needs one answer.
Fix: pick one. Recommended: per-field `aria-describedby="<id>-error"` only (there are no per-field hints to reference), the single hint text "All fields are required. Required fields are marked *.", and drop the `x-hint` ids from the architecture.

**M4. Form state is not cleared on edit, cancel or reset** (plan step 4, `resetForm`).
The current `resetForm` only clears values. With `aria-invalid`, `.field-error` text, and a new Cancel button, `resetForm` and `editEmployee` must also clear the errors and `aria-invalid`, the feedback regions as appropriate, and restore the heading and button text and the Cancel `hidden` state. The plan does not list this, so stale errors would show after Cancel or after loading a record.
Fix: add to step 4 that `resetForm` and `editEmployee` call `clearErrors()`, and that edit-mode text is restored in `resetForm`.

## Minor

**m1. Escaping in attributes** (architecture "Security", plan step 5). `escapeHtml` must escape `& < > " '` because names go into `aria-label="..."`. Preferably build rows with `document.createElement` and `textContent` and `setAttribute`, and attach delegated click listeners. That removes both the `innerHTML` and the inline-handler dependency. The "either is fine" wording is acceptable, but add the quote-escaping requirement and a test case such as `"><img onerror=...>`.

**m2. `loadEmployees()` handling can overwrite feedback.** After a successful add or delete, the refresh runs. If the refresh fails, its error message replaces the success message, which is ambiguous. Specify the order. Also `loadEmployees` at page load needs a network-error path, because the server may be down (the first AC3 manual case).

**m3. Focus after delete targets a non-focusable heading** (architecture "Feedback"). `<h2 id="form-title">` needs `tabindex="-1"` to receive focus. This is allowed by the "no tabindex > 0" test, but note it. Simpler: focus the Name field.

**m4. Duplicate live-region semantics.** `role="alert"` already implies `aria-live="assertive"` and `aria-atomic="true"`. Declaring both is harmless but redundant. Keep it consistent between the architecture (which says assertive) and the plan.

**m5. Validation rule gaps.** There is no maximum for salary (a very large value goes through as a float) and no maximum length for the stored email beyond 254. Age 18 to 100 is stricter than the backend and may reject existing data (acknowledged in Risks). These stay as G2 decisions, but add a salary upper bound or state that none is intended.

**m6. Test file name collision.** `frontend/accessibility.test.js` already exists on branch `EPAM-69950`. Merging both branches would produce an add/add conflict. Either confirm that branch is abandoned or use a different name (for example `frontend/kan1.test.js`), and update the CLAUDE.md note accordingly.

**m7. `README.md` edit is outside the stated story scope** (plan step 7, "Files changed") and is not in the "Decisions awaiting G2" list. Add it to the list at G2, or drop it.

**m8. Delete confirmation is scope beyond the ACs.** It is flagged as a G2 decision already, which is fine. Note that `confirm()` is not testable in the Node tests, so it is manual only.

**m9. Autocomplete values.** Specify them (`name`, `email`; `organization-title` for position; `off` for the others). Wrong values can trigger unwanted autofill of the Age or Salary fields.

**m10. Contrast and focus.** The plan gives a 4.5:1 target for feedback colours. Also cover placeholder text, error text and the focus outline (3:1). Currently `style.css` has no focus style (verified).

## Backward compatibility and security
- API and `Employee` model are untouched. Client now rejects cases the server accepted (blank strings, out-of-range values), which is intended.
- CORS stays open (existing, out of scope). Hardcoded `API_URL` is unchanged; no new network surface.
- Existing stored-XSS via `innerHTML` is closed by the plan, which is a good change (see m1 for the details).

## Unverified assumptions
1. The validation ranges (age 18 to 100, experience 0 to 80, salary above 0, text max 100) are the author's defaults. Open question 1 is unanswered.
2. Persistent feedback and `confirm()` on delete (open questions 2 and 3) are defaults, not confirmed.
3. Branch `EPAM-69950` is not going to be merged with a conflicting test file (m6).
4. `.hidden` on the Cancel button works. I found no `display` rule on `button` in `style.css`, so it should.
5. The browser and screen reader matrix for the manual checks is not defined. Lighthouse or axe availability is assumed.
6. The Confluence design was not re-read in this review; I relied on `requirements.md`.
