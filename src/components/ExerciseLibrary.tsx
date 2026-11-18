import {useState} from 'react';
import {Search, Trash2} from 'lucide-react';
import {labels} from '../game/labels';
import type {Exercise} from '../models';
import {SelectableMaterial, useMaterialPage, useMaterialSelection} from './MaterialSelection';

export function ExerciseLibrary({exercises}: {exercises: Exercise[]}) {
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState('');
  const topics = [...new Set(exercises.map(exercise => exercise.topic))];
  const currentTopic = topics.includes(topic) ? topic : '';
  const selection = useMaterialSelection('exercises', exercises);
  const search = query.trim().toLocaleLowerCase('uk');
  const filtered = exercises.filter(exercise => (!currentTopic || exercise.topic === currentTopic) &&
    [exercise.prompt, exercise.answer, exercise.topic].some(value => value.toLocaleLowerCase('uk').includes(search)));
  const {page, pagination} = useMaterialPage(filtered, JSON.stringify([currentTopic, query]));

  return <section className="card topic-summary exercise-library" aria-labelledby="exercise-library-title">
    <h2 id="exercise-library-title">Збережені вправи</h2>
    <div className="tools material-filters">
      <div className="search"><Search size={18} aria-hidden="true"/>
        <input aria-label="Пошук вправ" placeholder="Знайти вправу…" value={query} onChange={event => setQuery(event.target.value)}/>
      </div>
      <select aria-label="Тема вправ" value={currentTopic} onChange={event => setTopic(event.target.value)}>
        <option value="">Усі теми</option>
        {topics.map(value => <option key={value}>{value}</option>)}
      </select>
    </div>
    {selection.toolbar(filtered, currentTopic || undefined, true)}
    <div className="material-record-list">
      {page.map(exercise => selection.active
        ? <SelectableMaterial key={exercise.id} checked={selection.selected.has(exercise.id)} onChange={() => selection.toggle(exercise.id)}>
          <strong>{exercise.prompt}</strong><small>{exercise.topic} · {labels[exercise.kind]}</small>
        </SelectableMaterial>
        : <article className="material-record" key={exercise.id}>
          <div><strong>{exercise.prompt}</strong><small>{exercise.topic} · {labels[exercise.kind]}</small></div>
          <button type="button" className="icon-btn" aria-label={`Видалити ${exercise.prompt}`}
            onClick={() => selection.removeOne(exercise.id, exercise.prompt)}><Trash2 size={17}/></button>
        </article>)}
    </div>
    {!filtered.length && <p>Збережених вправ за цим запитом немає.</p>}
    {pagination}
    {selection.dialog}
  </section>;
}
