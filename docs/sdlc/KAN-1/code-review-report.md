# KAN-1 Code review report

Scope: `git diff main...KAN-1` (frontend: `index.html`, `script.js`, `style.css`, `accessibility.test.js`; README). Reviewed against `requirements.md`, `impl-plan.md`, `design-review.md`. `app.py` is untouched (confirmed).

## Summary
The implementation is solid and follows the plan and the design-review resolutions (M1-M4). DOM safety is good: rows are built with `createElement`/`textContent`, and the old `innerHTML +=` XSS is gone. Validation is a single pure `RULES` map. Requests handle network errors and non-2xx responses. Edit, cancel and reset clear errors, `aria-invalid`, feedback and edit-mode text.

There are no High findings. The main risks are in the live-region implementation (feedback may not be announced), focus loss after failed actions, no double-submit guard, and a test suite that is largely static regex and that exercises an unused function (`escapeHtml`).

Test run (real output): `node frontend/accessibility.test.js` printed 29 `ok - ...` lines and `All 29 checks passed.`, exit code 0.

Counts: High 0, Medium 4, Low 8.

## AC coverage
| AC | Implemented | Tested | Notes |
|---|---|---|---|
| AC1 labels, ARIA, hints | Yes: `index.html:24-72` (label for, required, aria-required, describedby, hint above the form) | Static regex, solid | "Hint above form" order is not asserted. No browser or screen-reader check. |
| AC2 no invalid submit | Yes: `script.js:215-217` validates before `request`; RULES at `script.js:27-47` | Good unit tests on `validateValues`; a string-order check for the submit wiring | Wiring is never executed (no DOM test). See M3. |
| AC3 feedback | Yes: `script.js:132-137` and the add/update/delete paths | Weak: counts `showFeedback(` occurrences and greps strings | See M1, M4, L1. |
| AC4 keyboard and ARIA | Yes: real form, submit button, per-row aria-labels, th scope, caption, focus styles | Static only | Keyboard order and focus behaviour are untested. |

## Findings

### Medium

**M1. Live region may never announce: container toggles `display:none`** (`frontend/style.css:148-150`, `index.html:76-77`, `script.js:125-137`)
`.feedback:empty { display: none; }` removes the region from the accessibility tree while empty. `showFeedback` clears and then fills it in the same tick, so the region appears and its content is set at the same moment. Several screen readers (notably NVDA/JAWS with some browsers) do not announce content in a live region that was not rendered before the change. This undermines AC3 ("clear feedback") and AC4 ("ARIA ... functional"). Also, `clearFeedback()` followed immediately by the new text can cause the update to be coalesced or dropped.
Fix: keep the regions rendered, hide them visually only when empty, and drop the synchronous clear.
```css
.feedback:empty { display: block; margin: 0; padding: 0; border: 0; height: 0; overflow: hidden; }
```
```js
function showFeedback(type, message) {
    const ok = byId("feedback"), err = byId("feedback-error");
    (type === "error" ? ok : err).textContent = "";
    (type === "error" ? ok : err).className = "feedback";
    const el = type === "error" ? err : ok;
    el.className = `feedback ${type}`;
    el.textContent = message;
}
```
Verify with NVDA or VoiceOver (not done here).

**M2. Focus is lost after failed edit/delete, and the heading focus after delete can pre-empt the announcement** (`script.js:249-254`, `265-277`)
On a failed delete or edit, `loadEmployees()` rebuilds the table, which destroys the button that had focus, so focus falls to `<body>` and keyboard users restart from the top. After a successful delete, `byId("form-title").focus()` moves focus to a heading, which makes the screen reader read the heading and can interrupt the polite "deleted" message. `design-review.md` m3 suggested simply focusing the Name field, or the heading only if needed.
Fix: after any refresh that replaces rows, restore focus deliberately, for example to the next row's Delete or Edit button, or to the table caption/heading, and keep the message ahead of it.
```js
const rows = [...document.querySelectorAll("tbody tr")];
(rows[Math.min(idx, rows.length - 1)]?.querySelector(".delete-btn") || byId("name")).focus();
```
Compute `idx` before deleting.

**M3. No double-submit protection: duplicate POSTs create duplicate employees** (`script.js:215-247`, `index.html:71`)
There is no in-flight guard. Enter held down or a double-click sends two POSTs before `resetForm()` runs, giving two records. Violates the AC2 intent of data integrity. The same applies to Delete (second click returns a 404 error toast after a success toast).
Fix:
```js
let busy = false;
async function submitForm(event) {
    if (event) event.preventDefault();
    if (busy || !validateForm()) return;
    busy = true; byId("submit-btn").setAttribute("aria-disabled", "true");
    try { /* request ... */ } finally { busy = false; byId("submit-btn").removeAttribute("aria-disabled"); }
}
```
Use `aria-disabled` rather than `disabled`, so keyboard focus is not lost.

