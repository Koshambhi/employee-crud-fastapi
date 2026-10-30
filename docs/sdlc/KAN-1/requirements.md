# KAN-1: Implement client-side validation and user feedback for actions

- Jira: https://koshambhivyas94.atlassian.net/browse/KAN-1 (Task, To Do, Medium)
- Design reference: Confluence "Design: Enhance Frontend Usability and Accessibility" (ENH-006), https://koshambhivyas94.atlassian.net/wiki/spaces/CODEMIE/pages/1441793/Design+Enhance+Frontend+Usability+and+Accessibility

## Summary
Enhance the frontend of the Employee Management System to improve usability and accessibility: accessible labels, ARIA attributes, keyboard navigation, user feedback for add/update/delete, client-side validation, and required-field hints for all form fields.

## Business value
Better experience for all users including those with disabilities; less frustration from unclear UI actions; data integrity; supports accessibility-standards compliance.

## Scope
- Update form and table markup for accessibility (labels, ARIA, keyboard navigation).
- Implement user feedback for add/update/delete actions.
- Add client-side validation and required-field hints.
- Affected files: `frontend/index.html`, `frontend/script.js`.

## Acceptance criteria
The Jira story lists these as "Success Criteria"; the Confluence design repeats them as "Acceptance Criteria".

- **AC1** All form fields have accessible labels, ARIA attributes, and required-field hints.
- **AC2** The form cannot be submitted with missing or invalid data.
- **AC3** The user receives clear feedback for add, update and delete actions.
- **AC4** Keyboard navigation and ARIA attributes are present and functional.

## Constraints (from the design page)
- Vanilla HTML/JS only; no new dependencies unless shown necessary and documented.
- Prefer native HTML5 validation for required fields, supplemented by custom JS validation for more complex checks.
- Feedback messages use ARIA live regions.
- Standards-compliant (WCAG, ARIA).
- Required-field hints are visible above the form.
- New JS files (`frontend/validation.js`, `frontend/accessibility.js`) only if needed; the design marks this as needing investigation.

## Assumptions
- A1 All seven fields (Name, Age, Position, Department, Salary, Experience, Email) are required (stated in the design). Checked against the current form in `frontend/index.html` during design.
- A2 "Invalid data" is not defined in the story. Inferred: empty values, non-numeric or negative Age/Salary/Experience, and malformed Email. Exact rules to be confirmed.
- A3 No backend change is needed (`app.py` untouched). Client-side validation is complementary to the Pydantic validation.
- A4 Success/error feedback covers both API success and API failure for add, update and delete.
- A5 The existing form and table markup and the submit and table-render logic in `script.js` are the starting point (design prerequisites).

## Open questions
1. What are the exact validation rules (age range, salary and experience minimums, email format, maximum lengths)?
2. Should delete ask for confirmation before deleting, in addition to feedback?
3. Should feedback auto-dismiss, or stay until the next action?
4. Should the table's Edit/Delete buttons get per-row accessible names (for example "Delete Jane Doe")?
5. The design's rollout says "Push to main", but this repo's pipeline uses a story branch and a draft PR. Assumed the pipeline wins.
6. Is a Node-based accessibility test (like the one on branch `EPAM-69950`) in scope, or is manual review enough as the design states?
7. The design's "Unknowns" says the exact ARIA requirements may need adjusting after manual review. Is manual keyboard/screen-reader review expected to be recorded in the verification report?
