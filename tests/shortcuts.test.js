import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultShortcut, shortcutPresets, captureShortcut, matchesShortcut, shortcutLabel, readShortcut } from '../src/shortcuts.js';
const key = (value, extra = {}) => ({key:value, repeat:false, shiftKey:false, ctrlKey:false, altKey:false, metaKey:false, ...extra});
test('all five space presets match exact modifiers and reject repeats', () => {
  assert.equal(shortcutLabel(defaultShortcut), 'Shift+Space');
  for (const {shortcut} of shortcutPresets) {
    const event = key(' ', {code:'Space', shiftKey:shortcut.shift, ctrlKey:shortcut.ctrl, altKey:shortcut.alt});
    assert.equal(matchesShortcut(event, shortcut), true);
    assert.equal(matchesShortcut({...event, repeat:true}, shortcut), false);
    assert.equal(matchesShortcut({...event, metaKey:true}, shortcut), false);
    assert.equal(matchesShortcut({...event, shiftKey:!event.shiftKey}, shortcut), false);
    assert.equal(shortcutLabel(captureShortcut(event)), shortcutLabel(shortcut));
  }
});
test('manual assignment accepts space, shifted keys and function keys', () => {
  const shortcut = captureShortcut(key('@', {code:'Digit2', ctrlKey:true, shiftKey:true}));
  assert.equal(matchesShortcut(key('2', {code:'Digit2', ctrlKey:true, shiftKey:true}), shortcut), true);
  assert.equal(shortcutLabel(captureShortcut(key('K', {ctrlKey:true,altKey:true}))), 'Ctrl+Alt+K');
  assert.equal(captureShortcut(key('Shift', {shiftKey:true})), null);
  assert.equal(captureShortcut(key('x')), null);
  assert.equal(captureShortcut(key('Escape')), null);
  assert.equal(captureShortcut(key('k', {ctrlKey:true,repeat:true})), null);
  assert.equal(matchesShortcut(key('F8'), captureShortcut(key('F8'))), true);
});
test('old automatic default migrates while deliberate custom assignments persist', () => {
  let saved = {key:'f',shift:true,ctrl:false,alt:false,meta:false};
  globalThis.localStorage = {getItem: () => JSON.stringify(saved)};
  assert.equal(shortcutLabel(readShortcut()), 'Shift+Space');
  saved = {...saved,version:2};
  assert.equal(shortcutLabel(readShortcut()), 'Shift+F');
  saved = {key:'k',ctrl:true};
  assert.equal(shortcutLabel(readShortcut()), 'Ctrl+K');
  assert.equal(matchesShortcut(key('k',{ctrlKey:true}),readShortcut()),true);
  delete globalThis.localStorage;
});
