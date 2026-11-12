import {useEffect,useState} from 'react';
import {useRegisterSW} from 'virtual:pwa-register/react';
import {Download,RefreshCw,X} from 'lucide-react';
export function PwaUpdatePrompt() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [deferred, setDeferred] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration>();
  const {needRefresh: [needRefresh], updateServiceWorker} = useRegisterSW({
    onRegisteredSW(_url, registered) { setRegistration(registered); },
    onRegisterError() {
      setError('Не вдалося перевірити оновлення. Застосунок можна використовувати далі.');
    },
  });

  useEffect(() => {
    if (!registration) return;
    const check = () => {
      if (navigator.onLine && document.visibilityState === 'visible') {
        void registration.update().catch(() => {});
      }
    };
    const resume = () => { setDeferred(false); check(); };
    const interval = window.setInterval(check, 60 * 60 * 1000);
    window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('online', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [registration]);

  async function update() {
    // Keep open drafts and in-progress sessions alive until the user finishes them.
    if (document.querySelector('form, [contenteditable="true"], .lesson-study, .overlay')) {
      setError('Спершу збережи та закрий відкриту форму або заверши заняття. Потім натисни «Оновити зараз».');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await updateServiceWorker(true);
    } catch {
      setError('Не вдалося оновити. Спробуй ще раз із мережею.');
    } finally {
      setBusy(false);
    }
  }

  if (deferred || (!needRefresh && !error)) return null;
  return <aside className="pwa-update" role="status">
    <button type="button" className="close" aria-label="Відкласти оновлення" onClick={() => setDeferred(true)}><X size={17}/></button>
    <div className="section-title"><Download size={20}/><h2>{needRefresh ? 'Оновлення готове 🌸' : 'Оновлення зачекає'}</h2></div>
    <p>{error || 'Спершу збережи відкриті форми або заверши вправу. Оновлення перезавантажить сторінку. Збережені матеріали залишаться на цьому пристрої.'}</p>
    {needRefresh && <div className="tools">
      <button type="button" className="btn" disabled={busy} onClick={() => void update()}><RefreshCw size={15}/>{busy ? 'Оновлюємо…' : 'Оновити зараз'}</button>
      <button type="button" className="text-btn" onClick={() => setDeferred(true)}>Пізніше</button>
    </div>}
  </aside>;
}
