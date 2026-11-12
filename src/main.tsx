import React,{Component,type ReactNode} from 'react';import {createRoot} from 'react-dom/client';import App from './App';import {initialize} from './services/db';import './styles.css';
import './calendar/calendar.css';
class ErrorBoundary extends Component<{children:ReactNode},{error:string}>{state={error:''};static getDerivedStateFromError(error:Error){return {error:error.message};}render(){return this.state.error?<div className="startup"><h1>Не вдалося відкрити застосунок</h1><p>{this.state.error}</p><p>Перевірте, чи дозволено локальне сховище у браузері.</p><button className="btn" onClick={()=>location.reload()}>Спробувати ще раз</button></div>:this.props.children;}}
const root=createRoot(document.getElementById('root')!);root.render(<div className="startup">✿ Завантажуємо твій простір…</div>);initialize().then(()=>root.render(<React.StrictMode><ErrorBoundary><App/></ErrorBoundary></React.StrictMode>)).catch(e=>root.render(<div className="startup"><h1>Локальне сховище недоступне</h1><p>{String(e)}</p><p>Дозвольте IndexedDB у налаштуваннях браузера та перезавантажте сторінку.</p></div>));

import './help/help.css';

import './game/design-system.css';
