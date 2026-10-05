import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultShortcut,
  captureShortcut,
  matchesShortcut,
  shortcutLabel,
} from "../src/shortcuts.js";
const key = (value, extra = {}) => ({
  key: value,
  repeat: false,
  shiftKey: false,
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  ...extra,
});
test("quick search uses Shift-F and matches modifier keys exactly", () => {
  assert.equal(
    matchesShortcut(key("F", { shiftKey: true }), defaultShortcut),
    true,
  );
  assert.equal(matchesShortcut(key("f"), defaultShortcut), false);
  assert.equal(
    matchesShortcut(
      key("F", { shiftKey: true, ctrlKey: true }),
      defaultShortcut,
    ),
    false,
  );
  assert.equal(
    matchesShortcut(
      key("F", { shiftKey: true, repeat: true }),
      defaultShortcut,
    ),
    false,
  );
});
test("custom shortcuts capture a modified key and ignore modifier-only presses", () => {
  const shortcut = captureShortcut(key("K", { ctrlKey: true, altKey: true }));
  assert.equal(shortcutLabel(shortcut), "Ctrl+Alt+K");
  assert.equal(
    matchesShortcut(key("k", { ctrlKey: true, altKey: true }), shortcut),
    true,
  );
  assert.equal(captureShortcut(key("Shift", { shiftKey: true })), null);
  assert.equal(captureShortcut(key("x")), null);
  assert.equal(captureShortcut(key("Escape")), null);
});
