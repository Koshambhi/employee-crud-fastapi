const API_URL = "http://localhost:8000";

const FIELD_IDS = ["name", "age", "position", "department", "email", "salary", "experience"];

// Single source of truth for validation. Pure (no DOM) so it can be tested in Node.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INTEGER_PATTERN = /^-?\d+$/;

function requiredText(label) {
    return (v) => {
        if (v === "") return `${label} is required`;
        if (v.length > 100) return `${label} must be at most 100 characters`;
        return null;
    };
}

function integerInRange(label, min, max) {
    return (v) => {
        if (v === "") return `${label} is required`;
        if (!INTEGER_PATTERN.test(v)) return `${label} must be a whole number`;
        const n = Number(v);
        if (n < min || n > max) return `${label} must be between ${min} and ${max}`;
        return null;
    };
}

const RULES = {
    name: requiredText("Name"),
    age: integerInRange("Age", 18, 100),
    position: requiredText("Position"),
    department: requiredText("Department"),
    email: (v) => {
        if (v === "") return "Email is required";
        if (v.length > 100) return "Email must be at most 100 characters";
        if (!EMAIL_PATTERN.test(v)) return "Enter a valid email address";
        return null;
    },
    salary: (v) => {
        if (v === "") return "Salary is required";
        const n = Number(v);
        if (!Number.isFinite(n)) return "Enter a valid number";
        if (n <= 0) return "Salary must be greater than 0";
        if (n > 10000000) return "Salary must be at most 10,000,000";
        return null;
    },
    experience: integerInRange("Experience", 0, 80)
};

// values: plain object of raw field values. badInput: ids the browser reports as unparsable numbers.
// Returns an object of id -> message; empty when valid.
function validateValues(values, badInput) {
    const errors = {};
    const bad = badInput || {};
    const vals = values || {};
    FIELD_IDS.forEach((id) => {
        if (bad[id]) {
            errors[id] = "Enter a valid number";
            return;
        }
        const raw = vals[id];
        const v = raw === undefined || raw === null ? "" : String(raw).trim();
        const msg = RULES[id](v);
        if (msg) errors[id] = msg;
    });
    return errors;
}

