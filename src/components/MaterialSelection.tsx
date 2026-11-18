import {useState, type ReactNode} from 'react';
import {Trash2} from 'lucide-react';
import type {MaterialType} from '../services/materialManagement';
import {useMaterialRemoval} from './MaterialRemoval';

export function useMaterialSelection(type: MaterialType, records: {id: string}[]) {
  const [active, setActive] = useState(false);
  const [ids, setIds] = useState(new Set<string>());
  const selected = new Set(records.filter(record => ids.has(record.id)).map(record => record.id));

  function cancel() {
    setIds(new Set());
    setActive(false);
  }

  const removal = useMaterialRemoval(cancel);
  function toggle(id: string) {
    setIds(previous => {
      const next = new Set(previous);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  function removeOne(id: string, label: string) {
    removal.open({type, ids: [id]}, `Видалити «${label}»?`);
  }

  function toolbar(filtered: {id: string}[], category?: string, topic = false) {
    const filteredSelected = filtered.filter(record => selected.has(record.id)).length;
    const hiddenSelected = selected.size - filteredSelected;
    const categoryLabel = topic ? 'Видалити всі вправи теми' : 'Видалити всі записи категорії';
    return <div className="material-selection">
      {active && <strong role="status">Вибрано: {selected.size}{hiddenSelected > 0 && ` · поза фільтром: ${hiddenSelected}`}</strong>}
      <div className="material-selection-actions">
        {active ? <>
          <button type="button" className="btn secondary" disabled={filteredSelected === filtered.length}
            onClick={() => setIds(previous => new Set([...previous, ...filtered.map(record => record.id)]))}>Вибрати всі</button>
          <button type="button" className="btn secondary" disabled={!selected.size} onClick={() => setIds(new Set())}>Зняти вибір</button>
          <button type="button" className="btn danger" disabled={removal.busy || !selected.size}
            onClick={() => removal.open({type, ids: [...selected]}, 'Видалити вибрані записи?')}>
            <Trash2 size={16} aria-hidden="true"/>Видалити вибрані
          </button>
          <button type="button" className="btn secondary" onClick={cancel}>Скасувати</button>
        </> : <button type="button" className="btn secondary" disabled={!records.length} onClick={() => setActive(true)}>Вибрати</button>}
        {category !== undefined && <button type="button" className="btn secondary" disabled={removal.busy}
          onClick={() => removal.open({type, category}, `${categoryLabel} «${category}»?`)}>{categoryLabel}</button>}
      </div>
      {removal.feedback}
    </div>;
  }

  return {active, selected, toggle, removeOne, toolbar, dialog: removal.dialog()};
}

export function SelectableMaterial({checked, onChange, children}: {
  checked: boolean; onChange: () => void; children: ReactNode;
}) {
  return <label className="card material-checkbox selectable-material">
    <input type="checkbox" checked={checked} onChange={onChange}/>
    <span>{children}</span>
  </label>;
}

const pageSize = 24;

export function useMaterialPage<T>(records: T[], filterKey: string) {
  const [state, setState] = useState({filterKey, index: 0});
  const total = Math.ceil(records.length / pageSize);
  const index = state.filterKey === filterKey ? Math.max(0, Math.min(state.index, total - 1)) : 0;
  const page = records.slice(index * pageSize, (index + 1) * pageSize);
  const pagination = total > 1 && <nav className="material-pagination" aria-label="Сторінки матеріалів">
    <button type="button" className="btn secondary" disabled={index === 0}
      onClick={() => setState({filterKey, index: index - 1})}>Назад</button>
    <span aria-live="polite">{index + 1} / {total}</span>
    <button type="button" className="btn secondary" disabled={index === total - 1}
      onClick={() => setState({filterKey, index: index + 1})}>Далі</button>
  </nav>;
  return {page, pagination};
}
