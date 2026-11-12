// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import type {Editor as TiptapEditor} from '@tiptap/react';
import {Editor} from './Editor';

let root:Root;
let host:HTMLDivElement;
let editor:TiptapEditor;
const onChange = vi.fn();

beforeEach(async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  vi.spyOn(window,'scrollBy').mockImplementation(()=>{});
  // jsdom supplies document editing but has no layout implementation for Range.
  Object.defineProperties(Range.prototype,{
    getClientRects:{configurable:true,value:()=>[new DOMRect(0,0,10,20)]},
    getBoundingClientRect:{configurable:true,value:()=>new DOMRect(0,0,10,20)},
  });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async()=>{root.render(<Editor content="" onChange={onChange}/>);});
  editor = (host.querySelector('.tiptap') as HTMLElement&{editor:TiptapEditor}).editor;
  onChange.mockClear();
});
afterEach(async()=>{
  await act(async()=>root.unmount());
  host.remove();
  Reflect.deleteProperty(Range.prototype,'getClientRects');
  Reflect.deleteProperty(Range.prototype,'getBoundingClientRect');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function click(label:string) {
  const button = [...host.querySelectorAll('button')].find(element=>element.getAttribute('aria-label')===label||element.textContent===label)!;
  expect(button).toBeTruthy();
  await act(async()=>button.click());
}

describe('note editor interactions',()=>{
  it('keeps the hint out of HTML and restores it when the document is cleared',async()=>{
    expect(host.querySelector('[data-placeholder]')).not.toBeNull();
    expect(editor.getHTML()).toBe('<p></p>');
    expect(onChange).not.toHaveBeenCalled();
    await act(async()=>{editor.commands.insertContent('한국어');});
    expect(host.querySelector('[data-placeholder]')).toBeNull();
    expect(editor.getHTML()).toContain('한국어');
    await act(async()=>{editor.commands.clearContent();});
    expect(host.querySelector('[data-placeholder]')).not.toBeNull();
    expect(editor.getHTML()).not.toContain('Почніть писати');
  });

  it('formats only the selection and supports undo and redo through the toolbar',async()=>{
    await act(async()=>{
      editor.commands.setContent('<p>한국어 공부</p>');
      editor.commands.setTextSelection({from:1,to:4});
    });
    await click('Жирний');
    expect(editor.getHTML()).toBe('<p><strong>한국어</strong> 공부</p>');
    expect(editor.state.selection.from).toBe(1);
    expect(editor.state.selection.to).toBe(4);
    await click('Додаткові інструменти');
    await click('Скасувати дію');
    expect(editor.getHTML()).toBe('<p>한국어 공부</p>');
    await click('Додаткові інструменти');
    await click('Повторити дію');
    expect(editor.getHTML()).toBe('<p><strong>한국어</strong> 공부</p>');
  });

  it('enables table commands only inside a table and preserves its structure',async()=>{
    await click('Додаткові інструменти');
    const rowButton = [...host.querySelectorAll('button')].find(button=>button.textContent==='Додати рядок')!;
    expect(rowButton.disabled).toBe(true);
    await click('Додаткові інструменти');
    await click('Вставити таблицю');
    expect(host.querySelectorAll('.tiptap tr')).toHaveLength(3);
    await click('Додаткові інструменти');
    await click('Додати рядок');
    expect(host.querySelectorAll('.tiptap tr')).toHaveLength(4);
    await click('Додаткові інструменти');
    await click('Додати стовпець');
    expect(host.querySelector('.tiptap tr')?.children).toHaveLength(3);
    expect(editor.getHTML()).toContain('<table');
  });
});
