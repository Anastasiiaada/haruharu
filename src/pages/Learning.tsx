import {useRef,useState} from 'react';
import {useLiveQuery} from 'dexie-react-hooks';
import {m,AnimatePresence,useMotionValue,useTransform,useReducedMotion} from 'motion/react';
import {Link} from 'react-router-dom';
import {RotateCw,ArrowLeft,ArrowRight,Check,Trophy,Sparkles} from 'lucide-react';
import {db,uid} from '../services/db';
import {normalize} from '../services/learning';
import type {Exercise,Attempt,Word} from '../models';
import {speech} from '../services/speech';
import {SpeakButton,SpeechSpeed} from '../components/Speech';
import {Question} from '../components/PracticeQuestion';
import {AnswerFeedback} from '../components/AnswerFeedback';
import {recordAttempt,rateWord,finishLearningSession} from '../game/service';
import {levelProgress} from '../game/progress';
import {unlockSound,playSound} from '../game/sound';
import {Counter,ProgressBar,EmptyState,OneShotCelebration,reactToAction,Skeleton,toast} from '../components/GameUI';
import {LearningScreen} from '../components/LearningScreen';
import {CompactMenu} from '../components/CompactMenu';
function FlipCard({word,reverse,flipped,onFlip,onRate,disabled}:{word:Word;reverse:boolean;flipped:boolean;onFlip:()=>void;onRate:(rating:'again'|'good')=>void;disabled:boolean}) {
  const x=useMotionValue(0);
  const tilt=useTransform(x,[-160,160],[-9,9]);
  const reduce=useReducedMotion();
  const dragged=useRef(false);
  return <m.div className="flip-gesture" drag={disabled?false:'x'} dragConstraints={{left:0,right:0}} dragElastic={.55} style={{x,rotate:reduce?0:tilt,touchAction:'pan-y'}} onDragStart={()=>{dragged.current=true;unlockSound();}} onDragEnd={(_,info)=>{if(flipped&&Math.abs(info.offset.x)>85&&!disabled)onRate(info.offset.x>0?'good':'again');setTimeout(()=>{dragged.current=false;},0);}}>
    <button type="button" disabled={disabled} className="flip-tile" aria-label={flipped?'Перевернути картку до запитання':'Показати відповідь'} onClick={()=>{if(!dragged.current)onFlip();}}>
      <m.span className="flip-inner" animate={{rotateY:reduce?0:flipped?180:0}} transition={{type:'spring',stiffness:180,damping:24}}>
        {[{text:reverse?word.translation:word.korean,lang:reverse?'uk':'ko',back:false},{text:reverse?word.korean:word.translation,lang:reverse?'ko':'uk',back:true}].map(face=><span className={`flip-face ${face.back?'flip-back':''} ${reduce?(flipped===face.back?'reduce-show':'reduce-hide'):''}`} key={String(face.back)} aria-hidden={flipped!==face.back}>
          <span className="tag">{word.category}</span>
          <strong lang={face.lang}>{face.text}</strong>
          {face.back&&word.example&&<span className="flip-caption" lang="ko">{word.example}</span>}
          <span className="flip-hint"><RotateCw size={14}/>Перевернути</span>
        </span>)}
      </m.span>
    </button>
  </m.div>;
}
export function Cards() {
  const words=useLiveQuery(()=>db.words.toArray());
  const [reverse,setReverse]=useState(false),[flipped,setFlipped]=useState(false),[all,setAll]=useState(false),[index,setIndex]=useState(0),[now,setNow]=useState(Date.now()),[busy,setBusy]=useState(false);
  const [reviewed,setReviewed]=useState(0);
  const lock=useRef(false);
  const reduce=useReducedMotion();
  const queue=(words||[]).filter(w=>all||w.due<=now);
  const word=queue[index%Math.max(1,queue.length)];
  async function rate(rating:'again'|'hard'|'good'|'easy') {
    if(!word||lock.current)return;
    lock.current=true;setBusy(true);unlockSound();speech.stop();
    try {
      const result=await rateWord(word.id,rating);
      reactToAction(result);
      if(!result.xp)toast('Повторення збережено. XP за це слово сьогодні вже твої 🌱');
      if(result.level===result.beforeLevel&&!result.badges.length)playSound(rating==='again'?'error':'correct');
      setFlipped(false);
      if(all)setIndex(i=>i+1);
      setReviewed(value=>value+1);
      setNow(Date.now());
    } catch(e) {toast(e instanceof Error?e.message:'Не вдалося зберегти повторення.','error');}
    finally {lock.current=false;setBusy(false);}
  }
  if(!words)return <Skeleton/>;
  const settings=<CompactMenu label="Налаштування карток">
    <label>Напрямок<select value={reverse?'reverse':'forward'} onChange={event=>{setReverse(event.target.value==='reverse');setFlipped(false);}}><option value="forward">한국어 → Українська</option><option value="reverse">Українська → 한국어</option></select></label>
    <label className="compact-checkbox"><input type="checkbox" checked={all} onChange={event=>{setAll(event.target.checked);setIndex(0);setReviewed(0);setFlipped(false);}}/>Усі слова</label>
    <SpeechSpeed/>
  </CompactMenu>;
  if(!word)return <div className="cards-empty"><div className="learning-topline"><Link className="icon-btn" to="/words" aria-label="До словника"><ArrowLeft size={20}/></Link><h1>Картки</h1>{settings}</div><EmptyState mood={words.length?'cheer':'welcome'} title={words.length?'Картки на сьогодні повторено':'Додай слова для повторення'} text={words.length?'У налаштуваннях можна обрати всі слова.':'Слова зі словника з’являться тут.'}><Link className="btn" to={words.length?'/':'/words'}>{words.length?'На головну':'Додати слово'}</Link></EmptyState></div>;
  const position=all?index%queue.length+1:reviewed+1;
  const total=all?queue.length:reviewed+queue.length;
  return <LearningScreen className="flash-screen" toolbar={<div className="learning-topline">
    <Link className="icon-btn" to="/words" aria-label="До словника"><ArrowLeft size={20}/></Link>
    <h1>Картки <span>{position}/{total}</span></h1>
    <div className="learning-top-actions">{reverse===flipped&&<SpeakButton text={word.korean} label="Озвучити слово на картці" repeatButton={false}/>} {flipped&&word.example&&<SpeakButton text={word.example} label="Озвучити приклад речення" repeatButton={false}/>} {settings}</div>
  </div>} actions={<div className="memory-ratings" aria-label="Оцінка запам’ятовування">
    {(['again','hard','good','easy'] as const).map((rating,i)=><m.button type="button" whileTap={reduce?{}:{scale:.97}} disabled={!flipped||busy} className={`btn rating-${i}`} key={rating} onClick={()=>void rate(rating)}>{['Ще раз','Важкувато','Пам’ятаю','Легко!'][i]}<small>{['10 хв','1 день','довший інтервал','ще довший'][i]}</small></m.button>)}
  </div>}>
    <AnimatePresence mode="wait" initial={false}><m.div className="flash-stage" key={word.id} initial={{opacity:0,x:reduce?0:12}} animate={{opacity:1,x:0}} exit={{opacity:0,x:reduce?0:-12}} transition={{duration:reduce?0:.15}}>
      <FlipCard word={word} reverse={reverse} flipped={flipped} onFlip={()=>setFlipped(!flipped)} disabled={busy} onRate={rating=>void rate(rating)}/>
    </m.div></AnimatePresence>
  </LearningScreen>;
}

