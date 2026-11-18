// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {domMax, LazyMotion} from 'motion/react';
import {afterAll, afterEach, beforeEach, expect, it, vi} from 'vitest';
import {seedExercises, seedNotes, seedWords} from '../data';
import {db} from '../services/db';
import {previewRemoval, removeMaterials} from '../services/materialManagement';
import {exportData} from '../services/transfer';
import {MaterialManagement} from './MaterialManagement';
import {ExerciseLibrary} from './ExerciseLibrary';
import {useLiveQuery} from 'dexie-react-hooks';

vi.mock('../services/transfer', () => ({exportData: vi.fn(async () => {})}));

const exercise = seedExercises[0];
const word = seedWords[0];
const note = seedNotes[0];
const date = '2026-11-18T12:00:00Z';
let host: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.clearAllMocks();
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) await table.clear();
    await db.exercises.add(exercise);
    await db.words.add(word);
    await db.notes.add(note);
    await db.attempts.add({id: 'answer', exercise, given: exercise.answer, correct: true, date});
    await db.exams.add({id: 'exam', date, total: 1, score: 1});
    await db.rewards.add({id: 'xp', kind: 'answer', reference: 'answer', xp: 10, date});
    await db.badges.add({id: 'first-answer', date});
    await db.calendarSources.add({id: 'local', name: 'Локальний', kind: 'local', enabled: true});
    await db.settings.put({key: 'initialized', value: 'yes'});
  });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
afterAll(() => db.close());

function button(label: string) {
  return Array.from(document.querySelectorAll('button')).find(element => element.textContent === label);
}

async function click(label: string) {
  const element = button(label);
  expect(element).toBeDefined();
  await act(async () => element!.click());
}

async function ready(check: () => void) {
  await vi.waitFor(async () => {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
    check();
  });
}

