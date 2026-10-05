import test from "node:test";
import assert from "node:assert/strict";
import {
  safeName,
  uniqueNames,
  renamePreview,
  validateProject,
  defaults,
} from "../src/model.js";
test("safe file names handle reserved names, empty names, and path traversal", () => {
  assert.equal(safeName("CON"), "_CON");
  assert.equal(safeName(""), "untitled");
  assert.equal(safeName("a/b\\c?d"), "a-b-c-d");
  assert.equal(safeName("name.  "), "name");
});
test("duplicate resolution is deterministic and case insensitive across the existing collection", () => {
  assert.deepEqual(uniqueNames(["Icon", "icon", "ICON-2", "icon"], ["ICON"]), [
    "Icon-2",
    "icon-3",
    "ICON-2-2",
    "icon-4",
  ]);
});
const items = [
  { id: "1", name: "Home Icon", originalName: "Home Icon" },
  { id: "2", name: "User Icon", originalName: "User Icon" },
  { id: "3", name: "app-01", originalName: "app-01" },
];
test("batch rename combines case, sequence and template in collection order", () => {
  assert.deepEqual(
    renamePreview(items, ["2", "1"], {
      template: "{name}-{n}",
      prefix: "ui-",
      case: "kebab",
      start: 4,
      padding: 3,
    }).map((r) => r.after),
    ["ui-home-icon-004", "ui-user-icon-005"],
  );
});
test("batch rename resolves clashes with unselected files and makes regex failures reviewable", () => {
  assert.equal(
    renamePreview(items, ["1"], { template: "app-01" })[0].after,
    "app-01-2",
  );
  assert.throws(
    () => renamePreview(items, ["1"], { find: "[", regex: true }),
    SyntaxError,
  );
  assert.equal(
    renamePreview(items, ["1", "2"], {
      template: "{name}",
      find: " icon",
      replace: " mark",
      regex: true,
    })[0].after,
    "Home mark",
  );
});
test("empty selection does not rename an active or unselected file", () =>
  assert.deepEqual(renamePreview(items, [], { template: "changed" }), []));
test("project import validates schema and does not retain arbitrary embedded data", () => {
  assert.throws(() => validateProject({ version: 1, items: [] }));
  assert.throws(() =>
    validateProject({
      version: 2,
      items: [
        { name: "evil", svg: "", image: "https://external.example/private" },
      ],
    }),
  );
  const restored = validateProject({
    version: 2,
    items: [
      {
        id: "x",
        name: "okay",
        svg: "<svg/>",
        image: "",
        style: { ...defaults, bgColor1: "red", duration: 99 },
        processedImage: '\"/><script>bad</script>',
        arbitrary: "bad",
      },
    ],
  })[0];
  assert.equal(restored.style.duration, undefined);
  assert.equal(restored.style.bgColor1, defaults.bgColor1);
  assert.equal(restored.processedImage, "");
  assert.equal(restored.arbitrary, undefined);
});
