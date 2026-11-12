// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import {afterAll,afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {LazyMotion,domMax,MotionConfig} from 'motion/react';
import {Dictionary} from './Dictionary';
import {db} from '../services/db';
import type {Word} from '../models';

let root:Root;
let host:HTMLDivElement;
const base:Word = {id:'apple',korean:'사과',translation:'Яблуко',category:'Їжа',example:'사과를 먹어요.',learned:false,due:0,interval:0,demo:false};

async function ready(check:()=>void) {
  await vi.waitFor(async()=>{await act(async()=>{await new Promise(resolve=>setTimeout(resolve,20));});check();});
}
async function click(button:Element|null) {
  expect(button).not.toBeNull();
  await act(async()=>{(button as HTMLElement).click();});
}
function button(label:string) {
  return [...document.querySelectorAll('button')].find(element=>element.textContent===label||element.getAttribute('aria-label')===label)||null;
}
async function mount() {
  root = createRoot(host);
  await act(async()=>{root.render(<LazyMotion features={domMax}><MotionConfig reducedMotion="always"><Dictionary/></MotionConfig></LazyMotion>);});
  await ready(()=>expect(button('Відкрити 사과')).not.toBeNull());
}

beforeEach(async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  vi.stubGlobal('matchMedia',()=>({matches:true,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}}));
  vi.stubGlobal('confirm',()=>true);
  await db.transaction('rw',db.tables,async()=>{for(const table of db.tables)await table.clear();});
  await db.words.bulkAdd([base,{...base,id:'school',korean:'학교',translation:'Школа',category:'Місця',learned:true}]);
  host = document.createElement('div');
  document.body.append(host);
  await mount();
});
afterEach(async()=>{
  await act(async()=>root.unmount());
  host.remove();
  expect(document.body.style.overflow).toBe('');
  vi.unstubAllGlobals();
});
afterAll(async()=>db.close());

describe('dictionary views and details',()=>{
  it('uses the same search in all views and keeps speech controls separate from opening details',async()=>{
    for (const view of ['Картки','Список','Таблиця']) {
      await click(button(view));
      await ready(()=>expect(button(view)?.getAttribute('aria-pressed')).toBe('true'));
      const input = document.querySelector<HTMLInputElement>('[aria-label="Пошук слів"]')!;
      await act(async()=>{
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'школ');
        input.dispatchEvent(new Event('input',{bubbles:true}));
      });
      await ready(()=>expect(document.querySelectorAll('.word-open,.word-table-open')).toHaveLength(1));
      expect(document.querySelector('.word-open,.word-table-open')?.textContent).toContain('학교');
      if(view==='Таблиця') {
        await click(document.querySelector('.word-table-open'));
        await ready(()=>expect(document.querySelector('.dictionary-detail')).not.toBeNull());
        await click(button('Озвучити корейський текст'));
        expect(document.querySelector('.dictionary-detail')).not.toBeNull();
        await click(button('Закрити вікно'));
        await ready(()=>expect(document.querySelector('[role="dialog"]')).toBeNull());
      } else {
        await click(button('Озвучити корейський текст'));
        expect(document.querySelector('[role="dialog"]')).toBeNull();
      }
      await act(async()=>{
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'');
        input.dispatchEvent(new Event('input',{bubbles:true}));
      });
      await ready(()=>expect(document.querySelectorAll('.word-open,.word-table-open')).toHaveLength(2));
    }
  });

  it('persists the selected view and sorts the table by learning status',async()=>{
    await click(button('Таблиця'));
    await ready(()=>expect(document.querySelector('table')).not.toBeNull());
    expect((await db.settings.get('dictionaryView'))?.value).toBe('table');
    await click(button('Статус вивчення'));
    expect(document.querySelector('tbody tr')?.textContent).toContain('사과');
    await click(button('Статус вивчення'));
    expect(document.querySelector('tbody tr')?.textContent).toContain('학교');
    await act(async()=>root.unmount());
    root = createRoot(host);
    await act(async()=>root.render(<Dictionary/>));
    await ready(()=>expect(document.querySelector('table')).not.toBeNull());
  });

  it('opens list details, closes with Escape and restores scrolling',async()=>{
    await click(button('Список'));
    await ready(()=>expect(document.querySelector('.dictionary-list')).not.toBeNull());
    const trigger = button('Відкрити 사과') as HTMLElement;
    trigger.focus();
    await click(trigger);
    await ready(()=>expect(document.querySelector('[role="dialog"]')).not.toBeNull());
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('사과를 먹어요.');
    await act(async()=>{document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));});
    await ready(()=>expect(document.querySelector('[role="dialog"]')).toBeNull());
    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(trigger);
  });

  it('opens editing from word details and saves the word',async()=>{
    expect(button('Редагувати 사과')).toBeNull();
    await click(button('Відкрити 사과'));
    await ready(()=>expect(document.querySelector('.dictionary-detail')).not.toBeNull());
    await click(button('Редагувати 사과'));
    await ready(()=>expect(document.querySelector('.dictionary-edit')).not.toBeNull());
    await ready(()=>expect(document.querySelector('.dictionary-detail')).toBeNull());
    const input = document.querySelector<HTMLInputElement>('.dictionary-edit input')!;
    await act(async()=>{
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'배');
      input.dispatchEvent(new Event('input',{bubbles:true}));
    });
    await click(button('Зберегти'));
    await ready(()=>expect(document.querySelector('.dictionary-edit')).toBeNull());
    expect((await db.words.get('apple'))?.korean).toBe('배');
    expect((await db.words.get('apple'))?.due).toBe(0);
  });

  it('closes details by backdrop without leaving a scroll lock',async()=>{
    await click(button('Відкрити 사과'));
    await ready(()=>expect(document.querySelector('.dictionary-detail')).not.toBeNull());
    await act(async()=>{document.querySelector('.experience-overlay')!.dispatchEvent(new Event('pointerdown',{bubbles:true}));});
    await ready(()=>expect(document.querySelector('[role="dialog"]')).toBeNull());
    expect(document.body.style.overflow).toBe('');
  });
});
