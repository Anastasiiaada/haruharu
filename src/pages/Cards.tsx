import {useEffect, useId, useRef, useState, type PointerEvent} from 'react';
import {useLiveQuery} from 'dexie-react-hooks';
import {m, animate, AnimatePresence, useMotionValue, useTransform, useReducedMotion} from 'motion/react';
import {Link} from 'react-router-dom';
import {ArrowLeft, ArrowRight, CircleHelp, RotateCw} from 'lucide-react';
import {db} from '../services/db';
import type {Word} from '../models';
import {speech} from '../services/speech';
import {SpeakButton, SpeechSpeed} from '../components/Speech';
import {rateWord} from '../game/service';
import {unlockSound, playSound} from '../game/sound';
import {EmptyState, reactToAction, Skeleton, toast} from '../components/GameUI';
import {LearningScreen} from '../components/LearningScreen';
import {CompactMenu} from '../components/CompactMenu';
import {Dialog} from '../components/Dialog';

type Direction = -1 | 1;
const tutorialKey = 'cardSwipeTutorial';

function FlipCard({word, reverse, flipped, onFlip, onRate, disabled}: {
  word: Word; reverse: boolean; flipped: boolean; onFlip: () => void; onRate: (direction: Direction) => Promise<boolean>; disabled: boolean;
}) {
  const x = useMotionValue(0);
  const tilt = useTransform(x, [-150, 150], [-8, 8]);
  const left = useTransform(x, [-80, -12], [1, 0]);
  const right = useTransform(x, [12, 80], [0, 1]);
  const reduce = useReducedMotion();
  const lastDrag = useRef(0);
  const pointer = useRef<{id:number; x:number; y:number; axis?:'x'|'y'}>(null);
  const spring = useRef<ReturnType<typeof animate> | null>(null);
  useEffect(() => () => spring.current?.stop(), []);

  function snapBack() {
    if (reduce) x.set(0);
    else spring.current = animate(x, 0, {type:'spring',stiffness:360,damping:30});
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    const start = pointer.current;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!start.axis && Math.max(Math.abs(dx), Math.abs(dy)) >= 8) {
      start.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
      if (start.axis === 'x') event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (start.axis === 'x') x.set(dx * .84);
  }

  function release(event: PointerEvent<HTMLDivElement>, cancelled = false) {
    const start = pointer.current;
    if (!start || start.id !== event.pointerId) return;
    pointer.current = null;
    if (!start.axis) return;
    lastDrag.current = Date.now();
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!cancelled && start.axis === 'x' && Math.abs(dx) >= 75 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      void onRate(dx > 0 ? 1 : -1).then(saved => {if (!saved) snapBack();});
    } else snapBack();
  }

  const faces = [
    {text:reverse ? word.translation : word.korean, lang:reverse ? 'uk' : 'ko', back:false},
    {text:reverse ? word.korean : word.translation, lang:reverse ? 'ko' : 'uk', back:true},
  ];
  return <div className="flip-gesture-frame"><m.div className="flip-gesture"
    style={{x, rotate:reduce ? 0 : tilt}}
    onPointerDown={event => {
      if (!flipped || disabled || !event.isPrimary || event.button !== 0) return;
      spring.current?.stop();
      pointer.current = {id:event.pointerId,x:event.clientX,y:event.clientY};
    }}
    onPointerMove={move} onPointerUp={release}
    onPointerCancel={event => release(event, true)}
    onLostPointerCapture={event => {
      // Transferring implicit touch capture from the card text bubbles this event.
      if (event.target === event.currentTarget) release(event, true);
    }}>
    <button type="button" disabled={disabled} className="flip-tile"
      aria-label={flipped ? 'Перевернути картку до запитання' : 'Показати відповідь'}
      onClick={() => {
        if (Date.now() - lastDrag.current > 250) onFlip();
      }}>
      <m.span className="flip-inner" animate={{rotateY:reduce ? 0 : flipped ? 180 : 0}}
        transition={{type:'spring',stiffness:180,damping:24}}>
        {faces.map(face => <span className={`flip-face ${face.back ? 'flip-back' : ''} ${reduce ? (flipped === face.back ? 'reduce-show' : 'reduce-hide') : ''}`}
          key={String(face.back)} aria-hidden={flipped !== face.back}>
          <span className="tag">{word.category}</span>
          <strong lang={face.lang}>{face.text}</strong>
          {face.back && word.example && <span className="flip-caption" lang="ko">{word.example}</span>}
          <span className="flip-hint"><RotateCw size={14}/>{face.back ? 'Перевернути' : 'Показати відповідь'}</span>
        </span>)}
      </m.span>
    </button>
    </m.div>
    <m.span className="swipe-indicator swipe-left" style={{opacity:left}} aria-hidden="true"><ArrowLeft size={20}/>Ще вчу</m.span>
    <m.span className="swipe-indicator swipe-right" style={{opacity:right}} aria-hidden="true">Знаю<ArrowRight size={20}/></m.span>
  </div>;
}

