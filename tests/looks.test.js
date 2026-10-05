import { test } from "node:test";
import assert from "node:assert/strict";
import { defaults, newItem } from "../src/model.js";
import { cleanStyle } from "../src/looks.js";
test("new sources inherit the visual look while retaining smart removal defaults", () => {
  const look = cleanStyle({
    ...defaults,
    bgColor1: "#123456",
    iconScale: 0.67,
    removeBg: true,
    bgRemoveMode: "auto",
  });
  const item = newItem(
    { name: "new-photo", image: "data:image/png;base64," },
    look,
  );
  assert.equal(item.style.bgColor1, "#123456");
  assert.equal(item.style.iconScale, 0.67);
  assert.equal(item.style.removeBg, false);
  assert.equal(item.style.bgRemoveMode, "smart");
  assert.equal(Object.hasOwn(look, "bgRemoveMode"), false);
});
