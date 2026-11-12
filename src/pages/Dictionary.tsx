import {m,AnimatePresence,LayoutGroup,useReducedMotion} from 'motion/react';
import {useId,useState} from 'react';
import {useLiveQuery} from 'dexie-react-hooks';
import {Plus,Search,Pencil,Trash2,Check,LayoutGrid,List,Table2,ArrowDown,ArrowUp} from 'lucide-react';
import {db,uid} from '../services/db';
import type {Word} from '../models';
import {Transfer} from '../components/Transfer';
import {SpeakButton,SpeechSpeed} from '../components/Speech';
import {Dialog} from '../components/Dialog';
import {markWordLearned} from '../game/service';
import {unlockSound,playSound} from '../game/sound';
import {reactToAction,toast,EmptyState,Skeleton} from '../components/GameUI';
import './dictionary.css';
import {CompactMenu} from '../components/CompactMenu';

type View = 'cards'|'list'|'table';
type Sort = 'korean'|'category'|'learned';
const views = [{value:'cards',label:'Картки',Icon:LayoutGrid},{value:'list',label:'Список',Icon:List},{value:'table',label:'Таблиця',Icon:Table2}] as const;
const sortLabels:Record<Sort,string> = {korean:'Корейське слово',category:'Категорія',learned:'Статус вивчення'};

function WordActions({word,onEdit,onDelete,quick=false}:{word:Word;onEdit:()=>void;onDelete:()=>void;quick?:boolean}) {
  const [busy,setBusy] = useState(false);
  async function toggleLearned() {
    if (busy) return;
    setBusy(true);
    unlockSound();
    try {
      const action = await markWordLearned(word.id,!word.learned);
      reactToAction(action);
      if (!word.learned) {
        toast('Ще одне слово у твоєму серці 🌸','success');
        if(action.level===action.beforeLevel&&!action.badges.length)playSound('correct');
      }
    } catch { toast('Не вдалося зберегти слово.','error'); }
    finally { setBusy(false); }
  }
  return <div className="dictionary-actions" onClick={e=>e.stopPropagation()}>
    <SpeakButton text={word.korean} repeatButton={!quick}/>
    <button type="button" className="icon-btn word-status" aria-label={word.learned?'Позначити невивченим':'Позначити вивченим'} title={word.learned?'Вивчено':'Вивчаю'} aria-pressed={word.learned} disabled={busy} onClick={()=>void toggleLearned()}><Check size={18}/></button>
    {!quick&&<button type="button" className="icon-btn" aria-label={`Редагувати ${word.korean}`} onClick={onEdit}><Pencil size={17}/></button>}
    {!quick&&<button type="button" className="icon-btn" aria-label={`Видалити ${word.korean}`} onClick={onDelete}><Trash2 size={17}/></button>}
  </div>;
}

