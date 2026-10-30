// Dependency-free accessibility and validation checks for KAN-1.
// Run from the repo root: node frontend/accessibility.test.js
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const js = fs.readFileSync(path.join(__dirname, "script.js"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "style.css"), "utf8");
const vm = require("vm");
const { validateValues } = require("./script.js");

const FIELDS = ["name", "age", "position", "department", "email", "salary", "experience"];
let count = 0;
function check(name, fn) {
    fn();
    count++;
    console.log(`ok - ${name}`);
}

const inputs = [...html.matchAll(/<input\b[^>]*>/g)].map((m) => m[0]).filter((t) => !/type="hidden"/.test(t));
const attr = (tag, a) => (tag.match(new RegExp(`\\s${a}="([^"]*)"`)) || [])[1];

// AC1
check("AC1: seven visible inputs", () => assert.strictEqual(inputs.length, 7));
inputs.forEach((tag) => {
    const id = attr(tag, "id");
    check(`AC1: ${id} has label, required, aria-required, describedby`, () => {
        assert.ok(new RegExp(`<label[^>]*\\sfor="${id}"`).test(html), "label for");
        assert.ok(/\srequired[\s>]/.test(tag), "required");
        assert.strictEqual(attr(tag, "aria-required"), "true");
        const d = attr(tag, "aria-describedby");
        assert.strictEqual(d, `${id}-error`);
        assert.ok(new RegExp(`id="${d}"`).test(html), "describedby target exists");
    });
});
check("AC1: required hint exists with exact text", () =>
    assert.ok(/<p id="required-hint">Fields marked \* are required\.<\/p>/.test(html)));
check("AC1: form references hint and title", () => {
    const form = html.match(/<form\b[^>]*>/)[0];
    assert.strictEqual(attr(form, "aria-describedby"), "required-hint");
    assert.strictEqual(attr(form, "aria-labelledby"), "form-title");
});

// AC2
check("AC2: empty object invalid for every field", () =>
    assert.deepStrictEqual(Object.keys(validateValues({})).sort(), [...FIELDS].sort()));
const valid = { name: "Ann", age: "30", position: "Dev", department: "IT", email: "a@b.co", salary: "5000", experience: "3" };
check("AC2: valid object has no errors", () => assert.deepStrictEqual(validateValues(valid), {}));
const bad = (over) => Object.keys(validateValues({ ...valid, ...over }));
check("AC2: whitespace name invalid", () => assert.deepStrictEqual(bad({ name: "   " }), ["name"]));
check("AC2: age 17/101/1.5/abc invalid, 18/100 valid", () => {
    ["17", "101", "1.5", "abc"].forEach((a) => assert.deepStrictEqual(bad({ age: a }), ["age"]));
    ["18", "100"].forEach((a) => assert.deepStrictEqual(bad({ age: a }), []));
});
check("AC2: salary 0/-5/too large invalid", () => {
    ["0", "-5", "10000001"].forEach((s) => assert.deepStrictEqual(bad({ salary: s }), ["salary"]));
    assert.deepStrictEqual(bad({ salary: "1234.5" }), []);
});
check("AC2: bad emails invalid", () => {
    ["x", "a@b", "a b@c.d", "@b.c"].forEach((e) => assert.deepStrictEqual(bad({ email: e }), ["email"]));
});
check("AC2: experience -1/81/1.5 invalid, 0/80 valid", () => {
    ["-1", "81", "1.5"].forEach((x) => assert.deepStrictEqual(bad({ experience: x }), ["experience"]));
    ["0", "80"].forEach((x) => assert.deepStrictEqual(bad({ experience: x }), []));
});
check("AC2: badInput reports valid-number message, not required", () => {
    const e = validateValues({ ...valid, salary: "" }, { salary: true });
    assert.strictEqual(e.salary, "Enter a valid number");
});
check("AC2: over-100-char text invalid", () => assert.deepStrictEqual(bad({ position: "x".repeat(101) }), ["position"]));
check("AC2: submit handler prevents default and validates before fetch", () => {
    const fn = js.slice(js.indexOf("async function submitForm"), js.indexOf("async function editEmployee"));
    assert.ok(/preventDefault\(\)/.test(fn));
    assert.ok(fn.indexOf("validateForm()") !== -1 && fn.indexOf("validateForm()") < fn.indexOf("request("));
});

