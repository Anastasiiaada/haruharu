import 'fake-indexeddb/auto';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {Database, initialize} from './db';
import {bundleSchema} from '../models';
import fullSource from '../content/a1-20261118.json';
import practiceSource from '../content/a1-practice-20261118.json';

let database: Database;
const fullPack = bundleSchema.parse(fullSource);

beforeEach(() => {database = new Database('bundled-a1-test');});
afterEach(async () => database.delete());

it('ships both valid JSON v1 collections with identical shared materials', () => {
  const practice = bundleSchema.parse(practiceSource);
  expect(practice.words).toEqual(fullPack.words);
  expect(practice.exercises).toEqual(fullPack.exercises);
  expect(fullPack.notes).toHaveLength(19);
  expect(practice.notes).toHaveLength(0);
  expect(fullPack.words).toHaveLength(372);
  expect(fullPack.exercises).toHaveLength(1917);
});

it('adds the pack to fresh databases and never restores intentionally deleted records', async () => {
  const progress = vi.fn();
  await Promise.all([initialize(database, progress), initialize(database, progress)]);
  expect(progress).toHaveBeenLastCalledWith(2308, 2308);
  const note = fullPack.notes[0];
  expect(await database.notes.get(note.id)).toEqual(note);
  expect(await database.words.get(fullPack.words[0].id)).toEqual(fullPack.words[0]);
  expect(await database.exercises.get(fullPack.exercises[0].id)).toEqual(fullPack.exercises[0]);
  await database.notes.delete(note.id);
  const counts = await Promise.all([database.notes.count(), database.words.count(), database.exercises.count()]);
  await initialize(database);
  expect(await Promise.all([database.notes.count(), database.words.count(), database.exercises.count()])).toEqual(counts);
  expect(await database.notes.get(note.id)).toBeUndefined();
});

it('keeps previously imported records, existing ID edits and progress on upgrade', async () => {
  const imported = {...fullPack.words[0], id:'existing-import', learned:true, due:123456, interval:7};
  const edited = {...fullPack.notes[0], content:'<p>Мої зміни</p>'};
  await database.settings.bulkAdd([{key:'initialized', value:'yes'}, {key:'theme', value:'dark'}]);
  await database.notes.add(edited);
  await database.words.add(imported);
  await database.attempts.add({id:'saved-attempt', exercise:fullPack.exercises[0], given:'', correct:false, date:'2026-11-18'});
  await initialize(database);
  expect(await database.words.count()).toBe(372);
  expect(await database.words.get(imported.id)).toEqual(imported);
  expect(await database.words.get(fullPack.words[0].id)).toBeUndefined();
  expect(await database.notes.get(edited.id)).toEqual(edited);
  expect(await database.settings.get('theme')).toEqual({key:'theme', value:'dark'});
  expect(await database.attempts.count()).toBe(1);
});
