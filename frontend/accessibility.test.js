// Simple, dependency-free accessibility assertions for frontend/index.html
// Run: node frontend/accessibility.test.js

const fs = require("fs");
const path = require("path");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getAttr(tag, attrName) {
  const re = new RegExp(`\\b${escapeRegExp(attrName)}\\s*=\\s*"([^"]*)"`, "i");
  const m = tag.match(re);
  return m ? m[1] : null;
}

function findTag(html, tagName, predicate) {
  const re = new RegExp(`<${escapeRegExp(tagName)}\\b[^>]*>`, "gi");
  const tags = html.match(re) || [];
  return tags.find((t) => (predicate ? predicate(t) : true));
}

function findAllTags(html, tagName) {
  const re = new RegExp(`<${escapeRegExp(tagName)}\\b[^>]*>`, "gi");
  return html.match(re) || [];
}

function findControlById(html, id) {
  const idEsc = escapeRegExp(id);

  // Restrict to common form controls explicitly (no unsupported tagName patterns)
  const candidates = []
    .concat(findAllTags(html, "input"))
    .concat(findAllTags(html, "select"))
    .concat(findAllTags(html, "textarea"));

  return candidates.find((t) => getAttr(t, "id") === id) || null;
}

const htmlPath = path.join(__dirname, "index.html");
const html = fs.readFileSync(htmlPath, "utf8");

// Required hint exists
assert(
  /Required fields are marked with \*/i.test(html),
  "Missing required-fields hint text"
);

// Form exists
assert(/<form\b/i.test(html), "Missing <form>");

// Expected fields from story (all required)
const requiredIds = [
  "name",
  "age",
  "position",
  "department",
  "email",
  "salary",
  "experience",
];

for (const id of requiredIds) {
  // input/select/textarea with id
  const fieldTag = findControlById(html, id);
  assert(fieldTag, `Missing form control with id="${id}"`);

  // label for
  const labelTag = findTag(html, "label", (t) => getAttr(t, "for") === id);
  assert(labelTag, `Missing <label for="${id}">`);

  // aria-required
  assert(
    (getAttr(fieldTag, "aria-required") || "").toLowerCase() === "true",
    `Missing aria-required="true" on #${id}`
  );

  // required attribute
  assert(
    /\srequired\b/i.test(fieldTag),
    `Missing required attribute on #${id}`
  );
}

// Hidden id field exists for edit flow
const idField = findTag(html, "input", (t) => getAttr(t, "id") === "emp-id");
assert(idField, "Missing hidden employee id field #emp-id");
assert(
  (getAttr(idField, "type") || "").toLowerCase() === "hidden",
  "#emp-id should be type=hidden"
);

// Table has tbody for population
assert(/<tbody\b/i.test(html), "Missing <tbody> for employee rows");

console.log("Accessibility smoke tests passed.");