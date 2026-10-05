export const defaults = {
  bgType: "gradient",
  bgColor1: "#a897f5",
  bgColor2: "#6664df",
  bgAngle: 145,
  borderRadius: 22.5,
  iconScale: 0.48,
  iconRotation: 0,
  offsetX: 0,
  offsetY: 0,
  enableShadow: true,
  enableInnerLight: true,
  enableBevel: false,
  enableClassicSweep: false,
  enableGlyphShadow: false,
  enableGlow: false,
  enableOutline: false,
  enableGrain: false,
  enableVignette: false,
  enableAmbientLight: false,
  enableMonochrome: false,
  effectColor: "#ffffff",
  outlineWidth: 8,
  glowStrength: 30,
  grainAmount: 8,
  shadowStrength: 22,
  glyphOpacity: 100,
  iconColorMode: "original",
  iconColor1: "#ffffff",
  iconColor2: "#a6c8ff",
  iconAngle: 135,
  removeBg: false,
  bgTolerance: 40,
  bgRemoveMode: "smart",
  bgRemoveColor: "#ffffff",
  edgeOnly: true,
};
export const presets = [
  { name: "Iris", colors: ["#a897f5", "#6664df"] },
  { name: "Ocean", colors: ["#64c9f8", "#1976e7"] },
  { name: "Mint", colors: ["#6ce0bd", "#20a17b"] },
  { name: "Sunset", colors: ["#ffb88a", "#ee6b85"] },
  { name: "Messages", colors: ["#63e77b", "#25ad45"] },
  { name: "Mail", colors: ["#47a2f6", "#2770df"] },
  { name: "Music", colors: ["#fb5c74", "#fa233b"] },
  { name: "Podcasts", colors: ["#d65cf3", "#8e28d7"] },
  { name: "Notes", colors: ["#fcd116", "#f8b600"] },
  { name: "Health", colors: ["#fd475d", "#e11132"] },
  { name: "Weather", colors: ["#5ac8fa", "#0a84ff"] },
  { name: "Graphite", colors: ["#555560", "#22222a"] },
  { name: "Settings", colors: ["#8e8e93", "#636366"] },
  { name: "Dark", colors: ["#2c2c2e", "#1c1c1e"] },
];
export function safeName(value) {
  let name = String(value)
    .normalize("NFC")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
    .replace(/[. ]+$/g, "")
    .trim()
    .slice(0, 120);
  if (!name) name = "untitled";
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))
    name = "_" + name;
  return name;
}
export function uniqueNames(names, occupied = []) {
  const used = new Set(occupied.map((n) => n.toLowerCase()));
  return names.map((value) => {
    const base = safeName(value);
    let name = base,
      n = 2;
    while (used.has(name.toLowerCase())) name = `${base}-${n++}`;
    used.add(name.toLowerCase());
    return name;
  });
}
export function transformCase(name, mode) {
  const words = name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[\s_-]+/)
    .filter(Boolean);
  switch (mode) {
    case "lower":
      return name.toLowerCase();
    case "upper":
      return name.toUpperCase();
    case "kebab":
      return words.map((w) => w.toLowerCase()).join("-");
    case "snake":
      return words.map((w) => w.toLowerCase()).join("_");
    case "camel":
      return words
        .map((w, i) =>
          i ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase(),
        )
        .join("");
    case "title":
      return words
        .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
    default:
      return name;
  }
}
export function renamePreview(
  items,
  selected,
  rule,
  date = new Date().toLocaleDateString("en-CA"),
) {
  const chosen = items.filter((i) => selected.includes(i.id));
  let regex = null;
  if (rule.find && rule.regex)
    regex = new RegExp(rule.find, rule.caseSensitive ? "g" : "gi");
  const proposed = chosen.map((item, i) => {
    let name = item.name;
    if (rule.find)
      name = regex
        ? name.replace(regex, rule.replace || "")
        : name.split(rule.find).join(rule.replace || "");
    name = transformCase(name, rule.case || "keep");
    const index = String((Number(rule.start) || 1) + i).padStart(
      Number(rule.padding) || 0,
      "0",
    );
    const template = rule.template || "{name}";
    name = template.replace(/\{(name|original|n|index|date)\}/g, (_, token) =>
      token === "name"
        ? name
        : token === "original"
          ? item.originalName
          : token === "date"
            ? date
            : index,
    );
    return (rule.prefix || "") + name + (rule.suffix || "");
  });
  const final = uniqueNames(
    proposed,
    items.filter((i) => !selected.includes(i.id)).map((i) => i.name),
  );
  return chosen.map((item, i) => ({
    id: item.id,
    before: item.name,
    after: final[i],
    adjusted: final[i] !== proposed[i],
  }));
}
export function newItem(
  { name, svg = "", image = "", source = "Imported", animated = false },
  style = defaults,
) {
  const base = safeName(name.replace(/\.(svg|png|jpe?g|webp|gif|avif)$/i, ""));
  return {
    id: crypto.randomUUID(),
    name: base,
    originalName: base,
    svg,
    image,
    source,
    animated,
    style: { ...defaults, ...style },
  };
}
export function validateProject(value) {
  if (
    value?.version !== 2 ||
    !Array.isArray(value.items) ||
    value.items.length > 200
  )
    throw new Error("Choose an Icon Studio project with up to 200 icons.");
  const ids = new Set();
  return value.items.map((item) => {
    if (
      !item ||
      typeof item.name !== "string" ||
      typeof item.svg !== "string" ||
      typeof item.image !== "string" ||
      (!item.svg && !item.image)
    )
      throw new Error("This project contains an invalid icon.");
    if (
      item.image &&
      !/^data:image\/(png|jpeg|webp|gif|avif);base64,/i.test(item.image)
    )
      throw new Error("Project images must be embedded image files.");
    const id =
      typeof item.id === "string" && !ids.has(item.id)
        ? item.id
        : crypto.randomUUID();
    ids.add(id);
    const style = { ...defaults };
    for (const key of Object.keys(defaults)) {
      const val = item.style?.[key];
      if (typeof val !== typeof defaults[key]) continue;
      if (typeof val === "number" && !Number.isFinite(val)) continue;
      if (
        key.toLowerCase().includes("color") &&
        key !== "iconColorMode" &&
        !/^#[\da-f]{6}$/i.test(val)
      )
        continue;
      style[key] = val;
    }
    style.iconScale = Math.max(0.05, Math.min(1.5, style.iconScale));
    style.borderRadius = Math.max(0, Math.min(50, style.borderRadius));
    if (!["original", "solid", "gradient"].includes(style.iconColorMode))
      style.iconColorMode = "original";
    if (!["solid", "gradient", "transparent"].includes(style.bgType))
      style.bgType = "gradient";
    if (
      !["smart", "auto", "white", "black", "custom"].includes(
        style.bgRemoveMode,
      )
    )
      style.bgRemoveMode = "smart";
    const processedImage =
      typeof item.processedImage === "string" &&
      /^data:image\/png;base64,/i.test(item.processedImage)
        ? item.processedImage
        : "";
    return {
      id,
      name: safeName(item.name),
      originalName: safeName(item.originalName || item.name),
      svg: item.svg,
      image: item.image,
      source: typeof item.source === "string" ? item.source : "Imported",
      animated: !!item.animated,
      style,
      processedImage,
      processedKey:
        processedImage && typeof item.processedKey === "string"
          ? item.processedKey
          : "",
    };
  });
}
