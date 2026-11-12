import {m,useReducedMotion} from 'motion/react';
import {Check,X,ArrowRight,Sparkles} from 'lucide-react';
import type {Attempt} from '../models';
import {Mascot} from './Mascot';
import {SpeakButton} from './Speech';
import {OneShotCelebration} from './GameUI';

export function AnswerFeedback({attempt,exam,xp,combo,last,busy,onNext}:{attempt:Attempt;exam:boolean;xp:number;combo:number;last:boolean;busy:boolean;onNext:()=>void}) {
  const reduce=useReducedMotion();
  return <m.section className={`answer-feedback ${attempt.correct?'answer-success':'answer-support'}`} role="status" initial={{opacity:0,y:reduce?0:10}} animate={{opacity:1,y:0,x:attempt.correct||reduce?0:[0,-5,5,-3,0]}} transition={{type:'tween',duration:.24}}>
    {attempt.correct&&<OneShotCelebration/>}
    <div className="feedback-body">
      <div className="feedback-top"><m.span className="feedback-symbol" initial={{scale:reduce?1:.5}} animate={{scale:1}} transition={{type:'spring',stiffness:230,damping:14}}>{attempt.correct?<Check size={24}/>:<X size={24}/>}</m.span><h2>{attempt.correct?'Правильно':'Є помилка'}</h2><span className="feedback-xp"><Sparkles size={15}/>+{xp} XP</span></div>
      {combo>=3&&attempt.correct&&<span className="combo-pill">{combo} правильних поспіль</span>}
      <div className="feedback-content"><div>{!exam?<>
        <h3 className="spoken-line">{attempt.exercise.answer}<SpeakButton text={attempt.exercise.answer}/></h3>
        {!attempt.correct&&<p className="given-answer">Твоя відповідь: {attempt.given}</p>}
        {attempt.exercise.explanation&&<div className="spoken-line"><p>{attempt.exercise.explanation}</p><SpeakButton text={attempt.exercise.explanation}/></div>}
      </>:<p>Відповідь збережена. Розбір помилок — у підсумку іспиту.</p>}</div><Mascot mood={attempt.correct?combo>=3?'cheer':'happy':'support'} size={70}/></div>
    </div>
    <m.button className="btn feedback-next" whileTap={reduce?{}:{scale:.97}} animate={{backgroundColor:attempt.correct?'#67826B':'#9073A6'}} disabled={busy} onClick={onNext}>{busy?'Зберігаємо…':last?'Завершити':'Далі'}<ArrowRight size={18}/></m.button>
  </m.section>;
}
