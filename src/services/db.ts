import type {Reward,Badge} from '../game/models';
import Dexie, { type Table } from 'dexie';
import {bundleSchema, type Note, type Word, type Exercise, type Attempt, type Exam} from '../models';
import {seedNotes,seedWords,seedExercises} from '../data';
import {exerciseKey, noteKey, wordKey} from './materialIdentity';
import type {CalendarSource,LocalEvent,CalendarEvent,IcsFeed,InboxItem} from '../calendar/models';
export class Database extends Dexie { rewards!:Table<Reward>; badges!:Table<Badge>; notes!:Table<Note>; words!:Table<Word>; exercises!:Table<Exercise>; attempts!:Table<Attempt>; exams!:Table<Exam>; settings!:Table<{key:string,value:string}>; calendarSources!:Table<CalendarSource>; localEvents!:Table<LocalEvent>; calendarEvents!:Table<CalendarEvent>; icsFeeds!:Table<IcsFeed>; inbox!:Table<InboxItem>; constructor(databaseName='haruharu'){super(databaseName);this.version(1).stores({notes:'id,category',words:'id,category,due',exercises:'id,topic',attempts:'id,date',exams:'id,date',settings:'key'});this.version(2).stores({calendarSources:'id,kind',localEvents:'id,start',calendarEvents:'id,sourceId,start',icsFeeds:'id,sourceId',inbox:'id,date'});this.version(3).stores({rewards:'id,date,kind,reference',badges:'id,date'});} }
export const db=new Database();
const a1PackKey = 'bundled-a1-20261118';

async function addMissing<T extends {id: string}>(
  table: Table<T>, records: T[], key: (record: T) => string, advance?: (count: number) => void,
) {
  const existing = await table.toArray();
  const ids = new Set(existing.map(record => record.id));
  const keys = new Set(existing.map(key));
  const missing = records.filter(record => !ids.has(record.id) && !keys.has(key(record)));
  advance?.(records.length - missing.length);
  for (let index = 0; index < missing.length; index += 128) {
    const batch = missing.slice(index, index + 128);
    await table.bulkAdd(batch);
    advance?.(batch.length);
  }
}

export async function initialize(database = db, onPackProgress?: (done: number, total: number) => void) {
  const {notes, words, exercises, settings} = database;
  const [initialized, installed] = await settings.bulkGet(['initialized', a1PackKey]);
  if (initialized && installed) return;
  // The practice-only file has the same words and exercises. The full pack supplies both.
  const pack = installed ? undefined : bundleSchema.parse((await import('../content/a1-20261118.json')).default);

  await database.transaction('rw', [notes, words, exercises, settings], async () => {
    if (!await settings.get('initialized')) {
      await addMissing(notes, seedNotes, noteKey);
      await addMissing(words, seedWords, wordKey);
      await addMissing(exercises, seedExercises, exerciseKey);
      await settings.put({key:'initialized', value:'yes'});
    }
    if (pack && !await settings.get(a1PackKey)) {
      const total = pack.notes.length + pack.words.length + pack.exercises.length;
      let done = 0;
      const advance = (count: number) => {
        done += count;
        onPackProgress?.(done, total);
      };
      advance(0);
      await addMissing(notes, pack.notes, noteKey, advance);
      await addMissing(words, pack.words, wordKey, advance);
      await addMissing(exercises, pack.exercises, exerciseKey, advance);
      await settings.put({key:a1PackKey, value:'yes'});
    }
  });
}
export const uid=()=>crypto.randomUUID();
export function day(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
