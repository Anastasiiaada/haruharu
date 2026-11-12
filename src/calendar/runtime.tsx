import {useEffect} from 'react';
import {Link} from 'react-router-dom';
import {useLiveQuery} from 'dexie-react-hooks';
import {Bell} from 'lucide-react';
import {db} from '../services/db';
import {initCalendar,refreshIcs} from './store';
import {hasGoogleToken,syncGoogle} from './google';
import {collectReminders,collectReleaseNotification} from '../notifications/service';
export {collectReminders} from '../notifications/service';
let running=false;
export function CalendarRuntime(){useEffect(()=>{let stopped=false;const run=async()=>{if(running||stopped||document.hidden)return;running=true;try{await initCalendar();await collectReminders();await collectReleaseNotification();if(navigator.onLine){if(hasGoogleToken())await syncGoogle();const feeds=(await db.calendarSources.toArray()).filter(s=>s.enabled&&s.publicUrl);for(const feed of feeds)try{await refreshIcs(feed);}catch{/* source errors stay visible in calendar settings */}}}catch(e){console.error('Calendar runtime failed',e instanceof Error?e.message:'Unknown error');}finally{running=false;}};void run();const interval=setInterval(()=>{if(!document.hidden)void collectReminders().catch(()=>{});},60000);const visible=()=>{if(!document.hidden)void run();};window.addEventListener('online',visible);document.addEventListener('visibilitychange',visible);return()=>{stopped=true;clearInterval(interval);window.removeEventListener('online',visible);document.removeEventListener('visibilitychange',visible);};},[]);return null;}
export function InboxLink(){const unread=useLiveQuery(()=>db.inbox.filter(n=>!n.read).count())||0;return <Link className="inbox-link" to="/notifications" aria-label={`Сповіщення: ${unread} непрочитаних`}><Bell size={18}/>{unread>0&&<span>{unread}</span>}</Link>;}