it('shows the count and backup option, supports cancel, and deletes only the confirmed category', async () => {
  await act(async () => root.render(<LazyMotion features={domMax}><MaterialManagement/></LazyMotion>));
  await ready(() => expect(button('Очистити всі вправи')?.disabled).toBe(false));
  await click('Очистити всі вправи');
  await ready(() => expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Буде видалено записів: 1.'));
  expect(await db.exercises.count()).toBe(1);
  await click('Експортувати копію');
  expect(exportData).toHaveBeenCalledWith('backup');
  await click('Скасувати');
  expect(await db.exercises.count()).toBe(1);

  await click('Очистити всі вправи');
  await ready(() => expect(button('Підтвердити видалення')).toBeDefined());
  await click('Підтвердити видалення');
  await ready(() => expect(host.textContent).toContain('Видалено записів: 1.'));
  expect(await db.exercises.count()).toBe(0);
  expect(await db.words.toArray()).toEqual([word]);
  expect(await db.notes.toArray()).toEqual([note]);
  expect(await db.attempts.get('answer')).toMatchObject({exercise, correct: true});
  expect(await db.exams.get('exam')).toMatchObject({score: 1});
  expect(await db.rewards.get('xp')).toMatchObject({xp: 10});
  expect(await db.badges.get('first-answer')).toEqual({id: 'first-answer', date});
  expect(await db.calendarSources.get('local')).toMatchObject({enabled: true});
  expect(await db.settings.get('initialized')).toMatchObject({value: 'yes'});
});

it('finds duplicates across all three types, keeping distinct content and word progress', async () => {
  await db.exercises.bulkAdd([
    {...exercise, id: 'exercise-copy'},
    {...exercise, id: 'exercise-variant', explanation: exercise.explanation + ' Додаткове пояснення.'},
  ]);
  await db.words.bulkAdd([
    {...word, id: 'word-copy', learned: true, interval: 20, due: 100},
    {...word, id: 'word-variant', translation: word.translation + ' / інше значення'},
  ]);
  await db.notes.bulkAdd([
    {...note, id: 'note-copy'},
    {...note, id: 'note-variant', content: note.content + '<p>Додаток</p>'},
  ]);
  await act(async () => root.render(<LazyMotion features={domMax}><MaterialManagement/></LazyMotion>));
  await click('Знайти дублікати');
  await ready(() => expect(button('Вибрати всі дублікати')).toBeDefined());
  expect(button('Підтвердити видалення')?.disabled).toBe(true);
  await click('Вибрати всі дублікати');
  await ready(() => expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Буде видалено записів: 3.'));
  expect(document.querySelectorAll('details')).toHaveLength(3);
  expect(await db.words.count()).toBe(3);
  await click('Підтвердити видалення');
  await ready(() => expect(host.textContent).toContain('Видалено записів: 3.'));
  expect(await db.exercises.count()).toBe(2);
  expect(await db.notes.count()).toBe(2);
  expect(await db.words.get('word-copy')).toMatchObject({learned: true, interval: 20, due: 100});
  expect(await db.words.get(word.id)).toBeUndefined();
  expect((await previewRemoval('duplicates')).count).toBe(0);
});

it('allows choosing which duplicate to keep and leaves unselected groups intact', async () => {
  await db.words.add({...word, id: 'word-copy', learned: true, interval: 20, due: 100});
  await db.notes.add({...note, id: 'note-copy'});
  await act(async () => root.render(<LazyMotion features={domMax}><MaterialManagement/></LazyMotion>));
  await click('Знайти дублікати');
  await ready(() => expect(document.querySelectorAll('details')).toHaveLength(2));
  const [recommended, other] = document.querySelectorAll<HTMLInputElement>('details input[type="checkbox"]');
  await act(async () => recommended.click());
  expect(other.disabled).toBe(true);
  await click('Підтвердити видалення');
  await ready(() => expect(host.textContent).toContain('Видалено записів: 1.'));
  expect(await db.words.toArray()).toEqual([word]);
  expect(await db.notes.count()).toBe(2);
});

it('requires a fresh preview if records are added or duplicates are edited before confirmation', async () => {
  const allWords = await previewRemoval('words');
  await db.words.add({...word, id: 'new-copy'});
  await expect(removeMaterials(allWords)).rejects.toThrow('Матеріали змінилися');
  const duplicates = await previewRemoval('duplicates');
  await db.words.update('new-copy', {example: word.example + ' Інший приклад.'});
  await expect(removeMaterials(duplicates)).rejects.toThrow('Матеріали змінилися');
  expect(await db.words.count()).toBe(2);
  await removeMaterials(await previewRemoval('words'));
  expect(await db.words.count()).toBe(0);
  await removeMaterials(await previewRemoval('notes'));
  expect(await db.notes.count()).toBe(0);
  expect(await db.exercises.toArray()).toEqual([exercise]);
});

function LiveExerciseLibrary() {
  const exercises = useLiveQuery(() => db.exercises.toArray()) ?? [];
  return <ExerciseLibrary exercises={exercises}/>;
}

it('keeps selections across pages and selects all search matches within a topic', async () => {
  await db.exercises.clear();
  await db.exercises.bulkAdd([
    ...Array.from({length: 25}, (_, index) => ({
      ...exercise, id: `batch-${String(index).padStart(2, '0')}`, topic: 'Тема', prompt: `Завдання ${index}`,
    })),
    {...exercise, id: 'same-topic', topic: 'Тема', prompt: 'Інший текст'},
    {...exercise, id: 'outside-topic', topic: 'Інша тема', prompt: 'Завдання поза темою'},
  ]);
  await act(async () => root.render(<LazyMotion features={domMax}><LiveExerciseLibrary/></LazyMotion>));
  await ready(() => expect(button('Вибрати')?.disabled).toBe(false));
  const topic = host.querySelector('select')!;
  const search = host.querySelector<HTMLInputElement>('input[aria-label="Пошук вправ"]')!;
  await act(async () => {
    topic.value = 'Тема';
    topic.dispatchEvent(new Event('change', {bubbles: true}));
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'Завдання');
    search.dispatchEvent(new Event('input', {bubbles: true}));
  });
  await click('Вибрати');
  expect(host.querySelectorAll('input[type="checkbox"]')).toHaveLength(24);
  await act(async () => host.querySelector<HTMLElement>('.selectable-material strong')!.click());
  expect(host.textContent).toContain('Вибрано: 1');
  await click('Далі');
  await act(async () => host.querySelector<HTMLElement>('.selectable-material strong')!.click());
  expect(host.textContent).toContain('Вибрано: 2');
  await click('Вибрати всі');
  expect(host.textContent).toContain('Вибрано: 25');
  await click('Видалити вибрані');
  await ready(() => expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Буде видалено записів: 25.'));
  await click('Підтвердити видалення');
  await ready(() => expect(host.textContent).toContain('Видалено записів: 25.'));
  expect(await db.exercises.toCollection().primaryKeys()).toEqual(['outside-topic', 'same-topic']);
  expect(host.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
  await click('Видалити всі вправи теми');
  await ready(() => expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Буде видалено записів: 1.'));
  await click('Підтвердити видалення');
  await ready(() => expect(host.textContent).toContain('Видалено записів: 1.'));
  expect(await db.exercises.toCollection().primaryKeys()).toEqual(['outside-topic']);
  expect(await db.words.toArray()).toEqual([word]);
  expect(await db.attempts.count()).toBe(1);
});
