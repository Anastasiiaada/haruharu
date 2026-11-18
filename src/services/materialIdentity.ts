import type {Exercise, Note, Word} from '../models';

const normalize = (text = '') => text.normalize('NFC').trim();

export const noteKey = (note: Note) => JSON.stringify([
  normalize(note.title), note.category, note.content,
]);

export const wordKey = (word: Word) => JSON.stringify([
  normalize(word.korean), normalize(word.translation), normalize(word.category), normalize(word.example),
]);

export const exerciseKey = (exercise: Exercise) => JSON.stringify([
  exercise.kind, normalize(exercise.topic), normalize(exercise.prompt), normalize(exercise.answer),
  exercise.options?.map(normalize), exercise.tokens?.map(normalize),
  normalize(exercise.audio), normalize(exercise.explanation),
]);
