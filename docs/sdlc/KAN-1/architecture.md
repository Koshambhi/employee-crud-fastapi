# KAN-1 Architecture: frontend accessibility, validation and feedback

Inputs: `requirements.md` (approved at G1), `app.py`, `frontend/index.html`, `frontend/script.js`, `frontend/style.css`.

## Current state (observed)
- `index.html`: 7 inputs (`name, age, position, department, email, salary, experience`) plus hidden `emp-id`. Each `<label>` has no `for`, so inputs have no accessible name. The "form" is a `<div>` with a `<button onclick="submitForm()">`, not a `<form>`. There is no required hint, no live region, and the table has no caption or `scope` on `<th>`.
- `script.js`: `submitForm()` sends whatever is typed (`parseInt("")` gives `NaN`, which serialises to `null`), never checks `res.ok`, then resets the form. `deleteEmployee` and `editEmployee` also ignore errors. Rows are built with `innerHTML` and unescaped values, which is an existing XSS risk. Edit/Delete buttons have identical text on every row.
- `style.css`: no focus style (the `input` rule has a border only), no error or feedback styles, no visually-hidden utility.
- `app.py`: the Pydantic model rejects missing or mistyped fields with 422. It has no range, blank or email checks. No change planned.
- No `frontend/accessibility.test.js` on this branch (it lives on `EPAM-69950`).

## Affected components
| File | Change |
|---|---|
| `frontend/index.html` | Wrap fields in `<form id="employee-form" novalidate>`, link every label to its input, add required hints and error containers, add a live region, add table caption and `scope`, and keep a logical DOM-order tab sequence. |
| `frontend/script.js` | Validation, feedback, response handling, per-row button names, HTML escaping, focus management. |
| `frontend/style.css` | Small additions only: `:focus-visible` outlines, `.field-error`, `.feedback--success/--error`, `.sr-only`, `.required-mark`. Not named in the Jira scope; needed for visible focus and error states (see risks). |
| `app.py` | No change. |

No API or model change. Employee contract is unchanged.

## Design

### Markup (AC1, AC4)
- `<form id="employee-form" novalidate aria-labelledby="form-title">`. `novalidate` turns off the browser's native pop-ups so errors render inline and are announced by us. The inputs still carry native `required`, `type`, `min`, `max`, `maxlength` and `step` attributes. They serve as hints and for assistive tech, and `checkValidity()` and `validity` supply the checks, with JS adding messages and the stricter rules. This follows the design's "native HTML5 where possible, custom JS on top".
- Each field: `<label for="x">Name <span class="required-mark" aria-hidden="true">*</span></label>`, `<input id="x" required aria-required="true" aria-describedby="x-error" autocomplete="...">`, and `<span id="x-error" class="field-error">`. The error spans are not individually `role="alert"`. When a field is invalid, `aria-invalid="true"` is set and the message goes into `x-error`. The error summary and the first invalid field's focus carry the announcement.
- Required hint paragraph above the form: "Fields marked * are required. All fields are required." with `id="required-hint"`. The form references it with `aria-describedby`.
- Feedback region: `<div id="feedback" role="status" aria-live="polite" aria-atomic="true">` (always present in DOM, content injected). Errors use `role="alert"` through a second region `#feedback-error` (`aria-live="assertive"`), so failures interrupt and successes don't.
- Submit is a real `<button type="submit">`. `onsubmit` is wired with `addEventListener("submit", ...)` and `preventDefault()`. Remove the inline `onclick` on submit. Enter in a field submits, which is the keyboard behaviour users expect.
- Table: `<caption class="sr-only">`, `<th scope="col">`, and Edit/Delete buttons are real `<button type="button">` with `aria-label="Edit <name>"` and `"Delete <name>"`. Buttons are natively tabbable, so tab order follows DOM order: form fields, submit, table buttons.
- Edit mode: when editing, set the heading and submit text to "Edit Employee" / "Update Employee" and move focus to the Name field. Add a Cancel button (type=button) that calls `resetForm()`. Both are minor and tied to AC3/AC4 (feedback that the mode changed).

