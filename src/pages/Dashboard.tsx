import {useLiveQuery} from 'dexie-react-hooks';
import {Link} from 'react-router-dom';
import {ArrowRight, BookOpen, CheckCircle2, Flame, Layers, PenLine} from 'lucide-react';
import {db} from '../services/db';
import {currentStreak, dailyActions, dailyGoal, gameDay, learningDays} from '../game/progress';
import {GoalSelector, ProgressBar, Skeleton} from '../components/GameUI';
import {Mascot} from '../components/Mascot';

export function Dashboard() {
  const data = useLiveQuery(async () => ({
    words: await db.words.toArray(), notes: await db.notes.count(), exercises: await db.exercises.count(),
    attempts: await db.attempts.toArray(), rewards: await db.rewards.toArray(), goal: await db.settings.get('dailyGoal'),
  }));
  if (!data) return <Skeleton/>;
  const {words, attempts, rewards} = data;
  const today = gameDay();
  const goal = dailyGoal(data.goal?.value);
  const completed = dailyActions(attempts, rewards, today);
  const streak = currentStreak(learningDays(attempts, rewards), today);
  const due = words.filter(word => word.due <= Date.now()).length;
  const accuracy = attempts.length ? Math.round(attempts.filter(attempt => attempt.correct).length / attempts.length * 100) : null;

  return <div className="day-overview">
    <div className="page-heading"><h1><span lang="ko">안녕!</span> Твій день</h1></div>
    <section className="card day-start">
      <div>
        <h2>Почати навчання</h2>
        <Link className="btn" to="/practice">До практики<ArrowRight size={18}/></Link>
      </div>
      <Mascot mood={streak ? 'happy' : 'welcome'} size={116}/>
    </section>
    <section className="card day-goal">
      <div className="day-goal-heading"><h2>Щоденна ціль</h2><strong>{completed} / {goal}</strong></div>
      <ProgressBar value={completed} max={goal} label="Щоденна ціль" color="mint"/>
      <GoalSelector/>
    </section>
    <div className="day-stats" aria-label="Статистика навчання">
      <Link className="card day-stat" to="/cards"><Layers size={20}/><strong>{due}</strong><span>Картки на сьогодні</span></Link>
      <Link className="card day-stat" to="/statistics"><Flame size={20}/><strong>{streak}</strong><span>Днів поспіль</span></Link>
      <Link className="card day-stat" to="/statistics"><CheckCircle2 size={20}/><strong>{accuracy === null ? '—' : `${accuracy}%`}</strong><span>Точність</span></Link>
    </div>
    <nav className="card day-library" aria-label="Навчальні матеріали">
      <Link to="/words"><Layers size={18}/>Слів: {words.length}</Link>
      <Link to="/practice"><PenLine size={18}/>Вправ: {data.exercises}</Link>
      <Link to="/notes"><BookOpen size={18}/>Конспектів: {data.notes}</Link>
    </nav>
  </div>;
}