export function Cards() {
  const words = useLiveQuery(() => db.words.toArray());
  const seen = useLiveQuery(async () => ({done:(await db.settings.get(tutorialKey))?.value === 'yes'}));
  const [reverse, setReverse] = useState(false);
  const [revealed, setRevealed] = useState<string>();
  const [all, setAll] = useState(false);
  const [reviewed, setReviewed] = useState(new Set<string>());
  const [since, setSince] = useState(Date.now);
  const [busy, setBusy] = useState(false);
  const [direction, setDirection] = useState<Direction>(1);
  const [help, setHelp] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const lock = useRef(false);
  const helpId = useId();
  const reduce = useReducedMotion();
  const queue = (words ?? []).filter(word => !reviewed.has(word.id) && (all || word.due <= since));
  const word = queue[0];
  const flipped = !!word && revealed === word.id;

  useEffect(() => {
    if (word && seen && !seen.done && !dismissed) setHelp(true);
  }, [word, seen, dismissed]);

  function closeHelp() {
    setHelp(false);
    setDismissed(true);
    if (!seen?.done) void db.settings.put({key:tutorialKey,value:'yes'}).catch(() =>
      toast('Не вдалося зберегти перегляд інструкції.', 'error'));
  }

  async function rate(next: Direction) {
    if (!word || !flipped || lock.current) return false;
    lock.current = true;
    setBusy(true);
    setDirection(next);
    unlockSound();
    speech.stop();
    try {
      const result = await rateWord(word.id, next === 1 ? 'good' : 'again');
      reactToAction(result);
      if (result.level === result.beforeLevel && !result.badges.length) playSound(next === 1 ? 'correct' : 'error');
      setReviewed(previous => new Set([...previous, word.id]));
      setRevealed(undefined);
      return true;
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : 'Не вдалося зберегти повторення.', 'error');
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  if (!words) return <Skeleton/>;
  function restart(useAll: boolean) {
    setAll(useAll);
    setSince(Date.now());
    setReviewed(new Set());
    setRevealed(undefined);
  }
  const tutorial = help && <Dialog titleId={helpId} onClose={closeHelp} className="swipe-tutorial">
    <h2 id={helpId}>Як повторювати картки</h2>
    <p>Торкнися картки, щоб відкрити відповідь. Потім свайпни або натисни одну з кнопок.</p>
    <div className="swipe-demo" aria-hidden="true">
      <ArrowLeft size={22}/><span className="swipe-demo-card" lang="ko">안녕</span><ArrowRight size={22}/>
    </div>
    <dl><div><dt>← Ще вчу</dt><dd>Повторення через 10 хвилин.</dd></div>
      <div><dt>Знаю →</dt><dd>Довший інтервал до повторення.</dd></div></dl>
    <button className="btn" onClick={closeHelp}>Зрозуміло</button>
  </Dialog>;
  const toolbar = <div className="learning-topline">
    <Link className="icon-btn" to="/words" aria-label="До словника"><ArrowLeft size={20}/></Link>
    <h1>Картки {word && <span>{reviewed.size + 1}/{reviewed.size + queue.length}</span>}</h1>
    <div className="learning-top-actions">
      {word && reverse === flipped && <SpeakButton text={word.korean} label="Озвучити слово на картці" repeatButton={false}/>}
      {word && flipped && word.example && <SpeakButton text={word.example} label="Озвучити приклад речення" repeatButton={false}/>}
      <button className="icon-btn" aria-label="Як користуватися картками" onClick={() => setHelp(true)}><CircleHelp size={20}/></button>
      <CompactMenu label="Налаштування карток">
        <label>Напрямок<select value={reverse ? 'reverse' : 'forward'} onChange={event => {
          setReverse(event.target.value === 'reverse'); setRevealed(undefined);
        }}><option value="forward">한국어 → Українська</option><option value="reverse">Українська → 한국어</option></select></label>
        <label className="compact-checkbox"><input type="checkbox" checked={all} disabled={busy}
          onChange={event => restart(event.target.checked)}/>Усі слова</label>
        <SpeechSpeed/>
      </CompactMenu>
    </div>
  </div>;

  if (!word && !reviewed.size) return <div className="cards-empty">
    {toolbar}{tutorial}
    <EmptyState title={words.length ? 'На сьогодні картки повторено' : 'Словник поки порожній'}
      text={words.length ? 'Можна переглянути всю колекцію.' : 'Слова зі словника з’являться тут.'}>
      {words.length ? <button className="btn secondary" onClick={() => restart(true)}>Переглянути всі слова</button>
        : <Link className="btn" to="/words">Додати слово</Link>}
    </EmptyState>
  </div>;

  return <LearningScreen className="flash-screen" toolbar={toolbar} actions={<div className="memory-ratings">
    <button type="button" className="btn secondary" disabled={!flipped || busy} onClick={() => void rate(-1)}><ArrowLeft size={18}/>Ще вчу</button>
    <button type="button" className="btn" disabled={!flipped || busy} onClick={() => void rate(1)}>Знаю<ArrowRight size={18}/></button>
  </div>}>
    {tutorial}
    <AnimatePresence custom={direction} mode="wait" initial={false}>
      {word ? <m.div className="flash-stage" key={word.id}
        initial={{opacity:0,scale:reduce?1:.98}} animate={{opacity:1,scale:1}}
        variants={{dismiss:(swipe: Direction) => ({opacity:0,x:reduce?0:swipe*360,rotate:reduce?0:swipe*9})}}
        exit="dismiss"
        transition={{duration:reduce?0:.2}}>
        <FlipCard word={word} reverse={reverse} flipped={flipped}
          onFlip={() => {speech.stop(); setRevealed(flipped ? undefined : word.id);}}
          disabled={busy} onRate={rate}/>
      </m.div> : <m.div className="flash-complete" key="complete" initial={{opacity:0}} animate={{opacity:1}}>
        <h2>Повторення завершено</h2><p>Опрацьовано карток: {reviewed.size}.</p>
        <button className="btn secondary" onClick={() => restart(all)}>Перевірити чергу повторень</button>
      </m.div>}
    </AnimatePresence>
  </LearningScreen>;
}
