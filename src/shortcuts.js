export const shortcutPresets = [
  { id: 'shift-space', label: 'Shift+Space', key: 'space', shift: true },
  { id: 'ctrl-space', label: 'Ctrl+Space', key: 'space', ctrl: true },
  { id: 'alt-space', label: 'Alt+Space', key: 'space', alt: true },
  { id: 'ctrl-shift-space', label: 'Ctrl+Shift+Space', key: 'space', ctrl: true, shift: true },
  { id: 'ctrl-alt-space', label: 'Ctrl+Alt+Space', key: 'space', ctrl: true, alt: true },
].map(({ id, label, ...keys }) => ({ id, label, shortcut: { shift: false, ctrl: false, alt: false, meta: false, ...keys, code: 'Space', version: 2 } }));
export const defaultShortcut = shortcutPresets[0].shortcut;
const normalizeKey = (key = '') => [' ', 'Space', 'Spacebar', 'space'].includes(key) ? 'space' : key.toLowerCase();
export function readShortcut() {
  try {
    const saved = JSON.parse(localStorage.getItem('icon-studio-search-shortcut'));
    if (!saved?.key) return defaultShortcut;
    // The old default was saved automatically for every user. Migrate it once.
    if (!saved.version && saved.key === 'f' && saved.shift && !saved.ctrl && !saved.alt && !saved.meta) return defaultShortcut;
    return { ...saved, key: normalizeKey(saved.key) };
  } catch { return defaultShortcut; }
}
export function captureShortcut(event) {
  const key = normalizeKey(event.key);
  if (event.repeat || ['shift', 'control', 'alt', 'meta', 'escape', 'tab', 'enter', 'dead', 'unidentified'].includes(key)) return null;
  if (!event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey && !/^f\d{1,2}$/.test(key)) return null;
  return { key, ...(event.code ? { code: event.code } : {}), shift: !!event.shiftKey, ctrl: !!event.ctrlKey, alt: !!event.altKey, meta: !!event.metaKey, version: 2 };
}
export function matchesShortcut(event, shortcut) {
  const sameKey = shortcut.code && event.code ? event.code === shortcut.code : normalizeKey(event.key) === normalizeKey(shortcut.key);
  return !event.repeat && sameKey && !!event.shiftKey === !!shortcut.shift && !!event.ctrlKey === !!shortcut.ctrl && !!event.altKey === !!shortcut.alt && !!event.metaKey === !!shortcut.meta;
}
export function shortcutLabel(shortcut) {
  return [shortcut.ctrl && 'Ctrl', shortcut.meta && '⌘', shortcut.alt && 'Alt', shortcut.shift && 'Shift', normalizeKey(shortcut.key) === 'space' ? 'Space' : shortcut.key.toUpperCase()].filter(Boolean).join('+');
}
