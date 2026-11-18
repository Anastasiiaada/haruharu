// @vitest-environment jsdom
import {expect, it} from 'vitest';
import {renderNoteHtml} from './NoteContent';
import fullPack from '../content/a1-20261118.json';

function parse(html: string) {
  const template = document.createElement('template');
  template.innerHTML = renderNoteHtml(html);
  return template.content;
}

it('maps legacy callouts and comparison headings without replacing the learning text', () => {
  const html = `<div style="background-color:#fcebf4;color:white;padding:9px"><strong>Головна ідея</strong><p>안녕하세요</p></div>
    <div style="background:#eee7fc"><strong>Формула</strong></div>
    <div style="background:#ecf7f1">Приклад: 사과</div>
    <div style="background:#fff0f5"><ul><li>Виняток</li></ul></div>
    <h3>Порівняй форми</h3><div style="background:#f9f5ff">은 і 는</div>`;
  const clean = parse(html);
  expect(Array.from(clean.querySelectorAll('[data-note-tone]'), node => node.getAttribute('data-note-tone')))
    .toEqual(['idea', 'formula', 'examples', 'important', 'comparison']);
  expect(clean.querySelector('p')?.textContent).toBe('안녕하세요');
  expect(clean.querySelector('div')?.style.padding).toBe('9px');
  expect(clean.querySelector('div')?.style.color).toBe('');
  expect(html).toContain('color:white');
});

it('keeps table structure and semantic blocks and removes unsafe or fixed color declarations', () => {
  const clean = parse(`<section data-note-tone="comparison" class="modal" onclick="alert(1)">
    <table><thead><tr><th style="color: white!important" colspan="2">Форми</th></tr></thead>
    <tbody><tr><td bgcolor="#fff"><strong lang="ko">저는</strong></td>
    <td style="background-image:url(https://example.test/asset);-webkit-text-fill-color:white"><font color="white">я</font></td></tr></tbody></table>
    <script>alert(1)</script></section>`);
  expect(clean.querySelector('.note-table-scroll table th')?.getAttribute('colspan')).toBe('2');
  expect(clean.querySelector('[lang=ko]')?.textContent).toBe('저는');
  expect(clean.querySelector('[data-note-tone=comparison]')?.classList.contains('modal')).toBe(false);
  expect(clean.querySelector('script, [onclick], [style], [bgcolor], [color]')).toBeNull();
});

it('renders all bundled notes with the same text and table cell counts', () => {
  for (const note of fullPack.notes) {
    const original = document.createElement('template');
    original.innerHTML = note.content;
    const rendered = parse(note.content);
    expect(rendered.textContent).toBe(original.content.textContent);
    expect(rendered.querySelectorAll('th,td')).toHaveLength(original.content.querySelectorAll('th,td').length);
    expect(rendered.querySelector('[style*="color:"], [style*="background"]')).toBeNull();
  }
});
