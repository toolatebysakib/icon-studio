import { backend, library } from "./library";
import { defaults } from "./model";
const NS = "http://www.w3.org/2000/svg";
const cache = new Map();
export const dataSvg = (svg) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
export function sanitizeSvg(text) {
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const root = doc.documentElement;
  if (root.localName !== "svg" || doc.querySelector("parsererror"))
    throw new Error("This SVG could not be read.");
  root
    .querySelectorAll(
      "script,style,set,animate,animateTransform,animateMotion,foreignObject,iframe,object,embed,audio,video",
    )
    .forEach((e) => e.remove());
  for (const el of [root, ...root.querySelectorAll("*")])
    for (const attr of [...el.attributes]) {
      const key = attr.name.toLowerCase();
      if (key.startsWith("on") || key === "xml:base")
        el.removeAttribute(attr.name);
      if (
        (key === "href" || key === "xlink:href") &&
        !attr.value.startsWith("#") &&
        !/^data:image\/(png|jpeg|webp);base64,/i.test(attr.value)
      )
        el.removeAttribute(attr.name);
      if (
        (key === "style" ||
          key === "fill" ||
          key === "stroke" ||
          key === "filter") &&
        /javascript:|@import|url\(\s*['"]?(?!#)/i.test(attr.value)
      )
        el.removeAttribute(attr.name);
      if (
        el.localName.startsWith("animate") &&
        (![
          "d",
          "opacity",
          "stroke-dasharray",
          "stroke-dashoffset",
          "transform",
          "fill",
          "stroke",
          "fill-opacity",
          "stroke-opacity",
          "stroke-width",
          "r",
          "cx",
          "cy",
          "x",
          "y",
          "width",
          "height",
        ].includes(el.getAttribute("attributeName")) ||
          /javascript:|url\(\s*['"]?(?!#)/i.test(attr.value))
      )
        el.remove();
    }
  for (const el of [root, ...root.querySelectorAll("[style]")]) {
    const style = el.getAttribute("style");
    if (!style) continue;
    for (const declaration of style.split(";")) {
      const [key, ...parts] = declaration.split(":");
      const value = parts.join(":").trim();
      if (
        [
          "fill",
          "stroke",
          "opacity",
          "fill-opacity",
          "stroke-opacity",
          "stroke-width",
          "stroke-linecap",
          "stroke-linejoin",
          "fill-rule",
          "clip-rule",
        ].includes(key.trim()) &&
        !/url\(\s*['"]?(?!#)|javascript:/i.test(value)
      )
        el.setAttribute(key.trim(), value);
    }
    el.removeAttribute("style");
  }
  root.setAttribute("xmlns", NS);
  if (!root.hasAttribute("viewBox"))
    root.setAttribute(
      "viewBox",
      `0 0 ${parseFloat(root.getAttribute("width")) || 24} ${parseFloat(root.getAttribute("height")) || 24}`,
    );
  root.removeAttribute("width");
  root.removeAttribute("height");
  root.setAttribute("color", "#ffffff");
  if (!root.hasAttribute("fill") && !root.hasAttribute("stroke"))
    root.setAttribute("fill", "currentColor");
  return new XMLSerializer().serializeToString(root);
}
export async function getIcon(icon) {
  if (icon.rawSvg) return sanitizeSvg(icon.rawSvg);
  if (cache.has(icon.fullName)) return cache.get(icon.fullName);
  if (window.iconStudioDesktop) {
    const offline = await window.iconStudioDesktop
      .readIcon(icon.fullName)
      .catch(() => null);
    if (offline) return sanitizeSvg(offline);
  }
  const [prefix, name] = icon.fullName.split(":");
  for (const url of [
    `${backend}/api/icon/${encodeURIComponent(prefix)}/${encodeURIComponent(name)}.svg`,
    `https://api.iconify.design/${encodeURIComponent(prefix)}/${encodeURIComponent(name)}.svg`,
  ]) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (r.ok) {
        const svg = sanitizeSvg(await r.text());
        cache.set(icon.fullName, svg);
        return svg;
      }
    } catch {}
  }
  throw new Error(
    "This icon could not be loaded. Try again or choose another.",
  );
}
export async function searchIcons(
  query,
  prefix = "",
  animated = false,
  signal,
  limit = 180,
) {
  const q = query.trim().toLowerCase();
  if (window.iconStudioDesktop) {
    const offline = await window.iconStudioDesktop
      .searchIcons(q, prefix, limit)
      .catch(() => []);
    const settings = await window.iconStudioDesktop
      .settings()
      .catch(() => ({}));
    if (offline.length || settings.libraryCount > 0) return offline;
  }
  let local = library.filter(
    (i) =>
      !i.isAnimated &&
      (!prefix || i.prefix === prefix) &&
      (!q || `${i.title} ${i.name} ${i.category}`.toLowerCase().includes(q)),
  );
  if (
    !q ||
    ["apple", "brands", "ui", "lucide-animated", "useanimations"].includes(
      prefix,
    )
  )
    return local.slice(0, limit);
  try {
    const params = new URLSearchParams({
      query: q,
      limit: String(Math.min(96, limit)),
    });
    if (prefix) params.set("prefix", prefix);
    else if (animated) params.set("prefix", "line-md");
    const r = await fetch(`https://api.iconify.design/search?${params}`, {
      signal,
    });
    if (!r.ok) throw new Error();
    const data = await r.json(),
      ids = new Set(local.map((i) => i.fullName));
    for (const fullName of data.icons || []) {
      if (ids.has(fullName)) continue;
      const [prefix, name] = fullName.split(":");
      if (
        [
          "line-md",
          "svg-spinners",
          "lucide-animated",
          "useanimations",
        ].includes(prefix)
      )
        continue;
      local.push({ fullName, prefix, name, title: name.replace(/[-_]/g, " ") });
    }
    return local.slice(0, limit);
  } catch (e) {
    if (e.name === "AbortError") throw e;
    return local.slice(0, limit);
  }
}
export function buildSvg(
  item,
  { size = 1024, glyphOnly = false, time = null } = {},
) {
  const s = { ...defaults, ...item.style },
    uid = "i" + item.id.replace(/[^\w]/g, "");
  const pad = s.enableShadow && !glyphOnly ? 85 : 0,
    dim = 1024 + pad * 2,
    r = s.borderRadius * 10.24,
    c = pad + 512;
  const grad = (id, a, b, angle) => {
    const rad = ((angle - 90) * Math.PI) / 180,
      dx = Math.cos(rad) * 0.5,
      dy = Math.sin(rad) * 0.5;
    return `<linearGradient id="${uid + id}" x1="${0.5 - dx}" y1="${0.5 - dy}" x2="${0.5 + dx}" y2="${0.5 + dy}"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
  };
  let foreground = "";
  const processed = s.removeBg && item.processedImage;
  if (item.svg && !processed) {
    const doc = new DOMParser().parseFromString(item.svg, "image/svg+xml"),
      root = doc.documentElement;
    const view = root.getAttribute("viewBox") || "0 0 24 24";
    for (const el of [root, ...root.querySelectorAll("*")]) {
      if (el.id) el.id = uid + "src" + el.id;
      for (const attr of [...el.attributes])
        if (/url\(#/.test(attr.value))
          el.setAttribute(
            attr.name,
            attr.value.replace(
              /url\(#([^)]*)\)/g,
              (_, id) => `url(#${uid}src${id})`,
            ),
          );
      if (el.getAttribute("href")?.startsWith("#"))
        el.setAttribute(
          "href",
          "#" + uid + "src" + el.getAttribute("href").slice(1),
        );
      if (s.iconColorMode !== "original") {
        const paint =
          s.iconColorMode === "gradient" ? `url(#${uid}fg)` : s.iconColor1;
        for (const key of ["fill", "stroke"])
          if (
            el.hasAttribute(key) &&
            !["none", "transparent"].includes(el.getAttribute(key))
          )
            el.setAttribute(key, paint);
        el.setAttribute("color", paint);
        el.removeAttribute("style");
      }
    }
    root.setAttribute(
      "color",
      s.iconColorMode === "original"
        ? "#ffffff"
        : s.iconColorMode === "solid"
          ? s.iconColor1
          : `url(#${uid}fg)`,
    );

    root.setAttribute("viewBox", view);
    root.setAttribute("width", "1024");
    root.setAttribute("height", "1024");
    root.setAttribute("x", "-512");
    root.setAttribute("y", "-512");
    root.setAttribute("overflow", "visible");
    foreground = new XMLSerializer().serializeToString(root);
  } else {
    const image = processed || item.image;
    foreground = `<image href="${image}" x="-512" y="-512" width="1024" height="1024" preserveAspectRatio="xMidYMid meet"/>`;
    if (s.iconColorMode !== "original")
      foreground = `<mask id="${uid}mask" mask-type="alpha">${foreground}</mask><rect x="-512" y="-512" width="1024" height="1024" mask="url(#${uid}mask)" fill="${s.iconColorMode === "solid" ? s.iconColor1 : `url(#${uid}fg)`}"/>`;
  }
  const shape = `<rect x="${pad}" y="${pad}" width="1024" height="1024" rx="${r}"`;
  const filterOn =
    s.enableGlyphShadow ||
    s.enableGlow ||
    s.enableOutline ||
    s.enableMonochrome;
  const filter = `<filter id="${uid}glyphFx" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">
    <feColorMatrix in="SourceGraphic" type="saturate" values="${s.enableMonochrome ? 0 : 1}" result="base"/>
    ${s.enableGlyphShadow ? '<feDropShadow in="SourceAlpha" dx="0" dy="18" stdDeviation="14" flood-opacity=".35" result="shadow"/>' : ""}
    ${s.enableGlow ? `<feGaussianBlur in="SourceAlpha" stdDeviation="${s.glowStrength}" result="glowBlur"/><feFlood flood-color="${s.effectColor}" flood-opacity=".8" result="glowColor"/><feComposite in="glowColor" in2="glowBlur" operator="in" result="glow"/>` : ""}
    ${s.enableOutline ? `<feMorphology in="SourceAlpha" operator="dilate" radius="${s.outlineWidth}" result="expanded"/><feFlood flood-color="${s.effectColor}" result="outlineColor"/><feComposite in="outlineColor" in2="expanded" operator="in" result="outline"/>` : ""}
    <feMerge>${s.enableGlyphShadow ? '<feMergeNode in="shadow"/>' : ""}${s.enableGlow ? '<feMergeNode in="glow"/>' : ""}${s.enableOutline ? '<feMergeNode in="outline"/>' : ""}<feMergeNode in="base"/></feMerge></filter>`;
  const glyph = `<g transform="translate(${c + s.offsetX * 10.24} ${c + s.offsetY * 10.24})"><g transform="rotate(${s.iconRotation})"><g transform="scale(${s.iconScale})"><g opacity="${s.glyphOpacity / 100}" ${filterOn ? `filter="url(#${uid}glyphFx)"` : ""}>${foreground}</g></g></g></g>`;
  return `<svg xmlns="${NS}" width="${size}" height="${size}" viewBox="0 0 ${dim} ${dim}"><defs>
  ${grad("bg", s.bgColor1, s.bgColor2, s.bgAngle)}${grad("fg", s.iconColor1, s.iconColor2, s.iconAngle)}
  <clipPath id="${uid}clip">${shape}/></clipPath>
  <filter id="${uid}shadow" x="-25%" y="-25%" width="150%" height="160%"><feDropShadow dx="0" dy="24" stdDeviation="24" flood-opacity="${s.shadowStrength / 100}"/></filter>
  ${filter}
  <linearGradient id="${uid}edge" x2="0" y2="1"><stop stop-color="white" stop-opacity=".65"/><stop offset=".35" stop-color="white" stop-opacity=".08"/><stop offset="1" stop-color="black" stop-opacity=".25"/></linearGradient>
  <linearGradient id="${uid}gloss" x2="0" y2="1"><stop stop-color="white" stop-opacity=".6"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient>
  <radialGradient id="${uid}ambient" cx=".3" cy=".1" r=".9"><stop stop-color="white" stop-opacity=".45"/><stop offset="1" stop-color="white" stop-opacity="0"/></radialGradient>
  <radialGradient id="${uid}vignette" r=".7"><stop offset=".25" stop-color="black" stop-opacity="0"/><stop offset="1" stop-color="black" stop-opacity=".42"/></radialGradient>
  <filter id="${uid}grain"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
  </defs>
  ${!glyphOnly && s.enableShadow && s.bgType !== "transparent" ? `${shape} fill="${s.bgColor1}" filter="url(#${uid}shadow)"/>` : ""}
  <g ${!glyphOnly ? `clip-path="url(#${uid}clip)"` : ""}>
  ${!glyphOnly && s.bgType !== "transparent" ? `${shape} fill="${s.bgType === "gradient" ? `url(#${uid}bg)` : s.bgColor1}"/>` : ""}
  ${!glyphOnly && s.bgType !== "transparent" && s.enableAmbientLight ? `${shape} fill="url(#${uid}ambient)"/>` : ""}
  ${!glyphOnly && s.bgType !== "transparent" && s.enableVignette ? `${shape} fill="url(#${uid}vignette)"/>` : ""}
  ${!glyphOnly && s.bgType !== "transparent" && s.enableGrain ? `${shape} fill="white" filter="url(#${uid}grain)" opacity="${s.grainAmount / 100}"/>` : ""}
  ${glyph}
  ${!glyphOnly && s.enableBevel ? `${shape} fill="none" stroke="url(#${uid}edge)" stroke-width="14"/>` : ""}
  ${!glyphOnly && s.enableInnerLight ? `${shape} fill="none" stroke="url(#${uid}edge)" stroke-width="5"/>` : ""}
  ${!glyphOnly && s.enableClassicSweep ? `<path d="M${pad} ${pad}H${pad + 1024}V${pad + 450}Q${c} ${pad + 580} ${pad} ${pad + 480}Z" fill="url(#${uid}gloss)"/>` : ""}
  </g></svg>`;
}
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image could not be rendered."));
    img.src = src;
  });
}
export async function renderPng(item, opts = {}) {
  const size = opts.size || 1024,
    canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const svg = buildSvg(item, { ...opts, size, time: opts.time ?? 0 });
  const img = await loadImage(dataSvg(svg));
  ctx.drawImage(img, 0, 0, size, size);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("PNG export failed."))),
      "image/png",
    ),
  );
}
export async function download(blob, name) {
  if (window.iconStudioDesktop)
    return window.iconStudioDesktop.saveExport({
      name,
      bytes: await blob.arrayBuffer(),
    });
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 10000);
  return true;
}
export async function removeBackground(item) {
  const src = item.svg ? dataSvg(item.svg) : item.image;
  const img = await loadImage(src);
  if (item.style.bgRemoveMode === "smart" && !item.svg) {
    const { removeSmartBackground } = await import("./smart-background");
    return removeSmartBackground(img);
  }
  const ratio = Math.min(1, 1024 / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * ratio)),
    h = Math.max(1, Math.round(img.height * ratio));
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const pixels = ctx.getImageData(0, 0, w, h),
    d = pixels.data,
    s = item.style;
  let color = s.bgRemoveMode === "black" ? [0, 0, 0] : [255, 255, 255];
  if (s.bgRemoveMode === "custom")
    color = s.bgRemoveColor.match(/\w\w/g).map((x) => parseInt(x, 16));
  if (["auto", "smart"].includes(s.bgRemoveMode)) {
    const samples = new Map();
    for (let x = 0; x < w; x += 3)
      for (const y of [0, h - 1]) {
        const k = (y * w + x) * 4;
        if (d[k + 3] < 128) continue;
        const key = [d[k], d[k + 1], d[k + 2]]
          .map((v) => Math.round(v / 16) * 16)
          .join(",");
        samples.set(key, (samples.get(key) || 0) + 1);
      }
    for (let y = 0; y < h; y += 3)
      for (const x of [0, w - 1]) {
        const k = (y * w + x) * 4;
        if (d[k + 3] < 128) continue;
        const key = [d[k], d[k + 1], d[k + 2]]
          .map((v) => Math.round(v / 16) * 16)
          .join(",");
        samples.set(key, (samples.get(key) || 0) + 1);
      }
    if (samples.size)
      color = [...samples]
        .sort((a, b) => b[1] - a[1])[0][0]
        .split(",")
        .map(Number);
  }
  const seen = new Uint8Array(w * h),
    queue = new Int32Array(w * h);
  let head = 0,
    tail = 0;
  const visit = (index) => {
    if (seen[index]) return;
    seen[index] = 1;
    const k = index * 4,
      dist = Math.hypot(
        d[k] - color[0],
        d[k + 1] - color[1],
        d[k + 2] - color[2],
      );
    if (d[k + 3] < 10 || dist <= s.bgTolerance + 18) {
      queue[tail++] = index;
      d[k + 3] =
        dist <= s.bgTolerance
          ? 0
          : Math.round((d[k + 3] * (dist - s.bgTolerance)) / 18);
    }
  };
  if (s.edgeOnly) {
    for (let x = 0; x < w; x++) {
      visit(x);
      visit((h - 1) * w + x);
    }
    for (let y = 0; y < h; y++) {
      visit(y * w);
      visit(y * w + w - 1);
    }
    while (head < tail) {
      const i = queue[head++],
        x = i % w,
        y = Math.floor(i / w);
      if (x) visit(i - 1);
      if (x < w - 1) visit(i + 1);
      if (y) visit(i - w);
      if (y < h - 1) visit(i + w);
    }
  } else for (let i = 0; i < w * h; i++) visit(i);
  ctx.putImageData(pixels, 0, 0);
  return cv.toDataURL("image/png");
}
