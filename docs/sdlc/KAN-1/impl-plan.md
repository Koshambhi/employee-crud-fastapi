# KAN-1 Implementation plan

Branch: `KAN-1` (already exists). Commit prefix: `KAN-1: `. Local commits only; no push until G5.
Files changed: `frontend/index.html`, `frontend/script.js`, `frontend/style.css` (additive), new `frontend/accessibility.test.js`. `app.py` is not touched.

## Steps (in order)

1. **Markup: form, labels, hints** (`frontend/index.html`)
   - Replace the `form-grid` wrapper `<div>` with `<form id="employee-form" novalidate aria-labelledby="form-title" aria-describedby="required-hint">`.
   - Add `<p id="required-hint">` above the form fields: "Fields marked * are required."
   - For each of the 7 fields: `<label for="<id>">`, `*` marker (`aria-hidden`), `required aria-required="true"`, `aria-describedby="<id>-error"`, appropriate `autocomplete`/`min`/`max`/`maxlength`/`step`, and an empty `<span id="<id>-error" class="field-error"></span>`.
   - Submit becomes `<button type="submit" id="submit-btn">`; remove `onclick`. Add `<button type="button" id="cancel-btn" hidden>Cancel</button>`.
   - Add `<div id="feedback" role="status" aria-live="polite" aria-atomic="true"></div>` and `<div id="feedback-error" role="alert" aria-live="assertive" aria-atomic="true"></div>`.
   - Table: `<caption class="sr-only">Employee list</caption>`, `scope="col"` on all `<th>`.
2. **Styles** (`frontend/style.css`, additive only): `:focus-visible` outline for inputs and buttons, `input[aria-invalid="true"]` red border, `.field-error`, `.feedback` success/error colours with contrast of at least 4.5:1, `.sr-only`, `.required-mark`.
3. **Validation** (`frontend/script.js`): `RULES` map, `validateField(id)`, `validateForm()`, inline error rendering with `aria-invalid`, revalidate on blur, clear on valid input, focus the first invalid field, and block `fetch` when invalid. Trim values and parse numbers only after they pass.
4. **Feedback and robust requests** (`frontend/script.js`): `showFeedback(type, msg)`, `escapeHtml()`, `fetch` wrapper that handles `!res.ok` (404/422/other) and network errors. Reset the form only on success. `submitForm` becomes the `submit` event handler. Add the delete `confirm()`, focus handling after delete and edit, edit-mode title/button text with Cancel.
5. **Table rendering** (`frontend/script.js`): build rows with escaped values, `type="button"` and `aria-label="Edit <name>"` / `"Delete <name>"`, numeric ids via `Number()`. Keep `editEmployee`/`deleteEmployee` global names, because rows use inline handlers (or switch to delegated listeners; either is fine if the tests pass).
6. **Test file** (`frontend/accessibility.test.js`): dependency-free Node script in the style described in CLAUDE.md (regex on `index.html`, throws on first failed assertion). It also loads the pure validation logic from `script.js` where possible (see note), otherwise asserts via regex.
   - Note: keep `RULES`/`validateForm` free of DOM access, taking a plain values object, so they can be unit-tested in Node. If `script.js` can't be `require`d (browser globals), guard with `if (typeof module !== "undefined") module.exports = { validateValues, escapeHtml }`.
7. **Docs** (`README.md`): a short "Accessibility and validation" section listing the rules and how to run the test. Inline comments only where non-obvious.
8. **Local commits**: one commit per logical step group, e.g. `KAN-1: Add accessible form markup and styles`, `KAN-1: Add client-side validation and feedback`, `KAN-1: Add accessibility test`.

