import {expect, it} from 'vitest';
import {readFileSync} from 'node:fs';

const baseCss = readFileSync(new URL('../game/design-system.css', import.meta.url), 'utf8');
const themeCss = readFileSync(new URL('./theme-contrast.css', import.meta.url), 'utf8');
const noteCss = readFileSync(new URL('./note-content.css', import.meta.url), 'utf8');

function variables(styles, selector) {
  const block = styles.replace(/\s+/g, '').split(selector.replace(/\s+/g, ''))[1]?.split('}')[0] ?? '';
  return Object.fromEntries(Array.from(block.matchAll(/(--[\w-]+)\s*:\s*(#[\da-f]{3,6})\b/gi),
    ([, property, color]) => [property, color]));
}

function luminance(color) {
  const raw = color.slice(1);
  const rgb = raw.length === 3 ? [...raw].map(digit => digit.repeat(2)) : raw.match(/../g);
  const linear = rgb.map(hex => {
    const channel = parseInt(hex, 16) / 255;
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
  });
  return .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
}

function contrast(foreground, background) {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a,b) + .05) / (Math.min(a,b) + .05);
}

it.each(['light', 'dark'])('keeps normal-size text at AA contrast in the %s palette', theme => {
  const light = {...variables(baseCss, ':root{'), ...variables(themeCss, ':root {')};
  const colors = theme === 'dark' ? {...light, ...variables(baseCss, '[data-theme=dark]{'), ...variables(themeCss, '[data-theme="dark"] {')} : light;
  const noteColors = variables(noteCss, theme === 'dark' ? '[data-theme="dark"] .note-content {' : '.note-content {');
  const pairs = [
    ['--selection-text', '--selection-background'],
    ['--control-text', '--control-fill'], ['--control-text', '--control-hover'],
    ['--control-text', '--danger-fill'], ['--control-text', '--danger-hover'],
    ['--control-text', '--success-fill'], ['--control-text', '--success-hover'],
    ['--text', '--surface'], ['--text', '--tinted-surface'], ['--text', '--field-background'],
    ['--error-text', '--surface'], ['--muted', '--surface'], ['--muted', '--field-background'],
    ['--accent', '--surface'], ['--accent', '--tinted-surface'],
  ];
  for (const [text, background] of pairs) {
    expect(colors[text], text).toBeDefined();
    expect(colors[background], background).toBeDefined();
    expect(contrast(colors[text], colors[background]), `${text} on ${background}`).toBeGreaterThanOrEqual(4.5);
  }
  for (const tone of ['idea', 'formula', 'examples', 'important', 'comparison']) {
    expect(contrast(colors['--text'], noteColors[`--note-${tone}`]), tone).toBeGreaterThanOrEqual(4.5);
  }
});
