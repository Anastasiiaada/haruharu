import {useMemo, useState} from 'react';
import {m} from 'motion/react';
import {ArrowRight} from 'lucide-react';
import type {Exercise} from '../models';
import {shuffle} from '../services/learning';
import {SpeakButton} from './Speech';
import {labels} from '../game/labels';

export function Question({exercise, onAnswer, busy = false, exam = false}: {
  exercise: Exercise; onAnswer: (given: string) => void; busy?: boolean; exam?: boolean;
}) {
  const [given, setGiven] = useState('');
  const [tokens, setTokens] = useState<number[]>([]);
  const scrambled = useMemo(() => shuffle((exercise.tokens ?? []).map((text, id) => ({text, id}))), [exercise]);
  const sentence = exercise.kind === 'sentence';
  const canSubmit = !busy && (sentence ? tokens.length > 0 && (!exam || tokens.length === scrambled.length) : !!given.trim());

  return <form className="question-form" onSubmit={event => {
    event.preventDefault();
    if (canSubmit) onAnswer(sentence ? tokens.map(id => exercise.tokens?.[id]).join(' ') : given);
  }}>
    <div className="question-body">
      <span className="tag">{labels[exercise.kind]} · {exercise.topic}{exercise.demo ? ' · Демо' : ''}</span>
      <h2 className="question spoken-line">{exercise.prompt}{!exam && <SpeakButton text={exercise.prompt}/>}</h2>
      {exercise.kind === 'dictation' && <SpeakButton text={exercise.audio || exercise.answer} label="Прослухати диктант"/>}
      {sentence ? <>
        <div className="sentence-answer">
          {tokens.map((id, index) => <button type="button" key={id} disabled={busy}
            onClick={() => setTokens(tokens.filter((_, position) => position !== index))}>{exercise.tokens?.[id]} ×</button>)}
          {!tokens.length && <span>Торкнися слів у правильному порядку</span>}
        </div>
        <div className="tokens">{scrambled.map(token => <span className="token-audio" key={token.id}>
          <button type="button" disabled={busy || tokens.includes(token.id)} onClick={() => setTokens([...tokens, token.id])}>{token.text}</button>
          {!exam && <SpeakButton text={token.text}/>}
        </span>)}</div>
      </> : exercise.options ? <div className="options">{exercise.options.map((option, index) => <div className="option-audio" key={index}>
        <button type="button" className={given === option ? 'chosen' : ''} aria-pressed={given === option} disabled={busy}
          onClick={() => setGiven(option)}><span>{index + 1}</span>{option}</button>
        {!exam && <SpeakButton text={option}/>}
      </div>)}</div> : <input className="answer-input" lang="ko" autoComplete="off"
        autoCorrect={exam ? 'off' : undefined} autoCapitalize={exam ? 'none' : undefined} spellCheck={exam ? false : undefined}
        aria-label="Ваша відповідь" placeholder="Ваша відповідь…" value={given} readOnly={busy}
        onChange={event => setGiven(event.target.value)}/>}
      {!exam && exercise.explanation && exercise.kind !== 'dictation' && <details className="practice-hint">
        <summary>Підказка</summary><p>{exercise.explanation}</p>
      </details>}
    </div>
    <m.button className="btn answer-submit" whileTap={{scale:.97}}
      animate={{backgroundColor:busy?'#B8A2C8':'#9879B1'}} disabled={!canSubmit}>
      {busy ? 'Зберігаємо…' : exam ? 'Зберегти відповідь' : 'Перевірити'}<ArrowRight size={17}/>
    </m.button>
  </form>;
}
