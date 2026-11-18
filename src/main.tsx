import React,{Component,type ReactNode} from 'react';import {createRoot} from 'react-dom/client';import App from './App';import {db,initialize} from './services/db';import './styles.css';
import './calendar/calendar.css';
class ErrorBoundary extends Component<{children:ReactNode},{error:string}>{state={error:''};static getDerivedStateFromError(error:Error){return {error:error.message};}render(){return this.state.error?<div className="startup"><h1>Не вдалося відкрити застосунок</h1><p>{this.state.error}</p><p>Перевірте, чи дозволено локальне сховище у браузері.</p><button className="btn" onClick={()=>location.reload()}>Спробувати ще раз</button></div>:this.props.children;}}
const root = createRoot(document.getElementById('root')!);
root.render(<div className="startup">✿ Завантажуємо твій простір…</div>);
void db.settings.get('theme').then(setting => {
  document.documentElement.dataset.theme = setting?.value === 'dark' ? 'dark' : 'light';
}).catch(() => {});
initialize(db, (done, total) => root.render(<div className="startup startup-pack">
  <p>Готуємо навчальні матеріали A1…</p>
  <progress aria-label="Встановлення матеріалів A1" value={done} max={total}/>
  <p>{done} / {total}</p>
</div>))
  .then(() => root.render(<React.StrictMode><ErrorBoundary><App/></ErrorBoundary></React.StrictMode>))
  .catch(error => root.render(<div className="startup">
    <h1>Не вдалося підготувати матеріали</h1><p>{String(error)}</p>
    <button className="btn" onClick={() => location.reload()}>Спробувати ще раз</button>
  </div>));

import './help/help.css';

import './game/design-system.css';

import './components/mobile-learning.css';

import './components/native-mobile.css';
import './components/ux-refinements.css';
import './components/theme-contrast.css';