**M4. Test suite gives false assurance for AC3/AC4** (`frontend/accessibility.test.js:86-95, 106-109`)
- `escapeHtml` is tested (line 91-94) but is never called in `script.js` (rows use `textContent`). It is dead code, and the test says nothing about real DOM safety. Delete the function and test, or use it.
- `showFeedback(` is counted `>= 6` (line 87). The count includes the function definition, and it does not prove that add, update and delete each call it (a failing path could be removed and the count would still pass).
- "rows built with textContent" (line 95) only forbids `innerHTML +=`. `tbody.innerHTML = emp.name` would pass.
- `#feedback-error` is checked only for `aria-live`; the plan specified `role="alert"` (see L1).
- `editEmployee`/`resetForm`/cancel state clearing (design-review M4) has no test at all, and `validateForm`/`submitForm` are never executed.
Fix: extract the pure pieces and add behavioural tests with a minimal fake DOM (or a `jsdom` dev-only check if dependencies are acceptable), and tighten the greps:
```js
["Employee added successfully", "Employee updated successfully", "Employee deleted successfully", "Delete failed", "Update failed"]
  .forEach(m => assert.ok(js.includes(m), m));
assert.ok(!/innerHTML\s*=\s*(?!"")/.test(js), "innerHTML assigned non-empty value");
```

### Low

**L1. `#feedback-error` lacks `role="alert"`, contrary to the plan** (`index.html:77`). The plan said to keep `role="status"` and `role="alert"` once each. Only `aria-live="assertive"` is present, and the test was relaxed to match. `role="alert"` has the better support. Fix: `<div id="feedback-error" class="feedback" role="alert" aria-atomic="true"></div>` and update test line 82-85 to assert the role.

**L2. Refresh failure after success is silently swallowed, leaving a stale table** (`script.js:182`, `244-246`, `273-275`). `loadEmployees` suppresses its error if any feedback is pending, so after "deleted successfully" a failed refresh shows the deleted row with no warning. Fix: append to the message, e.g. `showFeedback("success", msg + " The list could not be refreshed.")`, by having `loadEmployees` return false and the caller adjust the text.

**L3. Unhandled TypeError if a 2xx response has a non-JSON body** (`script.js:156-160`, `256-260`). `request` returns `{data: null}`, and `editEmployee` then reads `emp.id` and throws. Fix: `if (result.error || !result.data) { ... }`.

**L4. Concurrent `loadEmployees()` calls can render out of order** (`script.js:246`, `270`, `300`). Fire-and-forget refreshes can finish in the wrong order and overwrite newer data. Fix: keep a request counter and ignore stale responses.

**L5. 422 message is generic** (`script.js:153`). The server's `detail` is not surfaced. Acceptable, but consider mapping `detail[].loc` to the field for a better message.

**L6. Edit of legacy data outside the client ranges blocks updates** (`script.js:260`, RULES). Records created earlier with age under 18 or over 100 fail validation on edit, and the user sees an error on a field they did not touch. This was acknowledged in the design risks. It is noted in the README ("server does not enforce them"), but there is no feedback explaining it. Low, since the ranges are still unconfirmed G2 defaults.

**L7. Leftover globals and unused export** (`script.js:77-79, 294-298`). `window.submitForm`/`resetForm` are no longer referenced from the markup; `RULES` and `escapeHtml` are exported but only `validateValues` matters. Remove when convenient.

**L8. Scope and hygiene** (diff stat). The branch diff also includes `.claude/`, `CLAUDE.md`, `CHANGELOG.md` and `.gitignore` (pipeline commits from main's history that main does not yet contain, per the diff), which breaks the impl-plan check "diff shows only the 4 frontend files, README and docs". `CLAUDE.md` still says the accessibility test exists only on `EPAM-69950`, which is now stale, and `CHANGELOG.md` has no KAN-1 entry. Also, the untracked `.mcp.json` is not in `.gitignore`, so it could be committed by accident (it may hold credentials). Fix: add `.mcp.json` to `.gitignore` and add a KAN-1 line to the changelog.

## Checked and found fine
- DOM safety: all user data goes through `textContent`/`setAttribute`; ids pass through `Number()`; the only `innerHTML` use is `tbody.innerHTML = ""`.
- Fetch error handling: network failure, 404, 422, other non-2xx; the form data is kept on failure (`script.js:240-243`).
- Validation vs RULES: client rules match README. Whitespace is trimmed, `badInput` gives "Enter a valid number", and the same values are used for sending (`parseInt`/`parseFloat` only after validation). `novalidate` plus the JS rules avoids conflicts with native validation. Salary `step="any"` is present.
- Edit/cancel/reset state: `setEditMode`, `clearFieldErrors`, `clearFeedback` are called in `resetForm` and `editEmployee`; Cancel restores the title, button text and hidden state and focuses Name.
- Labels: every visible input has `label for`, `aria-describedby` points at an existing error span, the form is labelled and described, and the `*` mark is `aria-hidden`. The CSS adds `:focus-visible` outlines and does not remove outlines.
- Backend: no changes, so no CRUD regression is possible from this diff.

## Not verified
- No browser run: no manual keyboard tab order, Enter/Space activation, focus ring, or confirm() dialog check.
- No screen-reader testing (NVDA/JAWS/VoiceOver), so M1 is a known-pattern risk and not an observed failure.
- No Lighthouse/axe run, and no colour-contrast measurement (values were only read from CSS: success text `#0d5c2a` on `#e6f4ea`, error `#8a0014` on `#fdecea`, field error `#b00020`).
- The server was not started; the API error paths (404, 422, down server) were read, not exercised.
- The Confluence design page was not re-read. The validation ranges and the confirm/persistent feedback defaults are still unconfirmed G2 decisions.
- No Python tests exist, and none were run.
