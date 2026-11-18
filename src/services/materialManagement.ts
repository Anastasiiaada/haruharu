import type {Table} from 'dexie';
import type {Exercise, Note, Word} from '../models';
import {db} from './db';

export const materialTypes = ['exercises', 'words', 'notes'] as const;
export type MaterialType = typeof materialTypes[number];
type Material = {id: string; demo?: boolean};
type DuplicateGroup = {label: string; key: string; ids: string[]; descriptions: string[]};
export type RemovalSelection = MaterialType | 'duplicates' |
  {type: MaterialType; ids: string[]} | {type: MaterialType; category: string};
type Removal = {type: MaterialType; ids: string[]; groups: DuplicateGroup[]};
export type RemovalPreview = {selection: RemovalSelection; removals: Removal[]; count: number};
export type DuplicateChoices = Record<MaterialType, Set<string>>;

export class StaleRemovalPreviewError extends Error {
  constructor() {
    super('Матеріали змінилися. Закрийте вікно й перевірте список ще раз.');
  }
}

const normalize = (text = '') => text.normalize('NFC').trim();
const preferPersonal = (a: Material, b: Material) => Number(!!a.demo) - Number(!!b.demo);

async function findDuplicates<T extends Material>(
  table: Table<T>, contentKey: (record: T) => unknown[], label: (record: T) => string,
  prefer: (a: T, b: T) => number = preferPersonal,
  describe: (record: T) => string = record => record.demo ? 'Демо A1' : 'Особистий запис',
): Promise<DuplicateGroup[]> {
  const matches = new Map<string, T[]>();
  for (const record of await table.toArray()) {
    const key = JSON.stringify(contentKey(record));
    const group = matches.get(key);
    if (group) group.push(record);
    else matches.set(key, [record]);
  }

  const duplicates: DuplicateGroup[] = [];
  for (const [key, records] of matches) {
    if (records.length < 2) continue;
    records.sort(prefer);
    duplicates.push({key, label: label(records[0]), ids: records.map(record => record.id), descriptions: records.map(describe)});
  }
  return duplicates;
}

const duplicateFinders = {
  exercises: () => findDuplicates<Exercise>(db.exercises, exercise => [
    exercise.kind, normalize(exercise.topic), normalize(exercise.prompt), normalize(exercise.answer),
    exercise.options?.map(normalize), exercise.tokens?.map(normalize),
    normalize(exercise.audio), normalize(exercise.explanation),
  ], exercise => `${exercise.topic} · ${exercise.prompt}`),
  words: () => findDuplicates<Word>(db.words, word => [
    normalize(word.korean), normalize(word.translation), normalize(word.category), normalize(word.example),
  ], word => `${word.korean} — ${word.translation} · ${word.category}`,
  (a, b) => Number(!!b.learned) - Number(!!a.learned) ||
    (b.interval ?? 0) - (a.interval ?? 0) || (b.due ?? 0) - (a.due ?? 0) || preferPersonal(a, b),
  word => `${word.learned ? 'Вивчено' : 'Вивчаю'} · інтервал ${word.interval ?? 0} дн.${word.demo ? ' · Демо A1' : ''}`),
  notes: () => findDuplicates<Note>(db.notes, note => [
    normalize(note.title), note.category, note.content,
  ], note => `${note.title} · ${note.category}`,
  (a, b) => preferPersonal(a, b) || (b.updatedAt ?? 0) - (a.updatedAt ?? 0),
  note => `${note.demo ? 'Демо A1' : 'Особистий запис'}${note.updatedAt ? ' · ' + new Date(note.updatedAt).toLocaleString('uk-UA') : ''}`),
};

const selectedTypes = (selection: RemovalSelection) =>
  selection === 'duplicates' ? materialTypes : [typeof selection === 'string' ? selection : selection.type];

async function collectRemoval(selection: RemovalSelection): Promise<RemovalPreview> {
  const removals = await Promise.all(selectedTypes(selection).map(async type => {
    if (selection !== 'duplicates') {
      const table = db[type];
      const categoryIndex = type === 'exercises' ? 'topic' : 'category';
      if (typeof selection !== 'string' && 'ids' in selection) {
        const records = await table.bulkGet([...new Set(selection.ids)].sort());
        return {type, ids: records.flatMap(record => record ? [record.id] : []), groups: []};
      }
      const rows = typeof selection === 'string'
        ? table.toCollection() : table.where(categoryIndex).equals(selection.category);
      return {type, ids: await rows.primaryKeys() as string[], groups: []};
    }
    const groups = await duplicateFinders[type]();
    return {type, groups, ids: groups.flatMap(group => group.ids.slice(1))};
  }));
  return {selection, removals, count: removals.reduce((total, removal) => total + removal.ids.length, 0)};
}

export function previewRemoval(selection: RemovalSelection) {
  return db.transaction('r', selectedTypes(selection).map(type => db[type]), () => collectRemoval(selection));
}

export function removeMaterials(preview: RemovalPreview, choices?: DuplicateChoices) {
  return db.transaction('rw', selectedTypes(preview.selection).map(type => db[type]), async () => {
    const current = await collectRemoval(preview.selection);
    if (JSON.stringify(current) !== JSON.stringify(preview)) {
      throw new StaleRemovalPreviewError();
    }
    for (const {type, ids: defaultIds, groups} of current.removals) {
      const ids = choices && current.selection === 'duplicates' ? groups.flatMap(group => {
        const chosen = group.ids.filter(id => choices[type].has(id));
        if (chosen.length === group.ids.length) throw new Error('У кожній групі має залишитися один запис.');
        return chosen;
      }) : defaultIds;
      if (ids.length) await db[type].bulkDelete(ids);
    }
  });
}