### Validation (AC2)
Proposed rules (assumption A2; Open Question 1 was not answered, so these are defaults and easy to change in one `RULES` map):
| Field | Rule |
|---|---|
| name, position, department | trimmed, non-empty, max 100 chars |
| age | integer, 18 to 100 |
| email | non-empty, matches a simple `x@y.z` pattern, max 254 |
| salary | number, greater than 0 |
| experience | integer, 0 to 80 (no cross-check against age, to avoid over-validation) |

- `validateForm()` returns `{ valid, errors: {fieldId: message} }`. On submit it checks every field. If any fail: set `aria-invalid`, write messages to `x-error`, show an error summary in the feedback-error region ("Please fix N fields: ..."), focus the first invalid field, and do **not** call `fetch`.
- Fields also revalidate on `blur` and clear their error on valid `input`, so errors don't linger.
- Values are trimmed before sending. Numbers are parsed only after validation passes, so `NaN` can never reach the API.
- Server 422 is still handled (below) as the second line of defence.

### Feedback (AC3)
- `submitForm`, `deleteEmployee`, `editEmployee` and `loadEmployees` check `res.ok`. Success messages: "Employee <name> added.", "Employee <name> updated.", "Employee deleted." Failure messages: "Could not add employee (<status>)", and a specific message for 404 ("Employee no longer exists"), 422 ("Server rejected the data") and network errors (`catch`: "Cannot reach the server").
- The form is reset **only after** a successful response, so a failed submit keeps the user's input.
- `showFeedback(type, message)` writes to the matching live region and clears the other. Messages stay until the next action (assumption for Open Question 3), so screen-reader and slow users don't miss them.
- Delete asks `confirm("Delete <name>?")` first (Open Question 2: proposed default; cheap, prevents accidental data loss and is keyboard-accessible). Cancelling gives no message and no request.
- After delete, focus moves to the Add form heading/first field so keyboard focus isn't lost with the removed row.

### Security
- Replace string `innerHTML +=` row building with an `escapeHtml()` helper (or `textContent` via DOM creation) for all employee fields, since names now also go into `aria-label` attributes. This closes the existing stored-XSS path and is required, not optional, because we are adding new attribute injection points. Row ids are numbers from the server and are coerced with `Number()`.
- No new network surface, no secrets, no new dependencies. CORS, the in-memory store and `app.py` are untouched.

## Alternatives considered
- **Native validation bubbles only (no `novalidate`)**: less code, but messages are not consistently announced and can't be styled, and `type=number` accepts values like `-5` without `min`. Rejected; we still use native constraint attributes.
- **Separate `validation.js` / `accessibility.js`**: the design says investigate. Total new logic is about 150 lines; one file matches the repo's single-script convention. Rejected for now.
- **Toast notifications with auto-dismiss**: risk of messages vanishing before they are read. Rejected for persistent status text in a live region.
- **Adding server-side range validation in `app.py`**: out of the story's scope (frontend only). Noted as a follow-up.

## Risks
- `style.css` is outside the Jira scope list (`index.html`, `script.js`). Focus and error styles need it. Mitigation: additive rules only; flag at G2.
- Validation ranges are assumptions and may reject data the business considers valid. Mitigation: single `RULES` map; confirm at G2.
- `confirm()` is a blocking native dialog. Accessible by default but not themeable. Acceptable.
- Existing data can contain values failing the new rules, so editing such a record forces a fix. Acceptable, and arguably intended.
- No automated test runner exists. Verification relies on a dependency-free Node check (see plan) plus manual keyboard/screen-reader review, which must be reported as manual, not claimed as automated.
- Branch `KAN-1` already exists locally and on `origin`; no new branch is needed at G3.
