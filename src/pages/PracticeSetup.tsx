import {useMemo, useState} from 'react';
import {useLiveQuery} from 'dexie-react-hooks';
import {Link, useSearchParams} from 'react-router-dom';
import {ArrowRight} from 'lucide-react';
import {kinds, type Exercise, type Attempt} from '../models';
import {db} from '../services/db';
import {generate, mixExercises, sentenceDictations, shuffle} from '../services/learning';
import {Transfer} from '../components/Transfer';
import {ExerciseLibrary} from '../components/ExerciseLibrary';
import {labels} from '../game/labels';
import {Session} from './Learning';

const modes = {
  training: 'Тренування',
  mixed: 'Змішана практика',
  mistakes: 'Мої помилки',
  exam: 'Пробний іспит',
};
type Mode = keyof typeof modes;
const empty: never[] = [];

export function Practice() {
  const [params] = useSearchParams();
  const requested = params.get('mode');
  const mode = requested === 'mixed' || requested === 'mistakes' || requested === 'exam' ? requested : 'training';
  return <PracticeMode key={mode} mode={mode}/>;
}

function PracticeMode({mode}: {mode: Mode}) {
  const words = useLiveQuery(() => db.words.toArray()) ?? empty;
  const templates = useLiveQuery(() => db.exercises.toArray()) ?? empty;
  const attempts = useLiveQuery(() => mode === 'mistakes' ? db.attempts.toArray() : [], [mode]) ?? empty;
  const [types, setTypes] = useState<Exercise['kind'][]>([...kinds]);
  const [topics, setTopics] = useState<string[]>([]);
  const [count, setCount] = useState('10');
  const [minutes, setMinutes] = useState(0);
  const [questions, setQuestions] = useState<Exercise[] | null>(null);
  const pool = useMemo(() => {
    if (mode === 'mistakes') {
      const latest = new Map<string, Attempt>();
      for (const attempt of attempts) {
        const prior = latest.get(attempt.exercise.id);
        if (!prior || prior.date <= attempt.date) latest.set(attempt.exercise.id, attempt);
      }
      return [...latest.values()].filter(attempt => !attempt.correct).map(attempt => attempt.exercise);
    }
    const exercises = generate(words, templates);
    if (mode !== 'mixed') return exercises;
    return [...exercises.filter(exercise => exercise.kind !== 'dictation' || exercise.answer.trim().split(/\s+/).length > 1),
      ...sentenceDictations(templates, words)];
  }, [words, templates, attempts, mode]);
  const allTopics = [...new Set(pool.map(exercise => exercise.topic))];
  const currentTopics = topics.filter(topic => allTopics.includes(topic));
  const byTopic = pool.filter(exercise => !currentTopics.length || currentTopics.includes(exercise.topic));
  const available = byTopic.filter(exercise => types.includes(exercise.kind));
  const limit = count === 'all' ? available.length : Math.min(available.length, Number(count));
  const toggle = <T,>(values: T[], item: T) => values.includes(item) ? values.filter(value => value !== item) : [...values, item];
  if (questions) return <Session questions={questions} exam={mode === 'exam'} timerMinutes={minutes}
    title={modes[mode]} onFinish={() => setQuestions(null)}/>;

  return <>
    <div className="page-heading">
      <h1>Практика</h1>
      {mode === 'training' && <div className="tools"><Transfer type="exercises"/></div>}
    </div>
    <nav className="practice-modes" aria-label="Режими практики">
      {(Object.entries(modes) as [Mode, string][]).map(([value, label]) =>
        <Link key={value} to={value === 'training' ? '/practice' : `/practice?mode=${value}`}
          aria-current={mode === value ? 'page' : undefined} className={mode === value ? 'selected' : ''}>{label}</Link>)}
    </nav>
    <section className="card practice-config">
      <h2>{modes[mode]}</h2>
      {mode === 'exam' && <p>Результат і правильні відповіді відкриються після завершення.</p>}
      {mode === 'mistakes' && !pool.length ? <p>Немає завдань із останньою неправильною відповіддю.</p> : <>
        <fieldset>
          <legend>Теми</legend>
          <div className="tabs">
            <button type="button" className={!currentTopics.length ? 'selected' : ''} aria-pressed={!currentTopics.length}
              onClick={() => setTopics([])}>Усі теми</button>
            {allTopics.map(topic => <button type="button" key={topic} aria-pressed={currentTopics.includes(topic)}
              className={currentTopics.includes(topic) ? 'selected' : ''} onClick={() => setTopics(toggle(currentTopics, topic))}>{topic}</button>)}
          </div>
        </fieldset>
        <fieldset>
          <legend>Типи вправ</legend>
          <div className="practice-types">
            {kinds.map(kind => {
              const total = byTopic.filter(exercise => exercise.kind === kind).length;
              const label = mode === 'mixed' && kind === 'dictation' ? 'Диктант реченнями' :
                kind === 'write' ? 'Переклад корейською' : labels[kind];
              return <label className="material-checkbox" key={kind}>
                <input type="checkbox" checked={types.includes(kind) && total > 0} disabled={!total}
                  onChange={() => setTypes(previous => toggle(previous, kind))}/>
                <span>{label} <small>({total})</small></span>
              </label>;
            })}
          </div>
        </fieldset>
        <div className="practice-options">
          <label>Кількість завдань
            {mode === 'mixed' ? <select value={count} onChange={event => setCount(event.target.value)}>
              <option value="10">10</option><option value="20">20</option><option value="30">30</option>
              <option value="all">Без обмеження</option>
            </select> : <input type="number" min={1} max={100} value={count}
              onChange={event => setCount(String(Math.min(100, Math.max(1, Number(event.target.value) || 1))))}/>}
          </label>
          {mode === 'exam' && <label>Таймер<select value={minutes} onChange={event => setMinutes(Number(event.target.value))}>
            <option value={0}>Без таймера</option><option value={5}>5 хв</option><option value={10}>10 хв</option>
            <option value={20}>20 хв</option><option value={30}>30 хв</option>
          </select></label>}
        </div>
        <p role="status">{available.length ? `У сесії: ${limit} із ${available.length} доступних завдань.` : 'За цими фільтрами завдань немає.'}</p>
        <button className="btn" disabled={!limit} onClick={() =>
          setQuestions(mode === 'mixed' ? mixExercises(available, limit) : shuffle(available).slice(0, limit))}>
          {mode === 'exam' ? 'Розпочати іспит' : 'Почати практику'}<ArrowRight size={18}/>
        </button>
      </>}
    </section>
    {mode === 'training' && <ExerciseLibrary exercises={templates}/>}
  </>;
}
