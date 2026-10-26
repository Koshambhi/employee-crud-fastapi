// Dependency-free accessibility and validation checks for KAN-1.
// Run from the repo root: node frontend/accessibility.test.js
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const js = fs.readFileSync(path.join(__dirname, "script.js"), "utf8");
const { validateValues, escapeHtml } = require("./script.js");

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
check("AC3: #feedback-error is an assertive live region", () => {
    const t = html.match(/<div id="feedback-error"[^>]*>/)[0];
    assert.strictEqual(attr(t, "aria-live"), "assertive");
});
check("AC3: showFeedback used in add/update/delete paths and res.ok checked", () => {
    assert.ok((js.match(/showFeedback\(/g) || []).length >= 6);
    assert.ok(/res\.ok/.test(js));
    assert.ok(/Employee deleted successfully/.test(js) && /Employee added successfully/.test(js) && /Employee updated successfully/.test(js));
});
check("AC3: escapeHtml escapes markup and quotes", () => {
    assert.strictEqual(escapeHtml(`<img src=x onerror="a'b">&`), "&lt;img src=x onerror=&quot;a&#39;b&quot;&gt;&amp;");
    assert.strictEqual(escapeHtml(null), "");
});
check("AC3: rows built with textContent, not innerHTML +=", () => assert.ok(!/innerHTML\s*\+=/.test(js)));

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

console.log(`\nAll ${count} checks passed.`);
