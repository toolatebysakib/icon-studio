import { defaults, safeName } from "./model.js";

const cacheKey = "icon-studio-looks-v1";
export function cleanStyle(value) {
  const style = { ...defaults };
  for (const key of Object.keys(defaults)) {
    const v = value?.[key];
    if (
      typeof v !== typeof defaults[key] ||
      (typeof v === "number" && !Number.isFinite(v))
    )
      continue;
    if (
      /color/i.test(key) &&
      key !== "iconColorMode" &&
      !/^#[\da-f]{6}$/i.test(v)
    )
      continue;
    style[key] = v;
  }
  // Background removal belongs to the source image, not the project's visual identity.
  for (const key of [
    "removeBg",
    "bgTolerance",
    "bgRemoveMode",
    "bgRemoveColor",
    "edgeOnly",
  ])
    delete style[key];
  return style;
}
export function readLooks() {
  try {
    return JSON.parse(localStorage.getItem(cacheKey) || "[]").map((v) => ({
      id: String(v.id),
      name: safeName(v.name),
      style: cleanStyle(v.style),
    }));
  } catch {
    return [];
  }
}
export function writeLooks(looks) {
  localStorage.setItem(cacheKey, JSON.stringify(looks));
}
export function parseLooks(value) {
  if (
    value?.format !== "icon-studio-looks" ||
    !Array.isArray(value.looks) ||
    value.looks.length > 200
  )
    throw new Error("Choose an Icon Studio preset file.");
  return value.looks.map((v) => ({
    id: crypto.randomUUID(),
    name: safeName(v.name || "Untitled look"),
    style: cleanStyle(v.style),
  }));
}