## Tests: AC to test
| AC | Automated (`node frontend/accessibility.test.js`) | Manual |
|---|---|---|
| AC1 | Every `input` (except hidden) has a `<label for>` matching its id; has `required` and `aria-required="true"`; has `aria-describedby` pointing at an existing element; `#required-hint` exists; the form references it. | Screen reader reads label, "required" and hint for each field. |
| AC2 | `validateValues` unit cases: empty object invalid; blank/whitespace name invalid; age 17/101/non-integer invalid; salary 0/negative invalid; bad email invalid; experience negative invalid; one fully valid object returns no errors. Static check that `submit` handler calls `preventDefault` and returns before `fetch` when invalid. | In the browser, submit empty and partially filled forms: no network request in DevTools, inline errors, focus on the first invalid field. |
| AC3 | Static: `#feedback` has `role="status"` and `aria-live`, `#feedback-error` has `role="alert"`; `script.js` references `showFeedback` in the add, update and delete paths and checks `res.ok`. `escapeHtml` unit cases. | Add, update, delete with the server up (success messages), server stopped (network error message), delete of an already-deleted id (404 message). Confirm that a failed save keeps the form data. |
| AC4 | Static: the form is a real `<form>` with `type="submit"`; no `tabindex` greater than 0; Edit/Delete buttons rendered with `aria-label` and `type="button"`; `<th scope="col">`; caption present. | Tab through form, submit, table buttons in logical order; Enter submits; visible focus ring everywhere; Space/Enter activate row buttons. |

## Validation commands
- `node frontend/accessibility.test.js` (must pass).
- `uvicorn app:app --reload` from the repo root, then manual checks at http://localhost:8000 using the manual column above. Browser accessibility checker (Lighthouse or axe) should report no new issues; record results honestly in the verification report, including that screen-reader testing is manual or not done.
- `git diff --stat main...KAN-1` should show only the 4 frontend files, the README and `docs/sdlc/KAN-1/`.

## Rollback
Frontend-only and stateless: `git revert` the KAN-1 commits (or the merge commit once merged). `app.py` and data are unaffected.

## Out of scope
Backend validation and range checks, persistence, modularising JS, restyling beyond focus/error states.

## Design-review resolutions (see `design-review.md`; these override earlier text)
- **M1 Node testability:** the bootstrap `loadEmployees()` call and all `document`/`fetch` use are guarded with `if (typeof document !== "undefined")`. Pure functions (`validateValues`, `escapeHtml`) are exported through `module.exports` under `typeof module !== "undefined"`.
- **M2 Native vs JS rules:** the JS `RULES` map is the single source of truth. Salary input gets `step="any"`. Email is checked by the JS pattern in addition to `type=email`. A number field with `validity.badInput` reports "Enter a valid number", not "required".
- **M3 describedby and hint:** every field uses `aria-describedby="<id>-error"` only. The form carries `aria-describedby="required-hint"`. The hint text is exactly "Fields marked * are required." and the AC1 test asserts those.
- **M4 Reset and edit state:** `resetForm()` and `editEmployee()` also clear all field errors, `aria-invalid` and both feedback regions, and set or restore the form title, the submit text and the Cancel button's visibility.
- **Minor, adopted:** build rows with DOM APIs and `textContent` (fall back to an `escapeHtml` that also escapes quotes); a failed list refresh must not overwrite a success message (show the refresh error only if no message is pending); the form heading gets `tabindex="-1"` for post-delete focus; use `aria-live` on the regions and drop the redundant `role="alert"` duplication on the error region (keep `role="status"` / `role="alert"` once each); salary max 10,000,000; explicit `autocomplete` values (`name`, `email`, `organization-title` for position, `off` for the rest); contrast checks cover error text and the focus outline; the `delete` confirm is manual-test only.
- **Minor, noted:** test file name collides with `EPAM-69950`; if both merge, reconcile. The manual test matrix is the "Manual" column above, recorded in `verification-report.md`.

## Decisions awaiting confirmation at G2
1. Validation ranges (age 18 to 100, experience 0 to 80, salary above 0, text max 100).
2. Delete confirmation via `confirm()`.
3. Persistent (non-auto-dismiss) feedback.
4. Touching `style.css` although the story lists only `index.html` and `script.js`.
5. Adding `frontend/accessibility.test.js` (the story asks for none, but the repo convention and AC testing both call for it).
6. Editing `README.md` (a short accessibility and validation section).