export function Session({questions,exam=false,onFinish}:{questions:Exercise[];exam?:boolean;onFinish:()=>void}){const [sessionId]=useState(uid);const [index,setIndex]=useState(0),[results,setResults]=useState<Attempt[]>([]),[feedback,setFeedback]=useState<Attempt|null>(null),[done,setDone]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[earned,setEarned]=useState(0),[lastXP,setLastXP]=useState(0),[totalXP,setTotalXP]=useState(0);const lock=useRef(false);const current=questions[index];const reduce=useReducedMotion();async function answer(given:string){if(lock.current||feedback)return;lock.current=true;setBusy(true);unlockSound();speech.stop();try{const attempt:Attempt={id:`${sessionId}:${index}`,exercise:current,given,correct:normalize(given)===normalize(current.answer),date:new Date().toISOString()};const action=await recordAttempt(attempt);setResults(r=>[...r,attempt]);setEarned(n=>n+action.xp);setLastXP(action.xp);setTotalXP(action.totalXP);setFeedback(attempt);reactToAction(action);if(action.level===action.beforeLevel&&!action.badges.length)playSound(attempt.correct?'correct':'error');setError('');}catch(e){setError(e instanceof Error?e.message:'Не вдалося зберегти відповідь.');}finally{lock.current=false;setBusy(false);}}async function next(){if(lock.current)return;lock.current=true;setBusy(true);unlockSound();speech.stop();try{if(index+1===questions.length){const action=await finishLearningSession(sessionId,results.map(a=>a.id),questions.length,exam);setEarned(n=>n+action.xp);setTotalXP(action.totalXP);reactToAction(action);if(action.level===action.beforeLevel&&!action.badges.length)playSound('complete');setDone(true);}else{setIndex(i=>i+1);setFeedback(null);}setError('');}catch(e){setError(e instanceof Error?e.message:'Не вдалося завершити заняття.');}finally{lock.current=false;setBusy(false);}}
if(!current)return <EmptyState title="Ці завдання ще підростають" text="Додай слова або обери іншу тему для практики."><button className="btn" onClick={onFinish}>Обрати тему</button></EmptyState>;
const score=results.filter(a=>a.correct).length;const combo=[...results].reverse().findIndex(a=>!a.correct);const consecutive=combo===-1?results.length:combo;const level=levelProgress(totalXP);
if(done)return <LearningScreen className="result-screen" toolbar={<div className="learning-topline"><h1>{exam?'Результат іспиту':'Заняття завершено'}</h1><Trophy size={21}/></div>} actions={<button className="btn" onClick={onFinish}>До тем<ArrowRight size={18}/></button>}>
  <OneShotCelebration big/>
  <div className="result-overview">
    <div className="result-metrics"><div><strong><Counter value={score}/><small>/{results.length}</small></strong><span>Правильних</span></div><div><strong>+<Counter value={earned}/></strong><span>XP</span></div><div><strong>{level.level}</strong><span>Рівень</span></div></div>
    <div className="result-level"><span>Ще {level.remaining} XP до рівня {level.level+1}</span><ProgressBar value={level.current} max={level.required} label="Прогрес рівня після заняття"/></div>
  </div>
  {results.some(attempt=>!attempt.correct)&&<div className="result-errors"><h2>Розбір помилок</h2>{results.filter(attempt=>!attempt.correct).map(attempt=><article className="review-error" key={attempt.id}><b>{attempt.exercise.prompt}</b><p>Твоя відповідь: {attempt.given}</p><p className="spoken-line">Правильно: {attempt.exercise.answer}<SpeakButton text={attempt.exercise.answer}/></p><small>{attempt.exercise.explanation}</small></article>)}</div>}
</LearningScreen>;
return <LearningScreen className="session-screen" toolbar={<>
  <div className="learning-topline"><button className="icon-btn" aria-label="До тем" onClick={onFinish}><ArrowLeft size={20}/></button><h1>{exam?'Іспит':'Практика'} <span>{index+1}/{questions.length}</span></h1><span className="session-xp">+{earned} XP</span><CompactMenu label="Налаштування озвучування"><SpeechSpeed/></CompactMenu></div>
  <ProgressBar value={index+(feedback?1:0)} max={questions.length} label="Прогрес заняття" color="mint"/>
</>} actions={error?<p className="error" role="alert">{error}</p>:null}>
  <AnimatePresence mode="wait" initial={false}><m.div className="question-stage" key={feedback?`feedback-${index}`:`question-${index}`} initial={{opacity:0,y:reduce?0:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:reduce?0:-6}} transition={{duration:.15}}>
    {feedback?<AnswerFeedback attempt={feedback} exam={exam} xp={lastXP} combo={consecutive} last={index+1===questions.length} busy={busy} onNext={()=>void next()}/>:<section className="card exercise" aria-busy={busy}><Question key={current.id+'-'+index} exercise={current} exam={exam} busy={busy} onAnswer={given=>void answer(given)}/></section>}
  </m.div></AnimatePresence>
</LearningScreen>;
}