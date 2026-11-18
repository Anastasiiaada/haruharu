import {useId, useState} from 'react';
import {useLiveQuery} from 'dexie-react-hooks';
import {BookOpen, ClipboardList, Languages, Search, Trash2} from 'lucide-react';
import {db} from '../services/db';
import {materialTypes, type DuplicateChoices, type MaterialType} from '../services/materialManagement';
import {useMaterialRemoval} from './MaterialRemoval';

const materials = {
  exercises: {name: 'Вправи', action: 'Очистити всі вправи', Icon: ClipboardList},
  words: {name: 'Слова', action: 'Очистити весь словник', Icon: Languages},
  notes: {name: 'Конспекти', action: 'Очистити всі конспекти', Icon: BookOpen},
};
const emptyChoices = (): DuplicateChoices => ({exercises: new Set(), words: new Set(), notes: new Set()});

export function MaterialManagement() {
  const headingId = useId();
  const counts = useLiveQuery(async () => ({
    exercises: await db.exercises.count(),
    words: await db.words.count(),
    notes: await db.notes.count(),
  }));
  const removal = useMaterialRemoval();
  const [choices, setChoices] = useState(emptyChoices);
  const duplicates = removal.preview?.selection === 'duplicates' ? removal.preview : undefined;
  const duplicateCount = materialTypes.reduce((count, type) => count + choices[type].size, 0);

  function toggle(type: MaterialType, id: string) {
    setChoices(previous => {
      const next = new Set(previous[type]);
      if (!next.delete(id)) next.add(id);
      return {...previous, [type]: next};
    });
  }

  return <section className="card topic-summary material-management" aria-labelledby={headingId}>
    <h2 id={headingId}>Керування даними</h2>
    <ul className="material-management-list">
      {materialTypes.map(type => {
        const {name, action, Icon} = materials[type];
        return <li key={type}>
          <span className="material-management-icon"><Icon size={20} aria-hidden="true"/></span>
          <div><strong>{name}</strong><small>Записів: {counts?.[type] ?? '…'}</small></div>
          <button type="button" className="btn secondary" disabled={removal.busy || !counts?.[type]}
            onClick={() => removal.open(type, action)}><Trash2 size={16} aria-hidden="true"/>{action}</button>
        </li>;
      })}
    </ul>
    <button type="button" className="btn secondary" disabled={removal.busy} onClick={() => {
      setChoices(emptyChoices());
      removal.open('duplicates', 'Дублікати матеріалів');
    }}><Search size={17} aria-hidden="true"/>Знайти дублікати</button>
    {removal.feedback}
    {duplicates ? removal.dialog({
      choices,
      count: duplicateCount,
      children: <>
        <p>Позначте копії для видалення. У кожній групі має залишитися щонайменше один запис.</p>
        <div className="material-selection-actions">
          <button type="button" className="btn secondary" disabled={removal.busy} onClick={() => {
            const next = emptyChoices();
            for (const {type, ids} of duplicates.removals) next[type] = new Set(ids);
            setChoices(next);
          }}>Вибрати всі дублікати</button>
          <button type="button" className="btn secondary" disabled={removal.busy || !duplicateCount}
            onClick={() => setChoices(emptyChoices())}>Зняти вибір</button>
        </div>
        <div className="material-duplicate-results">
          {duplicates.removals.filter(({groups}) => groups.length > 0).map(({type, groups, ids}) => <details key={type}>
            <summary>{materials[type].name} · зайвих копій {ids.length}</summary>
            <ul>{groups.map(group => <li key={group.ids[0]}>
              <strong>{group.label}</strong>
              {group.ids.map((id, index) => {
                const checked = choices[type].has(id);
                const last = group.ids.every(other => other === id || choices[type].has(other));
                return <label key={id} className="material-checkbox duplicate-choice">
                  <input type="checkbox" checked={checked} disabled={removal.busy || (!checked && last)}
                    onChange={() => toggle(type, id)}/>
                  <span>Запис {index + 1} · {group.descriptions[index]}{index === 0 && ' · рекомендовано залишити'}</span>
                </label>;
              })}
            </li>)}</ul>
          </details>)}
        </div>
      </>,
    }) : removal.dialog()}
  </section>;
}
