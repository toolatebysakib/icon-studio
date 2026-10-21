// gettext 风格 i18n：以英文原文作为 key，未翻译时原样回退显示英文。
import zhCN from "./locales/zh-CN.js";

const DICTS = { en: {}, "zh-CN": zhCN };
const STORAGE_KEY = "icon-studio-lang";

function detect() {
  try {
    const saved = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (saved && DICTS[saved]) return saved;
  } catch {}
  try {
    const nav = globalThis.navigator;
    if (nav?.language && nav.language.toLowerCase().startsWith("zh")) return "zh-CN";
  } catch {}
  return "en";
}

let lang = detect();
const listeners = new Set();

export function getLang() {
  return lang;
}

export function setLang(next) {
  if (!DICTS[next] || next === lang) return;
  lang = next;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, next);
  } catch {}
  listeners.forEach((listener) => listener());
}

export function onLangChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function t(key, params) {
  const dict = DICTS[lang] || {};
  let out = Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : key;
  if (params)
    out = out.replace(/\{(\w+)\}/g, (match, name) =>
      params[name] !== undefined ? params[name] : match,
    );
  return out;
}