function escapeHtml(value) {
    return String(value === undefined || value === null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

if (typeof module !== "undefined") {
    module.exports = { validateValues, escapeHtml, RULES };
}

if (typeof document !== "undefined") {
    const byId = (id) => document.getElementById(id);

    function readValues() {
        const values = {};
        const badInput = {};
        FIELD_IDS.forEach((id) => {
            const el = byId(id);
            values[id] = el.value;
            if (el.validity && el.validity.badInput) badInput[id] = true;
        });
        return { values, badInput };
    }

    function setFieldError(id, message) {
        const input = byId(id);
        byId(`${id}-error`).textContent = message || "";
        if (message) input.setAttribute("aria-invalid", "true");
        else input.removeAttribute("aria-invalid");
    }

    function clearFieldErrors() {
        FIELD_IDS.forEach((id) => setFieldError(id, ""));
    }

    function validateField(id) {
        const { values, badInput } = readValues();
        const errors = validateValues(values, badInput);
        setFieldError(id, errors[id]);
        return !errors[id];
    }

    function validateForm() {
        const { values, badInput } = readValues();
        const errors = validateValues(values, badInput);
        let first = null;
        FIELD_IDS.forEach((id) => {
            setFieldError(id, errors[id]);
            if (errors[id] && !first) first = id;
        });
        if (first) byId(first).focus();
        return !first;
    }

    function clearFeedback() {
        [byId("feedback"), byId("feedback-error")].forEach((el) => {
            el.textContent = "";
            el.className = "feedback";
        });
    }

    function showFeedback(type, message) {
        clearFeedback();
        const el = byId(type === "error" ? "feedback-error" : "feedback");
        el.className = `feedback ${type}`;
        el.textContent = message;
    }

    function feedbackPending() {
        return byId("feedback").textContent !== "" || byId("feedback-error").textContent !== "";
    }

    // Wraps fetch: resolves to { data } on success or { error } with a user-facing message.
    async function request(path, options, notFoundMsg) {
        let res;
        try {
            res = await fetch(`${API_URL}${path}`, options);
        } catch (e) {
            return { error: "Could not reach the server. Check that it is running and try again." };
        }
        if (!res.ok) {
            if (res.status === 404) return { error: notFoundMsg || "Employee not found. It may have been deleted." };
            if (res.status === 422) return { error: "The server rejected the data. Check the fields and try again." };
            return { error: `Request failed (status ${res.status}). Please try again.` };
        }
        try {
            return { data: await res.json() };
        } catch (e) {
            return { data: null };
        }
    }

    function cell(text) {
        const td = document.createElement("td");
        td.textContent = text;
        return td;
    }

    function actionButton(cls, label, name, handler) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = cls;
        b.textContent = label;
        b.setAttribute("aria-label", `${label} ${name}`);
        b.addEventListener("click", handler);
        return b;
    }

    async function loadEmployees() {
        const result = await request("/employees", undefined, "Employee list not found.");
        if (result.error) {
            if (!feedbackPending()) showFeedback("error", `Could not load employees. ${result.error}`);
            return false;
        }
        const tbody = document.querySelector("tbody");
        tbody.innerHTML = "";
        (result.data || []).forEach((emp) => {
            const id = Number(emp.id);
            const tr = document.createElement("tr");
            [emp.id, emp.name, emp.age, emp.position, emp.department, emp.email, emp.salary, emp.experience]
                .forEach((v) => tr.appendChild(cell(v)));
            const actions = document.createElement("td");
            actions.appendChild(actionButton("edit-btn", "Edit", emp.name, () => editEmployee(id)));
            actions.appendChild(actionButton("delete-btn", "Delete", emp.name, () => deleteEmployee(id)));
            tr.appendChild(actions);
            tbody.appendChild(tr);
        });
        return true;
    }

    function setEditMode(editing) {
        byId("form-title").textContent = editing ? "Edit Employee" : "Add Employee";
        byId("submit-btn").textContent = editing ? "Update Employee" : "Add Employee";
        byId("cancel-btn").hidden = !editing;
    }

    function resetForm() {
        byId("emp-id").value = "";
        FIELD_IDS.forEach((id) => { byId(id).value = ""; });
        clearFieldErrors();
        clearFeedback();
        setEditMode(false);
    }

    async function submitForm(event) {
        if (event) event.preventDefault();
        if (!validateForm()) return;

        const id = byId("emp-id").value;
        const v = {};
        FIELD_IDS.forEach((f) => { v[f] = byId(f).value.trim(); });
        const empData = {
            name: v.name,
            age: parseInt(v.age, 10),
            position: v.position,
            department: v.department,
            email: v.email,
            salary: parseFloat(v.salary),
            experience: parseInt(v.experience, 10)
        };

        const result = await request(
            id ? `/employees/${id}` : "/employees",
            {
                method: id ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(empData)
            }
        );
        if (result.error) {
            showFeedback("error", `${id ? "Update" : "Add"} failed. ${result.error}`);
            return; // keep the user's data in the form
        }
        resetForm();
        showFeedback("success", id ? "Employee updated successfully." : "Employee added successfully.");
        loadEmployees();
    }

    async function editEmployee(id) {
        const result = await request(`/employees/${id}`);
        if (result.error) {
            showFeedback("error", `Could not load employee for editing. ${result.error}`);
            loadEmployees();
            return;
        }
        const emp = result.data;
        clearFieldErrors();
        clearFeedback();
        byId("emp-id").value = emp.id;
        FIELD_IDS.forEach((f) => { byId(f).value = emp[f]; });
        setEditMode(true);
        byId("name").focus();
    }

    async function deleteEmployee(id) {
        if (!window.confirm("Delete this employee? This cannot be undone.")) return;
        const result = await request(`/employees/${id}`, { method: "DELETE" });
        if (result.error) {
            showFeedback("error", `Delete failed. ${result.error}`);
            loadEmployees();
            return;
        }
        if (byId("emp-id").value === String(id)) resetForm();
        showFeedback("success", "Employee deleted successfully.");
        await loadEmployees();
        byId("form-title").focus();
    }

    byId("employee-form").addEventListener("submit", submitForm);
    byId("cancel-btn").addEventListener("click", () => {
        resetForm();
        byId("name").focus();
    });
    FIELD_IDS.forEach((id) => {
        const el = byId(id);
        el.addEventListener("blur", () => {
            if (el.value !== "" || el.getAttribute("aria-invalid")) validateField(id);
        });
        el.addEventListener("input", () => {
            if (el.getAttribute("aria-invalid") === "true") validateField(id);
        });
    });

    // Keep the original global names available.
    window.editEmployee = editEmployee;
    window.deleteEmployee = deleteEmployee;
    window.submitForm = submitForm;
    window.resetForm = resetForm;

    loadEmployees();
}
