import {lazy, Suspense, useState} from 'react';
import {useLiveQuery} from 'dexie-react-hooks';
import {Plus, Search, Trash2, Pencil, BookOpen, ArrowLeft} from 'lucide-react';
import {db, uid} from '../services/db';
import type {Note} from '../models';
import {Transfer} from '../components/Transfer';
import {KoreanSelection, SpeechSpeed} from '../components/Speech';
import {SelectableMaterial, useMaterialPage, useMaterialSelection} from '../components/MaterialSelection';
import {NoteContent} from '../components/NoteContent';

const RichEditor = lazy(() => import('../components/Editor').then(module => ({default: module.Editor})));
const categories = ['Усі', 'Граматика', 'Лексика', 'Інше'];

export function Library() {
  const notes = useLiveQuery(() => db.notes.toArray()) ?? [];
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Усі');
  const [active, setActive] = useState<Note | null>(null);
  const [edit, setEdit] = useState(false);
  const [error, setError] = useState('');
  const selection = useMaterialSelection('notes', notes);
  const filtered = notes.filter(note => (filter === 'Усі' || note.category === filter) &&
    (note.title + ' ' + note.content).toLowerCase().includes(query.trim().toLowerCase()));
  const {page, pagination} = useMaterialPage(filtered, JSON.stringify([filter, query]));

  if (active) return <>
    <button className="text-btn" onClick={() => {setActive(null); setEdit(false);}}><ArrowLeft size={17}/>До бібліотеки</button>
    <div className="page-heading">
      <div><span className="eyebrow">МІЙ ПРОСТІР ЗНАНЬ</span><h1>{edit ? 'Редагування конспекту' : active.title}</h1></div>
      {!edit && <button className="btn" onClick={() => setEdit(true)}><Pencil size={16}/>Редагувати</button>}
    </div>
    {edit ? <form className="card form" onSubmit={async event => {
      event.preventDefault();
      try {
        await db.notes.put({...active, title: active.title.trim(), updatedAt: Date.now()});
        setEdit(false);
      } catch (cause) { setError(String(cause)); }
    }}>
      <label>Назва<input required maxLength={200} value={active.title}
        onChange={event => setActive({...active, title: event.target.value})}/></label>
      <label>Категорія<select value={active.category}
        onChange={event => setActive({...active, category: event.target.value as Note['category']})}>
        {categories.slice(1).map(category => <option key={category}>{category}</option>)}
      </select></label>
      <KoreanSelection><Suspense fallback={<p>Завантаження редактора…</p>}>
        <RichEditor content={active.content} onChange={content => setActive(note => note ? {...note, content} : note)}/>
      </Suspense></KoreanSelection>
      <p className="error">{error}</p><button className="btn">Зберегти конспект</button>
    </form> : <KoreanSelection><article className="card prose">
      <SpeechSpeed/><span className="tag">{active.category}{active.demo ? ' · Демо A1' : ''}</span>
      <NoteContent html={active.content}/>
    </article></KoreanSelection>}
  </>;

  function open(note: Note) {
    setActive(note);
    setEdit(false);
  }

  return <>
    <div className="page-heading">
      <div><span className="eyebrow">ЗНАННЯ, ЯКІ ЗАВЖДИ ПОРУЧ</span><h1>Мої конспекти <span className="flower">✿</span></h1>
        <p>Зберігай важливе. Повертайся, коли потрібно.</p></div>
      <button className="btn" onClick={() => {
        setActive({id: uid(), title: 'Новий конспект', category: 'Граматика', content: '', demo: false, updatedAt: Date.now()});
        setEdit(true);
      }}><Plus size={18}/>Створити</button>
    </div>
    <div className="tools"><div className="search"><Search size={18}/>
      <input aria-label="Пошук конспектів" placeholder="Знайти конспект…" value={query} onChange={event => setQuery(event.target.value)}/>
    </div><Transfer type="notes"/></div>
    <div className="tabs">{categories.map(category => <button className={filter === category ? 'selected' : ''}
      aria-pressed={filter === category} key={category} onClick={() => setFilter(category)}>{category}</button>)}</div>
    {selection.toolbar(filtered, filter === 'Усі' ? undefined : filter)}
    <div className="grid cards">{page.map((note, index) => selection.active
      ? <SelectableMaterial key={note.id} checked={selection.selected.has(note.id)} onChange={() => selection.toggle(note.id)}>
        <strong>{note.title}</strong><small>{note.category}{note.demo ? ' · Демо A1' : ''}</small>
      </SelectableMaterial>
      : <article key={note.id} className="card note-card">
        <div className={`note-icon tone-${index % 3}`}><BookOpen/></div><span className="tag">{note.category} {note.demo && '· Демо A1'}</span>
        <button className="card-title" onClick={() => open(note)}>{note.title}</button>
        <p>{new DOMParser().parseFromString(note.content, 'text/html').body.textContent?.slice(0, 95)}…</p>
        <div className="card-footer">
          <button className="text-btn" onClick={() => open(note)}>Читати конспект →</button>
          <button aria-label={`Видалити ${note.title}`} className="icon-btn"
            onClick={() => selection.removeOne(note.id, note.title)}><Trash2 size={17}/></button>
        </div>
      </article>)}</div>
    {pagination}
    {!filtered.length && <div className="empty">Конспектів не знайдено.</div>}
    {selection.dialog}
  </>;
}
