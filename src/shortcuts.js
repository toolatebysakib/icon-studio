export const defaultShortcut = {
  key: "f",
  shift: true,
  ctrl: false,
  alt: false,
  meta: false,
};
export function readShortcut() {
  try {
    const saved = JSON.parse(
      localStorage.getItem("icon-studio-search-shortcut"),
    );
    return saved?.key ? saved : defaultShortcut;
  } catch {
    return defaultShortcut;
  }
}
export function captureShortcut(event) {
  const key = event.key.toLowerCase();
  if (
    ["shift", "control", "alt", "meta", "escape", "tab", "enter", " "].includes(
      key,
    )
  )
    return null;
  if (
    !event.shiftKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.metaKey &&
    !/^f\d{1,2}$/.test(key)
  )
    return null;
  return {
    key,
    shift: event.shiftKey,
    ctrl: event.ctrlKey,
    alt: event.altKey,
    meta: event.metaKey,
  };
}
export function matchesShortcut(event, shortcut) {
  return (
    !event.repeat &&
    event.key.toLowerCase() === shortcut.key &&
    event.shiftKey === shortcut.shift &&
    event.ctrlKey === shortcut.ctrl &&
    event.altKey === shortcut.alt &&
    event.metaKey === shortcut.meta
  );
}
export function shortcutLabel(shortcut) {
  return [
    shortcut.ctrl && "Ctrl",
    shortcut.meta && "⌘",
    shortcut.alt && "Alt",
    shortcut.shift && "Shift",
    shortcut.key.toUpperCase(),
  ]
    .filter(Boolean)
    .join("+");
}
