import {useId, useRef, useState} from 'react';
import {Download, Upload} from 'lucide-react';
import type {Bundle} from '../models';
import {exportData, importData, parseFile} from '../services/transfer';
import {Dialog} from './Dialog';

export function Transfer({type}: {type: Bundle['type']}) {
  const input = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const [preview, setPreview] = useState<Bundle | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function close() {
    if (busy) return;
    setPreview(null);
    setError('');
  }

  async function confirmImport() {
    if (!preview || busy) return;
    setBusy(true);
    setError('');
    try {
      await importData(preview);
      setPreview(null);
    } catch (cause) {
      setError(String(cause));
    } finally {
      setBusy(false);
    }
  }

  return <>
    <button type="button" className="btn secondary" onClick={() => {
      setError('');
      void exportData(type).catch(cause => setError(String(cause)));
    }}><Download size={16}/>Експорт</button>
    <button type="button" className="btn secondary" onClick={() => input.current?.click()}><Upload size={16}/>Імпорт</button>
    <input ref={input} hidden type="file" accept="application/json,.json" aria-label="Файл JSON" onChange={async event => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = '';
      if (!file) return;
      setError('');
      try {
        const bundle = await parseFile(file);
        if (bundle.type !== type) throw new Error(`Потрібен файл типу ${type}.`);
        setPreview(bundle);
      } catch (cause) {
        setError(String(cause));
      }
    }}/>
    {!preview && error && <p className="error" role="alert">{error}</p>}
    {preview && <Dialog titleId={titleId} onClose={close} className="transfer-preview">
      <h2 id={titleId}>Попередній перегляд імпорту</h2>
      <dl className="transfer-counts">
        <div><dt>Конспектів</dt><dd>{preview.notes.length}</dd></div>
        <div><dt>Слів</dt><dd>{preview.words.length}</dd></div>
        <div><dt>Вправ</dt><dd>{preview.exercises.length}</dd></div>
      </dl>
      {type === 'backup' && <p>Також буде додано {preview.localEvents.length} локальних подій, {preview.calendarSources.length} джерел календаря, {preview.attempts.length} відповідей та {preview.exams.length} іспитів. Тему буде відновлено. Повторний імпорт створить копії матеріалів.</p>}
      <ul className="preview-list">
        {[...preview.notes.map(note => note.title), ...preview.words.map(word => `${word.korean} — ${word.translation}`),
          ...preview.exercises.map(exercise => exercise.prompt)].slice(0, 15).map((label, index) => <li key={index}>{label}</li>)}
      </ul>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="button" className="btn" disabled={busy} onClick={() => void confirmImport()}>
        {busy ? 'Збереження…' : 'Додати до бібліотеки'}
      </button>
    </Dialog>}
  </>;
}
