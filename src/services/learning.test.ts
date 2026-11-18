import {describe,it,expect} from 'vitest';import {normalize,review,generate,streak,mixExercises,sentenceDictations} from './learning';import {bundleSchema,exerciseSchema} from '../models';import {seedWords,seedExercises,seedNotes} from '../data';

it('interleaves available exercise types and honors the session limit', () => {
  const pool = generate(seedWords,seedExercises);
  const chosen = mixExercises(pool, 4);
  expect(chosen).toHaveLength(4);
  expect(new Set(chosen.map(exercise => exercise.kind)).size).toBe(4);
  expect(mixExercises(pool)).toHaveLength(pool.length);
});

it('builds valid sentence dictations while skipping words without Korean phrases', () => {
  const dictations = sentenceDictations(seedExercises, [
    {...seedWords[0], example:'사과를 먹어요. Я їм яблуко.'},
    {...seedWords[1], example:'Один термін: 책'},
  ]);
  expect(dictations.some(exercise => exercise.answer === '사과를 먹어요.')).toBe(true);
  expect(dictations.every(exercise => exercise.answer.includes(' ') && exerciseSchema.safeParse(exercise).success)).toBe(true);
  expect(dictations.some(exercise => exercise.id === `mixed-dict-word-${seedWords[1].id}`)).toBe(false);
});
describe('learning',()=>{it('normalizes Korean NFC and punctuation without ignoring internal differences',()=>{expect(normalize(' 사과. ')).toBe('사과');expect(normalize('책을 읽어요')).not.toBe(normalize('책 읽어요'));});it('schedules a failed word before successful recall',()=>{expect(review(3,'again',0).due).toBe(600000);expect(review(3,'good',0)).toEqual({interval:6,due:518400000,learned:true});});it('generates valid questions with distinct answer choices',()=>{for(const e of generate(seedWords,seedExercises)){expect(e.answer).toBeTruthy();if(e.options){expect(e.options).toContain(e.answer);expect(new Set(e.options).size).toBe(e.options.length);}}});it('counts a streak through yesterday but not older activity',()=>{expect(streak(['2026-11-10','2026-11-11'],'2026-11-12')).toBe(2);expect(streak(['2026-11-10'],'2026-11-12')).toBe(0);});});
describe('import validation',()=>{const valid={format:'haruharu',version:1,type:'backup',notes:seedNotes,words:seedWords,exercises:seedExercises};it('accepts all bundled A1 material',()=>expect(bundleSchema.safeParse(valid).success).toBe(true));it('rejects bad exercise answers and mismatched file type',()=>{expect(bundleSchema.safeParse({...valid,exercises:[{...seedExercises[0],answer:'wrong'}]}).success).toBe(false);expect(bundleSchema.safeParse({...valid,type:'notes'}).success).toBe(false);});it('rejects duplicate IDs and malformed notes',()=>{expect(bundleSchema.safeParse({...valid,notes:[seedNotes[0],seedNotes[0]]}).success).toBe(false);expect(bundleSchema.safeParse({...valid,notes:[{title:'Only title'}]}).success).toBe(false);});});
