import {useId, useRef, useState, type ReactNode} from 'react';
import {Download, Trash2} from 'lucide-react';
import {previewRemoval, removeMaterials, StaleRemovalPreviewError, type DuplicateChoices, type RemovalPreview, type RemovalSelection} from '../services/materialManagement';
import {exportData} from '../services/transfer';
import {Dialog} from './Dialog';
import './material-management.css';

export function useMaterialRemoval(onRemoved?: () => void) {
  const [request, setRequest] = useState<{preview: RemovalPreview; title: string}>();
  const [busy, setBusy] = useState(false);
  const operation = useRef(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [backupStatus, setBackupStatus] = useState('');
  const dialogId = useId();

  async function run(action: () => Promise<void>, fallback: string) {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof StaleRemovalPreviewError ? cause.message : fallback);
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }

  function open(selection: RemovalSelection, title: string) {
    void run(async () => {
      setStatus('');
      setBackupStatus('');
      setRequest({preview: await previewRemoval(selection), title});
    }, 'Не вдалося перевірити матеріали. Спробуйте ще раз.');
  }

  function close() {
    if (operation.current) return;
    setRequest(undefined);
    setError('');
  }

  function dialog({children, choices, count = request?.preview.count ?? 0}: {
    children?: ReactNode; choices?: DuplicateChoices; count?: number;
  } = {}) {
    if (!request) return null;
    const {preview, title} = request;
    return <Dialog titleId={dialogId} onClose={close} className="material-management-dialog">
      <h2 id={dialogId}>{title}</h2>
      {preview.count > 0 ? <>
        <p>Буде видалено записів: <strong>{count}</strong>.</p>
        {children}
        <p>Історія навчання, XP, нагороди, календар і налаштування збережуться.</p>
        {(preview.selection === 'duplicates' || typeof preview.selection === 'string' ||
          'category' in preview.selection || preview.count > 1) && <div className="material-backup">
          <p>Перед видаленням збережіть резервну копію.</p>
          <button type="button" className="btn secondary" disabled={busy} onClick={() => void run(async () => {
            setBackupStatus('');
            await exportData('backup');
            setBackupStatus('Завантаження резервної копії розпочато.');
          }, 'Не вдалося експортувати резервну копію.')}>
            <Download size={16} aria-hidden="true"/>Експортувати копію
          </button>
          {backupStatus && <small role="status">{backupStatus}</small>}
        </div>}
      </> : <p>{preview.selection === 'duplicates' ? 'Дублікатів не знайдено.' : 'Записів для видалення вже немає.'}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="material-dialog-actions">
        <button type="button" className="btn secondary" disabled={busy} onClick={close}>
          {preview.count ? 'Скасувати' : 'Готово'}
        </button>
        {preview.count > 0 && <button type="button" className="btn danger" disabled={busy || !count}
          onClick={() => void run(async () => {
            await removeMaterials(preview, choices);
            setRequest(undefined);
            setStatus(`Видалено записів: ${count}.`);
            onRemoved?.();
          }, 'Не вдалося видалити матеріали. Спробуйте ще раз.')}>
          <Trash2 size={16} aria-hidden="true"/>Підтвердити видалення
        </button>}
      </div>
    </Dialog>;
  }

  return {
    open, dialog, busy, preview: request?.preview,
    feedback: <>{status && <p role="status">{status}</p>}{!request && error && <p className="error" role="alert">{error}</p>}</>,
  };
}
