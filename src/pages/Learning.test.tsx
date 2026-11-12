// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import {afterAll,afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import {LazyMotion,domMax,MotionConfig} from 'motion/react';
import {Cards,Session} from './Learning';
import {db} from '../services/db';
import type {Word} from '../models';

let root:Root;
let host:HTMLDivElement;
const word:Word={id:'apple',korean:'사과',translation:'Яблуко',category:'Їжа',example:'사과를 먹어요.',learned:false,due:0,interval:0,demo:false};
async function ready(check:()=>void){await vi.waitFor(async()=>{await act(async()=>{await new Promise(resolve=>setTimeout(resolve,25));});check();});}
function button(label:string){return [...host.querySelectorAll('button')].find(element=>element.getAttribute('aria-label')===label||element.textContent?.startsWith(label));}
async function click(label:string){expect(button(label)).toBeTruthy();await act(async()=>button(label)!.click());}

beforeEach(async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
  vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});
  vi.stubGlobal('matchMedia',()=>({matches:true,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}}));
  await db.transaction('rw',db.tables,async()=>{for(const table of db.tables)await table.clear();});
  host=document.createElement('div');document.body.append(host);root=createRoot(host);
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});
afterAll(()=>db.close());

describe('compact learning screens',()=>{
  it('keeps all four rating buttons in the footer and saves a rating after flipping',async()=>{
    await db.words.bulkAdd([word,{...word,id:'school',korean:'학교'}]);
    await act(async()=>root.render(<MemoryRouter><LazyMotion features={domMax}><MotionConfig reducedMotion="always"><Cards/></MotionConfig></LazyMotion></MemoryRouter>));
    await ready(()=>expect(host.querySelectorAll('.learning-actions .memory-ratings button')).toHaveLength(4));
    expect([...host.querySelectorAll<HTMLButtonElement>('.memory-ratings button')].every(element=>element.disabled)).toBe(true);
    await click('Показати відповідь');
    expect([...host.querySelectorAll<HTMLButtonElement>('.memory-ratings button')].every(element=>!element.disabled)).toBe(true);
    await click('Пам’ятаю');
    await ready(()=>expect(host.querySelector('.learning-topline h1')?.textContent).toContain('2/2'));
    expect(await db.rewards.filter(reward=>reward.kind==='review').count()).toBe(1);
    expect((await db.words.get('apple'))?.due).toBeGreaterThan(0);
    expect(host.querySelectorAll('.memory-ratings button')).toHaveLength(4);
  });

  it('keeps a question, feedback and result in the learning screen through normal entry points',async()=>{
    await act(async()=>root.render(<LazyMotion features={domMax}><MotionConfig reducedMotion="always"><Session exam questions={[{id:'q',kind:'choice',topic:'Їжа',prompt:'Яблуко',answer:'사과',options:['사과','배'],explanation:'사과 — яблуко.',demo:false}]} onFinish={()=>{}}/></MotionConfig></LazyMotion>));
    expect(host.querySelector('.question-form>.question-body')).not.toBeNull();
    const option=[...host.querySelectorAll<HTMLButtonElement>('.options button')].find(element=>element.textContent?.includes('사과'))!;
    await act(async()=>option.click());
    await click('Перевірити');
    await ready(()=>expect(host.querySelector('.feedback-body')).not.toBeNull());
    expect(host.querySelector('.answer-feedback>.feedback-next')).not.toBeNull();
    await click('Завершити');
    await ready(()=>expect(host.querySelector('.result-screen')).not.toBeNull());
    expect(host.querySelector('.result-metrics')?.textContent).toContain('1/1');
    expect(await db.attempts.count()).toBe(1);
    expect(await db.exams.count()).toBe(1);
  });
});
