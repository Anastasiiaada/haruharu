// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import {afterAll,afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import {LazyMotion,domMax,MotionConfig} from 'motion/react';
import {Session} from './Learning';
import {Cards} from './Cards';
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
  it('shows the tutorial once and saves a rating with the compact controls',async()=>{
    await db.words.bulkAdd([word,{...word,id:'school',korean:'학교'}]);
    await act(async()=>root.render(<MemoryRouter><LazyMotion features={domMax}><MotionConfig reducedMotion="always"><Cards/></MotionConfig></LazyMotion></MemoryRouter>));
    await ready(()=>expect(document.querySelector('.swipe-tutorial')).not.toBeNull());
    await act(async()=>[...document.querySelectorAll<HTMLButtonElement>('.swipe-tutorial button')].find(element=>element.textContent==='Зрозуміло')!.click());
    await ready(()=>expect(host.querySelectorAll('.learning-actions .memory-ratings button')).toHaveLength(2));
    expect((await db.settings.get('cardSwipeTutorial'))?.value).toBe('yes');
    expect([...host.querySelectorAll<HTMLButtonElement>('.memory-ratings button')].every(element=>element.disabled)).toBe(true);
    await click('Показати відповідь');
    expect([...host.querySelectorAll<HTMLButtonElement>('.memory-ratings button')].every(element=>!element.disabled)).toBe(true);
    await click('Знаю');
    await ready(()=>expect(host.querySelector('.learning-topline h1')?.textContent).toContain('2/2'));
    expect(await db.rewards.filter(reward=>reward.kind==='review').count()).toBe(1);
    expect((await db.words.get('apple'))?.due).toBeGreaterThan(0);
    expect(host.querySelectorAll('.memory-ratings button')).toHaveLength(2);
    await click('Як користуватися картками');
    expect(document.querySelector('.swipe-tutorial')).not.toBeNull();
  });

  it('keeps exam feedback neutral until scoring and saves the result',async()=>{
    await act(async()=>root.render(<LazyMotion features={domMax}><MotionConfig reducedMotion="always"><Session exam questions={[{id:'q',kind:'choice',topic:'Їжа',prompt:'Яблуко',answer:'사과',options:['사과','배'],explanation:'사과 — яблуко.',demo:false}]} onFinish={()=>{}}/></MotionConfig></LazyMotion>));
    expect(host.querySelector('.question-form>.question-body')).not.toBeNull();
    const option=[...host.querySelectorAll<HTMLButtonElement>('.options button')].find(element=>element.textContent?.includes('배'))!;
    await act(async()=>option.click());
    await click('Зберегти відповідь');
    await ready(()=>expect(host.querySelector('.exam-feedback')?.textContent).toContain('Відповідь збережено'));
    expect(host.querySelector('.exam-feedback')?.textContent).not.toMatch(/Є помилка|Правильно|XP|사과/);
    expect(await db.exams.count()).toBe(0);
    await click('Завершити');
    await ready(()=>expect(host.querySelector('.result-screen')).not.toBeNull());
    expect(host.querySelector('.result-metrics')?.textContent).toContain('0/1');
    expect(host.querySelector('.result-errors')?.textContent).toContain('Правильно: 사과');
    expect(await db.attempts.count()).toBe(1);
    expect(await db.exams.count()).toBe(1);
  });

  it('ends a timed exam without fabricated attempts and scores unanswered tasks in the total',async()=>{
    await act(async()=>root.render(<LazyMotion features={domMax}><Session exam timerMinutes={.001}
      questions={[{id:'q',kind:'write',topic:'Їжа',prompt:'Яблуко',answer:'사과',explanation:'',demo:false}]}
      onFinish={()=>{}}/></LazyMotion>));
    await act(async()=>{await new Promise(resolve=>setTimeout(resolve,275));});
    await ready(()=>expect(host.querySelector('.result-screen')?.textContent).toContain('Без відповіді: 1'));
    expect(await db.attempts.count()).toBe(0);
    expect(await db.rewards.count()).toBe(0);
    expect((await db.exams.toArray())[0]).toMatchObject({total:1,score:0});
  });
});