export function Dictionary() {
  const words = useLiveQuery(()=>db.words.toArray());
  const setting = useLiveQuery(()=>db.settings.get('dictionaryView'));
  const view:View = setting?.value==='list'||setting?.value==='table'?setting.value:'cards';
  const [query,setQuery] = useState('');
  const [category,setCategory] = useState('Усі');
  const [sort,setSort] = useState<Sort>('korean');
  const [descending,setDescending] = useState(false);
  const [selectedId,setSelectedId] = useState<string|null>(null);
  const [draft,setDraft] = useState<Word|null>(null);
  const [error,setError] = useState('');
  const [saving,setSaving] = useState(false);
  const titleId = useId();
  const editTitleId = useId();
  const groupId = useId();
  const reduced = useReducedMotion();
  if (!words) return <Skeleton/>;
  const selected = words.find(word=>word.id===selectedId);
  const filtered = words.filter(word=>(category==='Усі'||word.category===category)&&(word.korean+word.translation+word.example).toLocaleLowerCase('uk').includes(query.trim().toLocaleLowerCase('uk'))).sort((a,b)=>{
    const result = sort==='learned'?Number(a.learned)-Number(b.learned):a[sort].localeCompare(b[sort],sort==='korean'?'ko':'uk');
    return (result || a.korean.localeCompare(b.korean,'ko')) * (descending?-1:1);
  });
  const layoutId = (word:Word) => `${groupId}-${view}-${word.id}`;
  const openEdit = (word:Word) => { setError('');setSelectedId(null);setDraft({...word}); };
  async function remove(word:Word) {
    if (!confirm(`Видалити слово ${word.korean}?`)) return;
    try { await db.words.delete(word.id);if(selectedId===word.id)setSelectedId(null); }
    catch { toast('Не вдалося видалити слово.','error'); }
  }
  function sortBy(value:Sort) {
    if(sort===value)setDescending(!descending);
    else {setSort(value);setDescending(false);}
  }
  function actions(word:Word,quick=false) {
    return <WordActions word={word} quick={quick} onEdit={()=>openEdit(word)} onDelete={()=>void remove(word)}/>;
  }
  async function save() {
    if (!draft||saving) return;
    setSaving(true);
    try {
      const value = {...draft,korean:draft.korean.trim(),translation:draft.translation.trim(),category:draft.category.trim()};
      if(!value.korean||!value.translation||!value.category)throw new Error('Заповни слово, переклад і категорію.');
      const existed = await db.words.get(draft.id);
      await db.words.put(value);
      setDraft(null);
      toast(existed?'Слово оновлено ✨':'Нове слово у твоїй колекції 🌱','success');
    } catch(e) { setError(e instanceof Error?e.message:String(e)); }
    finally { setSaving(false); }
  }
  return <div className="dictionary-page">
    <div className="page-heading"><div><h1>Словник</h1><p>{words.length} слів</p></div><button className="icon-btn" aria-label="Додати слово" onClick={()=>openEdit({id:uid(),korean:'',translation:'',category:'Загальне',example:'',learned:false,due:0,interval:0,demo:false})}><Plus size={21}/></button></div>
    <div className="tools dictionary-tools"><div className="search"><Search size={18}/><input aria-label="Пошук слів" placeholder="Корейською або українською…" value={query} onChange={e=>setQuery(e.target.value)}/></div><select aria-label="Категорія" value={category} onChange={e=>setCategory(e.target.value)}>{['Усі',...new Set(words.map(word=>word.category))].map(value=><option key={value}>{value}</option>)}</select></div>
    <div className="dictionary-options">
      <div className="dictionary-views" role="group" aria-label="Режим перегляду словника">{views.map(({value,label,Icon})=><button type="button" key={value} aria-pressed={view===value} onClick={()=>void db.settings.put({key:'dictionaryView',value}).catch(()=>toast('Не вдалося зберегти режим.','error'))}><Icon size={17}/>{label}</button>)}</div>
      <CompactMenu label="Налаштування словника">
        <div className="dictionary-sort"><label>Сортувати<select value={sort} onChange={event=>{setSort(event.target.value as Sort);setDescending(false);}}>{Object.entries(sortLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><button type="button" className="icon-btn" aria-label={descending?'Сортувати за зростанням':'Сортувати за спаданням'} onClick={()=>setDescending(!descending)}>{descending?<ArrowDown size={18}/>:<ArrowUp size={18}/>}</button></div>
        <SpeechSpeed/>
        <div className="tools"><Transfer type="words"/></div>
      </CompactMenu>
    </div>
    <LayoutGroup id={groupId}>
      {view==='table'?<div className="dictionary-table-scroll" role="region" aria-label="Таблиця словника з горизонтальною прокруткою" tabIndex={0}><table className="dictionary-table"><thead><tr>{(['korean','translation','category','learned'] as const).map(key=><th key={key} scope="col" aria-sort={key===sort?(descending?'descending':'ascending'):undefined}>{key==='translation'?'Український переклад':<button type="button" onClick={()=>sortBy(key)}>{sortLabels[key]}{key===sort&&(descending?<ArrowDown size={13}/>:<ArrowUp size={13}/>)}</button>}</th>)}</tr></thead><tbody>{filtered.map(word=><m.tr layoutId={reduced?undefined:layoutId(word)} key={word.id}><td><button type="button" lang="ko" className="word-table-open" onClick={()=>setSelectedId(word.id)}>{word.korean}</button></td><td>{word.translation}</td><td>{word.category}</td><td>{word.learned?'Вивчено':'Вивчаю'}</td></m.tr>)}</tbody></table></div>:<div className={view==='cards'?'dictionary-grid':'dictionary-list'}><AnimatePresence initial={false}>{filtered.map(word=><m.article key={word.id} onClick={()=>setSelectedId(word.id)} layout={!reduced} layoutId={reduced?undefined:layoutId(word)} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className={`card dictionary-word ${word.learned?'is-learned':''}`}>
        <button type="button" className="word-open" onClick={()=>setSelectedId(word.id)} aria-label={`Відкрити ${word.korean}`}><span lang="ko" className="dictionary-korean">{word.korean}</span><span className="dictionary-translation">{word.translation}</span><span className="dictionary-meta"><span>{word.category}</span>{view==='cards'&&<span>{word.learned?'Вивчено':'Вивчаю'}</span>}</span></button>
        {actions(word,true)}
      </m.article>)}</AnimatePresence></div>}
      <AnimatePresence>{selected&&<Dialog key="word-detail" titleId={titleId} onClose={()=>setSelectedId(null)} layoutId={layoutId(selected)} closeOnBackdrop className="dictionary-detail">
        <m.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:reduced?0:.08}}><span className="tag">{selected.category}</span><h2 id={titleId} lang="ko">{selected.korean}</h2><p className="word-detail-translation">{selected.translation}</p><p className="muted">{selected.learned?'Вивчено':'Вивчаю'}</p>{selected.example&&<div className="word-detail-example"><p lang="ko">{selected.example}</p><SpeakButton text={selected.example} label="Озвучити приклад речення"/></div>}{actions(selected)}</m.div>
      </Dialog>}</AnimatePresence>
    </LayoutGroup>
    {!filtered.length&&<EmptyState title={words.length?'Це слово трохи сховалося':'Тут виросте твій словник'} text={words.length?'Спробуй інший запит або категорію.':'Додай перше слово або імпортуй колекцію.'}/>}
    <AnimatePresence>{draft&&<Dialog key="word-editor" titleId={editTitleId} onClose={()=>{if(!saving)setDraft(null);}} className="dictionary-edit"><form className="form" onSubmit={e=>{e.preventDefault();void save();}}><h2 id={editTitleId}>Слово до колекції</h2>{(['korean','translation','category','example'] as const).map((key,index)=><label key={key}>{['Корейське слово','Український переклад','Категорія','Приклад використання'][index]}<input lang={key==='korean'||key==='example'?'ko':'uk'} required={key!=='example'} maxLength={key==='example'?1000:key==='translation'?300:200} value={draft[key]} onChange={e=>setDraft({...draft,[key]:e.target.value})}/></label>)}<p className="error" role="alert">{error}</p><button className="btn" disabled={saving}>{saving?'Зберігаємо…':'Зберегти'}</button></form></Dialog>}</AnimatePresence>
  </div>;
}
