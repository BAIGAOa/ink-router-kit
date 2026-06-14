import type { Key } from 'ink';

/**
 * Convert an Ink `(input, key)` event into a list of possible key-name
 * strings for matching.
 *
 * For special keys (return, escape, arrows, etc.) it produces the base
 * name plus any modifier-prefixed variants.  For character keys it
 * produces the raw character and modifier combinations.
 *
 * Examples:
 *   press('s', { ctrl: true })              →  ["s", "ctrl+s"]
 *   press('',  { escape: true })            →  ["escape"]
 *   press('',  { return: true, shift: true }) → ["return", "shift+return"]
 *
 * @param input - Raw character string from Ink's useInput (empty for special keys).
 * @param key   - Full Key descriptor from Ink.
 * @returns An ordered array of key-name strings; first match wins in the pipeline.
 */
export function normalizeKeyNames(input: string, key: Key): string[] {
  const names: string[] = [];

  const specialMap: Array<[keyof Key, string]> = [
    ['return', 'return'],
    ['escape', 'escape'],
    ['backspace', 'backspace'],
    ['delete', 'delete'],
    ['upArrow', 'up'],
    ['downArrow', 'down'],
    ['leftArrow', 'left'],
    ['rightArrow', 'right'],
    ['tab', 'tab'],
    ['pageDown', 'pagedown'],
    ['pageUp', 'pageup'],
    ['home', 'home'],
    ['end', 'end'],
  ];

  for (const [kProp, kName] of specialMap) {
    if (key[kProp]) {
      names.push(kName);
      if (key.ctrl) names.push(`ctrl+${kName}`);
      if (key.shift) names.push(`shift+${kName}`);
      if (key.meta) names.push(`meta+${kName}`);
      if (key.ctrl && key.shift) names.push(`ctrl+shift+${kName}`);
      return names;
    }
  }

  if (input) {
    names.push(input);
    if (key.ctrl) names.push(`ctrl+${input}`);
    if (key.shift) names.push(`shift+${input}`);
    if (key.meta) names.push(`meta+${input}`);
    if (key.ctrl && key.shift) names.push(`ctrl+shift+${input}`);
  }

  return names;
}

/**
 * Determine whether the Ink key event represents a "normal" character.
 *
 * Only input with actual character content is eligible, and all special
 * keys (arrows, return, escape, tab, backspace, delete, pageup, pagedown,
 * home, end), modifier keys (ctrl, meta, super, hyper), and release events
 * are excluded.
 *
 * This function drives the wildcard `"*"` binding — only normal characters
 * are ever matched by the wildcard.
 *
 * @param input - Raw character from Ink's useInput.
 * @param key   - Full Key descriptor from Ink.
 * @returns true when the event should be treated as a normal character.
 *
 * @2026-06-14 v3.4.0
 */
export function isNormalCharacter(input: string, key: Key): boolean {
  if (!input) return false;

  if (key.upArrow) return false;
  if (key.downArrow) return false;
  if (key.leftArrow) return false;
  if (key.rightArrow) return false;

  if (key.pageDown) return false;
  if (key.pageUp) return false;

  if (key.home) return false;
  if (key.end) return false;

  if (key.return) return false;
  if (key.escape) return false;
  if (key.tab) return false;
  if (key.backspace) return false;
  if (key.delete) return false;

  if (key.ctrl) return false;
  if (key.meta) return false;
  if (key.super) return false;
  if (key.hyper) return false;

  if (key.eventType === 'release') return false;

  return true;
}