// AC3
check("AC3: #feedback is a polite status region", () => {
    const t = html.match(/<div id="feedback"[^>]*>/)[0];
    assert.strictEqual(attr(t, "role"), "status");
    assert.ok(attr(t, "aria-live"));
});
check("AC3: #feedback-error is an assertive alert region", () => {
    const t = html.match(/<div id="feedback-error"[^>]*>/)[0];
    assert.strictEqual(attr(t, "role"), "alert");
    assert.strictEqual(attr(t, "aria-live"), "assertive");
});
check("AC3: live regions are never display:none (stay in the accessibility tree)", () => {
    const rules = [...css.matchAll(/([^{}]*\.feedback[^{}]*)\{([^}]*)\}/g)];
    assert.ok(rules.length > 0);
    rules.forEach((m) => assert.ok(!/display\s*:\s*none/.test(m[2]), `display:none in ${m[1].trim()}`));
});
function fnBody(name) {
    const start = js.indexOf(`function ${name}(`);
    assert.ok(start !== -1, `${name} exists`);
    const next = js.slice(start + 1).search(/\n    (async )?function /);
    return next === -1 ? js.slice(start) : js.slice(start, start + 1 + next);
}
check("AC3: add/update/delete success and failure paths each call showFeedback", () => {
    const submit = fnBody("submitForm");
    assert.ok(/showFeedback\("error", `\$\{id \? "Update" : "Add"\} failed/.test(submit), "submit failure");
    assert.ok(/showFeedback\("success", \(id \? "Employee updated successfully\." : "Employee added successfully\."\)/.test(submit), "submit success");
    const del = fnBody("deleteEmployee");
    assert.ok(/showFeedback\("error", `Delete failed\./.test(del), "delete failure");
    assert.ok(/showFeedback\("success", "Employee deleted successfully\."/.test(del), "delete success");
    assert.ok(/showFeedback\("error", `Could not load employee for editing/.test(fnBody("editEmployee")), "edit load failure");
    assert.ok(/res\.ok/.test(fnBody("request")), "res.ok checked");
});
check("AC3/security: no innerHTML assignment other than clearing; no dead escapeHtml", () => {
    const assigns = [...js.matchAll(/innerHTML\s*(\+?=)\s*([^;]*);/g)];
    assigns.forEach((m) => assert.ok(m[1] === "=" && m[2].trim() === '""', `innerHTML ${m[1]} ${m[2]}`));
    assert.ok(!/escapeHtml/.test(js));
});
check("AC3: row cells set via textContent", () => assert.ok(/td\.textContent = text/.test(fnBody("cell"))));

// AC4
check("AC4: real form with submit button, no inline onclick", () => {
    assert.ok(/<form\b/.test(html));
    assert.ok(/<button type="submit" id="submit-btn"/.test(html));
    assert.ok(!/onclick=/.test(html));
});
check("AC4: no positive tabindex", () => {
    [...html.matchAll(/tabindex="(-?\d+)"/g)].forEach((m) => assert.ok(Number(m[1]) <= 0));
});
check("AC4: row buttons are type=button with aria-label", () => {
    assert.ok(/b\.type = "button"/.test(js));
    assert.ok(/setAttribute\("aria-label"/.test(js));
});
check("AC4: all th have scope=col and caption present", () => {
    const ths = [...html.matchAll(/<th\b[^>]*>/g)].map((m) => m[0]);
    assert.ok(ths.length === 9 && ths.every((t) => attr(t, "scope") === "col"));
    assert.ok(/<caption[^>]*>Employee list<\/caption>/.test(html));
});

// ---------------------------------------------------------------------------
// Behavioural checks: run the real script.js against a minimal fake DOM and fetch.
// ---------------------------------------------------------------------------
function makeEnv(initial, opts) {
    const log = [];
    const doc = { activeElement: null, byId: {}, tbody: null };
    class El {
        constructor(tag, id) {
            this.tagName = tag; this.id = id || ""; this.children = []; this.attrs = {}; this.listeners = {};
            this._text = ""; this._value = ""; this.className = ""; this.hidden = false; this.disabled = false;
            this.validity = { badInput: false };
        }
        get textContent() { return this._text; }
        set textContent(v) {
            this._text = String(v);
            if ((this.id === "feedback" || this.id === "feedback-error") && this._text !== "") log.push(`feedback:${this.id}`);
        }
        get value() { return this._value; }
        set value(v) { this._value = String(v); } // real inputs coerce to string
        set innerHTML(v) { assert.strictEqual(v, "", "innerHTML only cleared"); this.children = []; }
        setAttribute(k, v) { this.attrs[k] = String(v); }
        getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
        removeAttribute(k) { delete this.attrs[k]; }
        appendChild(c) { this.children.push(c); return c; }
        addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
        focus() { doc.activeElement = this; log.push(`focus:${this.id || this.className}`); }
        fire(t) { return Promise.all((this.listeners[t] || []).map((fn) => fn({ preventDefault() { } }))); }
        walk(out) { this.children.forEach((c) => { out.push(c); c.walk(out); }); return out; }
        querySelector(sel) {
            const cls = sel.replace(/^\./, "");
            return this.walk([]).find((c) => c.className.split(" ").includes(cls)) || null;
        }
    }
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    ids.forEach((id) => { doc.byId[id] = new El("el", id); });
    doc.body = new El("body");
    doc.tbody = doc.byId["employee-table-body"] || new El("tbody");
    doc.byId["submit-btn"]._text = "Add Employee";
    doc.byId["form-title"]._text = "Add Employee";
    doc.byId["cancel-btn"].hidden = true;
    doc.byId["feedback"].className = "feedback";
    doc.byId["feedback-error"].className = "feedback";
    doc.activeElement = doc.body;
    const document = {
        get activeElement() { return doc.activeElement; },
        body: doc.body,
        getElementById: (id) => doc.byId[id],
        createElement: (t) => new El(t),
        querySelector: (s) => (s === "tbody" ? doc.tbody : null),
        querySelectorAll: (s) => (s === "tbody tr" ? doc.tbody.children : [])
    };
    const server = { employees: initial.map((e) => ({ ...e })), calls: [], fail: {}, badJson: {}, detail422: null, gate: null, listDown: false };
    const fetch = async (url, o) => {
        const method = (o && o.method) || "GET";
        const p = url.replace("http://localhost:8000", "");
        server.calls.push({ method, p, body: o && o.body });
        if (server.gate && method !== "GET") await server.gate;
        const failKey = `${method} ${p}`;
        const res = (status, body) => ({ ok: status < 400, status, json: async () => body });
        if (server.badJson[failKey]) return { ok: true, status: 200, json: async () => { throw new Error("not json"); } };
        if (server.fail[failKey]) return res(server.fail[failKey], { detail: server.detail422 || "x" });
        if (method === "GET" && p === "/employees") return server.listDown ? res(500, {}) : res(200, server.employees);
        const m = p.match(/^\/employees\/(\d+)$/);
        if (method === "GET" && m) { const e = server.employees.find((x) => x.id === +m[1]); return e ? res(200, e) : res(404, {}); }
        if (method === "POST") { const e = { id: 100 + server.employees.length, ...JSON.parse(o.body) }; server.employees.push(e); return res(200, e); }
        if (method === "PUT") { const e = server.employees.find((x) => x.id === +m[1]); Object.assign(e, JSON.parse(o.body)); return res(200, e); }
        if (method === "DELETE") { server.employees = server.employees.filter((x) => x.id !== +m[1]); return res(200, {}); }
        return res(500, {});
    };
    const win = { confirm: () => (opts && opts.confirm !== undefined ? opts.confirm : true) };
    vm.runInNewContext(js, { document, window: win, fetch, console, setTimeout });
    const $ = (id) => doc.byId[id];
    const rows = () => doc.tbody.children;
    const btn = (row, cls) => row.querySelector(cls);
    const fill = (v) => Object.keys(v).forEach((k) => { $(k).value = v[k]; });
    return { $, rows, btn, fill, server, log, doc, win };
}
const tick = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0)); };
const emps = [
    { id: 1, name: "<img src=x onerror=alert(1)>", age: 30, position: "Dev", department: "IT", email: "a@b.co", salary: 5000, experience: 3 },
    { id: 2, name: "Bob", age: 40, position: "QA", department: "IT", email: "b@b.co", salary: 6000, experience: 9 },
    { id: 3, name: "Cy", age: 50, position: "PM", department: "HR", email: "c@b.co", salary: 7000, experience: 20 }
];
const newEmp = { name: "Dee", age: "28", position: "Dev", department: "IT", email: "d@b.co", salary: "4500", experience: "2" };
const asyncTests = [];
const atest = (name, fn) => asyncTests.push({ name, fn });

atest("DOM: rows are built from data via textContent with per-row aria-labels", async () => {
    const e = makeEnv(emps); await tick();
    assert.strictEqual(e.rows().length, 3);
    assert.strictEqual(e.rows()[0].children[1].textContent, emps[0].name); // raw text, never parsed as markup
    assert.strictEqual(btn0(e).getAttribute("aria-label"), `Delete ${emps[0].name}`);
    assert.strictEqual(e.rows()[0].children[8].children[0].getAttribute("aria-label"), `Edit ${emps[0].name}`);
    assert.strictEqual(e.rows()[0].children[8].children[0].type, "button");
});
function btn0(e) { return e.rows()[0].children[8].children[1]; }

atest("AC2: invalid submit sends nothing, sets aria-invalid and focuses the first invalid field", async () => {
    const e = makeEnv([]); await tick();
    e.fill({ ...newEmp, age: "5", email: "bad" });
    await e.$("employee-form").fire("submit");
    assert.ok(!e.server.calls.some((c) => c.method !== "GET"));
    assert.strictEqual(e.$("age").getAttribute("aria-invalid"), "true");
    assert.strictEqual(e.$("age-error").textContent, "Age must be between 18 and 100");
    assert.strictEqual(e.doc.activeElement, e.$("age"));
});
atest("AC3: successful add posts parsed values, shows success feedback, clears the form", async () => {
    const e = makeEnv([]); await tick();
    e.fill(newEmp);
    await e.$("employee-form").fire("submit"); await tick();
    const post = e.server.calls.find((c) => c.method === "POST");
    assert.deepStrictEqual(JSON.parse(post.body), { name: "Dee", age: 28, position: "Dev", department: "IT", email: "d@b.co", salary: 4500, experience: 2 });
    assert.strictEqual(e.$("feedback").textContent, "Employee added successfully.");
    assert.strictEqual(e.$("feedback").className, "feedback success");
    assert.strictEqual(e.$("name").value, "");
    assert.strictEqual(e.rows().length, 1);
});
atest("AC3: failed add shows error feedback and keeps the entered data", async () => {
    const e = makeEnv([]); await tick();
    e.server.fail["POST /employees"] = 500;
    e.fill(newEmp);
    await e.$("employee-form").fire("submit"); await tick();
    assert.ok(/^Add failed\./.test(e.$("feedback-error").textContent));
    assert.strictEqual(e.$("feedback-error").className, "feedback error");
    assert.strictEqual(e.$("name").value, "Dee");
});
atest("M3: submit is disabled with aria-busy while in flight and a second submit is ignored", async () => {
    const e = makeEnv([]); await tick();
    let release; e.server.gate = new Promise((r) => { release = r; });
    e.fill(newEmp);
    const first = e.$("employee-form").fire("submit");
    await tick();
    assert.strictEqual(e.$("submit-btn").disabled, true);
    assert.strictEqual(e.$("submit-btn").getAttribute("aria-busy"), "true");
    await e.$("employee-form").fire("submit");
    release(); await first; await tick();
    assert.strictEqual(e.server.calls.filter((c) => c.method === "POST").length, 1);
    assert.strictEqual(e.$("submit-btn").disabled, false);
    assert.strictEqual(e.$("submit-btn").getAttribute("aria-busy"), null);
});
atest("AC4/M4: edit fills the form and enters edit mode; Cancel clears data, errors, feedback and mode", async () => {
    const e = makeEnv(emps); await tick();
    e.fill({ age: "" });
    await e.$("employee-form").fire("submit"); // leaves field errors behind
    assert.ok(e.$("name-error").textContent !== "");
    await e.rows()[1].children[8].children[0].listeners.click[0](); await tick();
    assert.strictEqual(e.$("name").value, "Bob");
    assert.strictEqual(e.$("emp-id").value, "2");
    assert.strictEqual(e.$("form-title").textContent, "Edit Employee");
    assert.strictEqual(e.$("submit-btn").textContent, "Update Employee");
    assert.strictEqual(e.$("cancel-btn").hidden, false);
    assert.strictEqual(e.$("name-error").textContent, "");
    assert.strictEqual(e.$("name").getAttribute("aria-invalid"), null);
    assert.strictEqual(e.doc.activeElement, e.$("name"));
    e.$("feedback-error").textContent = "stale"; e.$("feedback-error").className = "feedback error";
    await e.$("cancel-btn").fire("click");
    assert.strictEqual(e.$("name").value, "");
    assert.strictEqual(e.$("emp-id").value, "");
    assert.strictEqual(e.$("form-title").textContent, "Add Employee");
    assert.strictEqual(e.$("submit-btn").textContent, "Add Employee");
    assert.strictEqual(e.$("cancel-btn").hidden, true);
    assert.strictEqual(e.$("feedback-error").textContent, "");
    assert.strictEqual(e.$("feedback-error").className, "feedback");
});
atest("AC3: update sends PUT and shows the update message", async () => {
    const e = makeEnv(emps); await tick();
    await e.rows()[1].children[8].children[0].listeners.click[0](); await tick();
    e.fill({ position: "Lead" });
    await e.$("employee-form").fire("submit"); await tick();
    assert.ok(e.server.calls.some((c) => c.method === "PUT" && c.p === "/employees/2"));
    assert.strictEqual(e.$("feedback").textContent, "Employee updated successfully.");
    assert.strictEqual(e.$("form-title").textContent, "Add Employee");
});
atest("AC3/M2: cancelled confirm deletes nothing", async () => {
    const e = makeEnv(emps, { confirm: false }); await tick();
    await btnClick(e.rows()[0], "delete-btn"); await tick();
    assert.ok(!e.server.calls.some((c) => c.method === "DELETE"));
});
function btnClick(row, cls) { return row.querySelector(cls).listeners.click[0](); }
atest("AC3/M2: delete success moves focus to the next row's Delete button, then announces", async () => {
    const e = makeEnv(emps); await tick();
    e.log.length = 0;
    await btnClick(e.rows()[1], "delete-btn"); await tick();
    assert.strictEqual(e.rows().length, 2);
    assert.strictEqual(e.$("feedback").textContent, "Employee deleted successfully.");
    assert.strictEqual(e.doc.activeElement, e.rows()[1].querySelector("delete-btn"));
    assert.ok(!e.log.includes("focus:form-title"), "heading is not focused");
    assert.ok(e.log.lastIndexOf("feedback:feedback") > e.log.lastIndexOf("focus:delete-btn"), "message set after focus move");
});
atest("M2: deleting the last row focuses the previous row's Delete button", async () => {
    const e = makeEnv(emps); await tick();
    await btnClick(e.rows()[2], "delete-btn"); await tick();
    assert.strictEqual(e.doc.activeElement, e.rows()[1].querySelector("delete-btn"));
});
atest("AC3/M2: failed delete (404) shows error and restores focus into the table, not <body>", async () => {
    const e = makeEnv(emps); await tick();
    e.server.fail["DELETE /employees/2"] = 404;
    await btnClick(e.rows()[1], "delete-btn"); await tick();
    assert.ok(/^Delete failed\. Employee not found/.test(e.$("feedback-error").textContent));
    assert.strictEqual(e.doc.activeElement, e.rows()[1].querySelector("delete-btn"));
    assert.notStrictEqual(e.doc.activeElement, e.doc.body);
});
atest("M2: failed edit load restores focus to that row's Edit button and shows an error", async () => {
    const e = makeEnv(emps); await tick();
    e.server.fail["GET /employees/2"] = 404;
    await btnClick(e.rows()[1], "edit-btn"); await tick();
    assert.ok(/^Could not load employee for editing\./.test(e.$("feedback-error").textContent));
    assert.strictEqual(e.doc.activeElement, e.rows()[1].querySelector("edit-btn"));
});
atest("L2: refresh failure after a successful delete is reported, not swallowed", async () => {
    const e = makeEnv(emps); await tick();
    e.server.listDown = true;
    await btnClick(e.rows()[0], "delete-btn"); await tick();
    assert.ok(/Employee deleted successfully\. The list could not be refreshed\./.test(e.$("feedback").textContent));
});
atest("L3: a 2xx edit response with an unusable body does not throw and reports an error", async () => {
    const e = makeEnv(emps); await tick();
    e.server.badJson["GET /employees/2"] = true;
    await btnClick(e.rows()[1], "edit-btn"); await tick();
    assert.ok(/^Could not load employee for editing\. The server returned an unexpected response\./.test(e.$("feedback-error").textContent));
    assert.strictEqual(e.$("cancel-btn").hidden, true);
});
atest("L5: a 422 response surfaces the field and reason from the server", async () => {
    const e = makeEnv([]); await tick();
    e.server.detail422 = [{ loc: ["body", "age"], msg: "value is not a valid integer" }];
    e.server.fail["POST /employees"] = 422;
    e.fill(newEmp);
    await e.$("employee-form").fire("submit"); await tick();
    assert.ok(/age: value is not a valid integer/.test(e.$("feedback-error").textContent));
});

(async () => {
    for (const t of asyncTests) {
        try {
            await t.fn();
        } catch (err) {
            console.error(`FAIL - ${t.name}`);
            throw err;
        }
        count++;
        console.log(`ok - ${t.name}`);
    }
    console.log(`\nAll ${count} checks passed.`);
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
