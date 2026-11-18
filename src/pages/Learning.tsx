import {useCallback, useEffect, useRef, useState} from 'react';
import {m, AnimatePresence, useReducedMotion} from 'motion/react';
import {ArrowLeft, ArrowRight, Trophy} from 'lucide-react';
import {uid} from '../services/db';
import {normalize} from '../services/learning';
import type {Exercise, Attempt} from '../models';
import {speech} from '../services/speech';
import {SpeakButton, SpeechSpeed} from '../components/Speech';
import {Question} from '../components/PracticeQuestion';
import {AnswerFeedback} from '../components/AnswerFeedback';
import {recordAttempt, finishLearningSession} from '../game/service';
import {levelProgress} from '../game/progress';
import {unlockSound, playSound} from '../game/sound';
import {Counter, ProgressBar, EmptyState, OneShotCelebration, reactToAction} from '../components/GameUI';
import {LearningScreen} from '../components/LearningScreen';
import {CompactMenu} from '../components/CompactMenu';

export function Session({questions, exam = false, timerMinutes = 0, title = 'Практика', onFinish}: {
  questions: Exercise[]; exam?: boolean; timerMinutes?: number; title?: string; onFinish: () => void;
}) {
  const [sessionId] = useState(uid);
  const [deadline] = useState(() => exam && timerMinutes > 0 ? Date.now() + timerMinutes * 60_000 : null);
  const [remaining, setRemaining] = useState(timerMinutes * 60);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Attempt[]>([]);
  const [feedback, setFeedback] = useState<Attempt | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [earned, setEarned] = useState(0);
  const [lastXP, setLastXP] = useState(0);
  const [totalXP, setTotalXP] = useState(0);
  const lock = useRef(false);
  const triedTimeout = useRef(false);
  const current = questions[index];
  const reduce = useReducedMotion();
  const expired = deadline !== null && remaining === 0;

  useEffect(() => {
    if (deadline === null || done) return;
    const tick = () => setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    const timer = window.setInterval(tick, 250);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [deadline, done]);

  async function answer(given: string) {
    if (lock.current || feedback || !current || (deadline !== null && Date.now() >= deadline)) return;
    lock.current = true;
    setBusy(true);
    unlockSound();
    speech.stop();
    try {
      const attempt: Attempt = {
        id: `${sessionId}:${index}`, exercise: current, given,
        correct: normalize(given) === normalize(current.answer), date: new Date().toISOString(),
      };
      const action = await recordAttempt(attempt);
      setResults(previous => [...previous, attempt]);
      setEarned(previous => previous + action.xp);
      setLastXP(action.xp);
      setTotalXP(action.totalXP);
      setFeedback(attempt);
      if (!exam) {
        reactToAction(action);
        if (action.level === action.beforeLevel && !action.badges.length) playSound(attempt.correct ? 'correct' : 'error');
      }
      setError('');
    } catch {
      setError('Не вдалося зберегти відповідь. Спробуй ще раз.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  const finish = useCallback(async (timedOut = false) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    speech.stop();
    try {
      const action = await finishLearningSession(sessionId, results.map(attempt => attempt.id), questions.length, exam, timedOut);
      setEarned(previous => previous + action.xp);
      setTotalXP(action.totalXP);
      setDone(true);
      reactToAction(action);
      if (action.level === action.beforeLevel && !action.badges.length) playSound('complete');
      setError('');
    } catch {
      setError('Не вдалося зберегти результат. Спробуй ще раз.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }, [exam, questions.length, results, sessionId]);

  useEffect(() => {
    if (!expired || done || busy || lock.current || triedTimeout.current) return;
    triedTimeout.current = true;
    void finish(true);
  }, [expired, done, busy, finish]);

  function next() {
    if (lock.current || !feedback) return;
    if (index + 1 === questions.length) void finish();
    else {
      speech.stop();
      setIndex(previous => previous + 1);
      setFeedback(null);
      setError('');
    }
  }

  if (!current) return <EmptyState title="Завдань немає" text="Обери іншу тему або додай матеріали.">
    <button className="btn" onClick={onFinish}>До режимів практики</button>
  </EmptyState>;

  const score = results.filter(attempt => attempt.correct).length;
  const combo = [...results].reverse().findIndex(attempt => !attempt.correct);
  const level = levelProgress(totalXP);
  const timer = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
  if (done) return <LearningScreen className="result-screen"
    toolbar={<div className="learning-topline"><h1>{exam ? 'Результат іспиту' : 'Заняття завершено'}</h1><Trophy size={21}/></div>}
    actions={<button className="btn" onClick={onFinish}>До режимів практики<ArrowRight size={18}/></button>}>
    <OneShotCelebration big/>
    <div className="result-overview">
      <div className="result-metrics">
        <div><strong><Counter value={score}/><small>/{questions.length}</small></strong><span>Правильних</span></div>
        <div><strong>{Math.round(score / questions.length * 100)}%</strong><span>Точність</span></div>
        <div><strong>+<Counter value={earned}/></strong><span>XP</span></div>
      </div>
      <div className="result-level"><span>Ще {level.remaining} XP до рівня {level.level + 1}</span>
        <ProgressBar value={level.current} max={level.required} label="Прогрес рівня після заняття"/></div>
      {results.length < questions.length && <p>Час вичерпано. Без відповіді: {questions.length - results.length}.</p>}
    </div>
    {results.some(attempt => !attempt.correct) && <div className="result-errors"><h2>Розбір помилок</h2>
      {results.filter(attempt => !attempt.correct).map(attempt => <article className="review-error" key={attempt.id}>
        <b>{attempt.exercise.prompt}</b><p>Твоя відповідь: {attempt.given}</p>
        <p className="spoken-line">Правильно: {attempt.exercise.answer}<SpeakButton text={attempt.exercise.answer}/></p>
        <small>{attempt.exercise.explanation}</small>
      </article>)}
    </div>}
  </LearningScreen>;

  return <LearningScreen className={`session-screen${exam ? ' exam-in-progress' : ''}`} toolbar={<>
    <div className="learning-topline">
      <button className="icon-btn" aria-label="До тем" onClick={onFinish}><ArrowLeft size={20}/></button>
      <h1>{exam ? 'Іспит' : title} <span>{index + 1}/{questions.length}</span></h1>
      {deadline !== null && <span className="session-timer" role="timer" aria-label="Час до завершення">{timer}</span>}
      {!exam && <span className="session-xp">+{earned} XP</span>}
      <CompactMenu label="Налаштування озвучування"><SpeechSpeed/></CompactMenu>
    </div>
    <ProgressBar value={results.length} max={questions.length} label="Прогрес заняття" color="mint"/>
  </>} actions={error ? <p className="error" role="alert">{error}</p> : null}>
    <AnimatePresence mode="wait" initial={false}>
      <m.div className="question-stage" key={expired ? 'expired' : feedback ? `feedback-${index}` : `question-${index}`}
        initial={{opacity:0,y:reduce?0:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:reduce?0:-6}} transition={{duration:.15}}>
        {expired ? <section className="card exam-feedback">
          <h2>Час вичерпано</h2>
          <button className="btn" disabled={busy} onClick={() => void finish(true)}>{busy ? 'Зберігаємо…' : 'Показати результат'}</button>
        </section> : feedback ? exam ? <section className="card exam-feedback">
          <h2>Відповідь збережено</h2>
          <button className="btn" disabled={busy} onClick={next}>{index + 1 === questions.length ? 'Завершити' : 'Далі'}<ArrowRight size={18}/></button>
        </section> : <AnswerFeedback attempt={feedback} exam={false} xp={lastXP} combo={combo === -1 ? results.length : combo}
          last={index + 1 === questions.length} busy={busy} onNext={next}/>
          : <section className="card exercise" aria-busy={busy}>
            <Question key={`${current.id}-${index}`} exercise={current} exam={exam} busy={busy} onAnswer={given => void answer(given)}/>
          </section>}
      </m.div>
    </AnimatePresence>
  </LearningScreen>;
}
