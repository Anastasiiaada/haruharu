import type {Exercise,Word} from '../models';
import {koreanText} from './speech';
export function shuffle<T>(items:T[]):T[]{const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export const normalize=(s:string)=>s.normalize('NFC').trim().replace(/\s+/g,' ').replace(/[.!?。！？]+$/,'').toLocaleLowerCase('uk');

export function sentenceDictations(exercises: Exercise[], words: Word[]): Exercise[] {
  const isPhrase = (text: string) => koreanText(text).split(/\s+/).length > 1;
  const candidates = [
    ...exercises.filter(exercise => exercise.kind === 'sentence' && isPhrase(exercise.answer)).map(exercise => ({
      ...exercise, id: `mixed-dict-exercise-${exercise.id}`, kind: 'dictation' as const,
      prompt: 'Прослухай і запиши корейське речення.', audio: exercise.answer, tokens: undefined, options: undefined,
    })),
    ...words.flatMap(word => {
      const answer = koreanText(word.example);
      return isPhrase(answer) ? [{
        id: `mixed-dict-word-${word.id}`, kind: 'dictation' as const, topic: word.category,
        prompt: 'Прослухай і запиши корейське речення.', answer, audio: answer, demo: word.demo, explanation: '',
      }] : [];
    }),
  ];
  const seen = new Set(exercises.filter(exercise => exercise.kind === 'dictation' && isPhrase(exercise.answer))
    .map(exercise => JSON.stringify([exercise.topic, normalize(exercise.answer)])));
  return candidates.filter(exercise => {
    const key = JSON.stringify([exercise.topic, normalize(exercise.answer)]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function mixExercises(exercises: Exercise[], limit = Infinity): Exercise[] {
  const byKind = new Map<Exercise['kind'], Exercise[]>();
  for (const exercise of shuffle(exercises)) {
    const group = byKind.get(exercise.kind);
    if (group) group.push(exercise);
    else byKind.set(exercise.kind, [exercise]);
  }
  const result: Exercise[] = [];
  while (byKind.size && result.length < limit) {
    const previous = result.at(-1)?.kind;
    const groups = shuffle([...byKind.entries()]);
    // Start each round with a different kind when possible.
    const start = groups.findIndex(([kind]) => kind !== previous);
    if (start > 0) groups.unshift(groups.splice(start, 1)[0]);
    for (const [kind, group] of groups) {
      result.push(group.pop()!);
      if (!group.length) byKind.delete(kind);
      if (result.length >= limit) break;
    }
  }
  return result;
}
export function generate(words:Word[],templates:Exercise[]):Exercise[]{return [...templates,...words.flatMap(w=>{const options=[...new Set([w.translation,...shuffle(words.filter(x=>x.translation!==w.translation)).slice(0,3).map(x=>x.translation)])];const base={topic:w.category,explanation:w.example||`${w.korean} — ${w.translation}`,demo:w.demo};return [{...base,id:`write-${w.id}`,kind:'write' as const,prompt:`Напишіть корейською: ${w.translation}`,answer:w.korean},{...base,id:`dict-${w.id}`,kind:'dictation' as const,prompt:'Прослухайте й напишіть корейське слово.',answer:w.korean,audio:w.korean},...(options.length>1?[{...base,id:`choice-${w.id}`,kind:'choice' as const,prompt:`Оберіть переклад: ${w.korean}`,answer:w.translation,options:shuffle(options)}]:[])];})];}
export function review(interval:number,rating:'again'|'hard'|'good'|'easy',now=Date.now()){const days=rating==='again'?0:rating==='hard'?1:rating==='good'?Math.max(1,interval*2):Math.max(3,interval*3);return {interval:Math.min(365,days),due:now+(days?Math.min(365,days)*86400000:600000),learned:rating==='good'||rating==='easy'};}
export function streak(dates:string[],today:string){const set=new Set(dates.map(x=>x.slice(0,10)));const d=new Date(`${today}T12:00:00`);if(!set.has(today))d.setDate(d.getDate()-1);let count=0;while(set.has(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`)){count++;d.setDate(d.getDate()-1);}return count;}
