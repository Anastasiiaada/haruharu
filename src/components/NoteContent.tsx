import {useMemo} from 'react';
import DOMPurify from 'dompurify';
import './note-content.css';

const tones = ['idea', 'formula', 'examples', 'important', 'comparison'] as const;
type Tone = typeof tones[number];
const legacyTones: Record<string, Tone> = {
  '248,220,231':'idea',       // #f8dce7
  '252,235,244':'idea',       // #fcebf4
  '229,217,247':'formula',    // #e5d9f7
  '238,231,252':'formula',    // #eee7fc
  '247,239,255':'formula',    // #f7efff
  '249,245,255':'formula',    // #f9f5ff
  '230,244,241':'examples',   // #e6f4f1
  '236,247,241':'examples',   // #ecf7f1
  '220,235,221':'examples',   // #dcebdd
  '255,240,245':'important',  // #fff0f5
  '255,241,221':'important',  // #fff1dd
  '249,228,209':'important',  // #f9e4d1
};
const layoutStyles = new Set([
  'border-radius', 'line-height', 'width', 'max-width', 'min-width', 'height', 'text-align', 'vertical-align',
]);
const headingSelector = 'h1,h2,h3,h4,h5,h6';
const blockSelector = 'div,section,aside,blockquote,p,table,td,th,tr';

function headingTone(text: string): Tone | undefined {
  const label = text.trim().toLocaleLowerCase('uk');
  if (/головна ідея|основна ідея/.test(label)) return 'idea';
  if (/формула|швидка схема/.test(label)) return 'formula';
  if (/важливо|винят|зверни увагу|типов.*помил/.test(label)) return 'important';
  if (/порівня|різниця|відмінност/.test(label)) return 'comparison';
  if (/приклад|запитання.*відповідь/.test(label)) return 'examples';
}

function backgroundTone(color: string): Tone | undefined {
  const rgb = color.match(/^rgba?\(\s*(\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)/);
  const hex = color.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
  const channels = rgb?.slice(1).map(Number) ?? hex?.slice(1).map(channel => parseInt(channel, 16));
  if (!channels) return undefined;
  const [r, g, b] = channels;
  return legacyTones[[r,g,b].join(',')] ??
    (b - r > 12 && g > r ? 'comparison' : undefined);
}

function blockTone(element: HTMLElement): Tone | undefined {
  const explicit = element.getAttribute('data-note-tone') ?? element.getAttribute('data-tone');
  const semantic = tones.find(tone => tone === explicit || element.classList.contains(`note-callout--${tone}`));
  if (semantic) return semantic;
  const background = element.style.backgroundColor || element.getAttribute('bgcolor') || '';
  if ((!background && element.tagName !== 'TABLE') || !element.matches(blockSelector)) return undefined;

  const title = element.firstElementChild;
  const own = title?.matches(`${headingSelector},strong,b`) ? headingTone(title.textContent ?? '') : undefined;
  if (own) return own;
  let previous = element.previousElementSibling;
  while (previous && !previous.matches(headingSelector)) previous = previous.previousElementSibling;
  const contextual = previous ? headingTone(previous.textContent ?? '') : undefined;
  if (element.tagName === 'TABLE' && !background) return contextual === 'examples' || contextual === 'comparison' ? contextual : undefined;
  return contextual ?? backgroundTone(background);
}

export function renderNoteHtml(html: string): string {
  const fragment = DOMPurify.sanitize(html, {
    RETURN_DOM_FRAGMENT: true,
    FORBID_TAGS: ['style'],
  });
  for (const element of fragment.querySelectorAll('*')) {
    element.removeAttribute('data-theme');
    if (!(element instanceof HTMLElement)) continue;
    const tone = blockTone(element);
    element.removeAttribute('class');
    element.removeAttribute('data-note-tone');
    element.removeAttribute('data-tone');
    if (tone && element.parentElement?.closest('[data-note-tone]')?.getAttribute('data-note-tone') !== tone) {
      element.setAttribute('data-note-tone', tone);
    }
    for (const attribute of ['color','bgcolor','background','bordercolor','id','name']) element.removeAttribute(attribute);
    for (const property of Array.from(element.style)) {
      if (!layoutStyles.has(property) && !/^(margin|padding)(-|$)/.test(property)) element.style.removeProperty(property);
    }
    if (!element.style.length) element.removeAttribute('style');
  }

  for (const table of fragment.querySelectorAll('table')) {
    const wrapper = document.createElement('div');
    wrapper.className = 'note-table-scroll';
    wrapper.tabIndex = 0;
    wrapper.setAttribute('role', 'region');
    wrapper.setAttribute('aria-label', 'Таблиця конспекту');
    table.replaceWith(wrapper);
    wrapper.append(table);
  }
  const template = document.createElement('template');
  template.content.append(fragment);
  return template.innerHTML;
}

export function NoteContent({html}: {html: string}) {
  const markup = useMemo(() => renderNoteHtml(html), [html]);
  return <div className="note-content" dangerouslySetInnerHTML={{__html:markup}}/>;
}
