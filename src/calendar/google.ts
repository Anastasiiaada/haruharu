import {DateTime} from 'luxon';
import {db} from '../services/db';
import type {CalendarEvent,CalendarSource} from './models';
import {safeMeetingUrl,ZONE} from './time';
import {fetchWithTimeout} from './network';
export const GOOGLE_SCOPE='https://www.googleapis.com/auth/calendar.readonly';
export const googleClientId=(import.meta.env.VITE_GOOGLE_CLIENT_ID||'').trim();
type TokenResponse={access_token?:string;expires_in?:number;scope?:string;error?:string};
interface TokenClient {requestAccessToken:(options:{prompt:string})=>void;}
interface GoogleIdentity {accounts:{oauth2:{initTokenClient:(config:{client_id:string;scope:string;include_granted_scopes:boolean;callback:(r:TokenResponse)=>void;error_callback:()=>void})=>TokenClient;revoke:(token:string,callback:()=>void)=>void;}};}
declare global {interface Window {google?:GoogleIdentity;}}
interface GoogleEvent {id:string;iCalUID?:string;summary?:string;description?:string;location?:string;hangoutLink?:string;status?:string;updated?:string;start?:{date?:string;dateTime?:string};end?:{date?:string;dateTime?:string};originalStartTime?:{date?:string;dateTime?:string};conferenceData?:{entryPoints?:{uri?:string}[]};}
interface GoogleCalendar {id:string;summary?:string;primary?:boolean;}
export function googleEvent(raw:GoogleEvent,sourceId:string):CalendarEvent|null {
  if(raw.status==='cancelled')return null;
  const start=raw.start?.date||raw.start?.dateTime,end=raw.end?.date||raw.end?.dateTime;
  if(!raw.id||!start||!end)throw Error('Google повернув подію без дати або ідентифікатора.');
  const allDay=!!raw.start?.date;
  const canonical=(s:string)=>{const d=DateTime.fromISO(s,{setZone:true});if(!d.isValid)throw Error('Google повернув некоректний час.');return s.length===10?s:d.toUTC().toISO()!;};
  const occurrence=raw.originalStartTime?.date||raw.originalStartTime?.dateTime||start;
  return {id:`${sourceId}:${raw.id}`,sourceId,remoteId:raw.id,uid:raw.iCalUID||'',occurrence:canonical(occurrence),title:raw.summary||'Без назви',description:raw.description||'',location:raw.location||'',meetingUrl:safeMeetingUrl(raw.hangoutLink,...(raw.conferenceData?.entryPoints||[]).map(x=>x.uri),raw.description,raw.location),start:canonical(start),end:canonical(end),allDay,kind:'other',updated:raw.updated};
}
type GoogleState={ready:boolean;connected:boolean;busy:boolean;message:string};
let state:GoogleState={ready:false,connected:false,busy:false,message:''};
const listeners=new Set<()=>void>();
const update=(patch:Partial<GoogleState>)=>{state={...state,...patch};listeners.forEach(l=>l());};
export const googleSnapshot=()=>state;
export const subscribeGoogle=(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};};
let token='';let expires=0;let epoch=0;let requestedEpoch=0;let tokenClient:TokenClient|undefined;let preparing:Promise<void>|undefined;let expiryTimer:ReturnType<typeof setTimeout>|undefined;
export function hasGoogleToken(){return !!token&&Date.now()<expires;}
function expire(){token='';expires=0;update({connected:false,busy:false,message:'Сеанс Google завершився. Натисніть «Підключити Google Calendar» для повторної авторизації. Кеш збережено.'});}
export async function googlePages<T>(path:string,params:Record<string,string>,accessToken:string,fetcher:typeof fetch=fetch):Promise<T[]>{
  const result:T[]=[];let page='';const seen=new Set<string>();
  do{if(seen.has(page)||seen.size>=100)throw Error('Надто багато сторінок Google API або повторений pageToken.');seen.add(page);
    const url=new URL(`https://www.googleapis.com/calendar/v3/${path}`);for(const [k,v] of Object.entries(params))url.searchParams.set(k,v);if(page)url.searchParams.set('pageToken',page);
    let response:Response|undefined;
    for(let retry=0;retry<3;retry++){response=await fetchWithTimeout(url,{headers:{Authorization:`Bearer ${accessToken}`},cache:'no-store',credentials:'omit'},fetcher);if(!(response.status===429||response.status>=500)||retry===2)break;await new Promise(r=>setTimeout(r,500*2**retry));}
    if(!response!.ok){if(response!.status===401)throw Error('GOOGLE_AUTH_EXPIRED');throw Error(`Google API: ${response!.status}. ${response!.status===403?'Перевірте дозвіл читання, Calendar API та квоту.':'Спробуйте оновити пізніше.'}`);}
    const body=await response!.json() as {items?:T[];nextPageToken?:string};if(body.items&&!Array.isArray(body.items))throw Error('Некоректна відповідь Google API.');result.push(...(body.items||[]));page=body.nextPageToken||'';
  }while(page);return result;
}
export async function prepareGoogle(){if(!googleClientId)return;if(preparing)return preparing;preparing=(async()=>{
  if(!navigator.onLine)throw Error('Для підключення Google потрібен інтернет.');
  if(!window.google?.accounts.oauth2)await new Promise<void>((resolve,reject)=>{const existing=document.getElementById('google-identity');existing?.remove();const script=document.createElement('script');script.id='google-identity';script.src='https://accounts.google.com/gsi/client';script.async=true;const timeout=setTimeout(()=>reject(Error('Google Identity не відповідає. Перевірте мережу.')),15000);script.onload=()=>{clearTimeout(timeout);resolve();};script.onerror=()=>{clearTimeout(timeout);reject(Error('Не вдалося завантажити Google Identity.'));};document.head.appendChild(script);});
  if(!window.google)throw Error('Google Identity недоступний.');
  tokenClient=window.google.accounts.oauth2.initTokenClient({client_id:googleClientId,scope:GOOGLE_SCOPE,include_granted_scopes:false,error_callback:()=>update({busy:false,message:'Вікно Google закрито або заблоковано. Повторіть підключення.'}),callback:r=>{
    if(requestedEpoch!==epoch)return;
    if(r.error||!r.access_token||!r.scope?.split(' ').includes(GOOGLE_SCOPE)){update({busy:false,message:'Не надано дозвіл читання Google Calendar.'});return;}
    token=r.access_token;expires=Date.now()+Number(r.expires_in||3600)*1000-30000;epoch++;clearTimeout(expiryTimer);expiryTimer=setTimeout(expire,Math.max(0,expires-Date.now()));update({connected:true,busy:false,message:''});void connectCalendars().catch(reportGoogleError);
  }});update({ready:true});
})().catch(e=>{preparing=undefined;update({message:String(e),ready:false});});return preparing;}
export function connectGoogle(){if(!googleClientId){update({message:'Google Calendar ще не налаштовано: додайте VITE_GOOGLE_CLIENT_ID. Інструкція — у Допомозі.'});return;}if(!tokenClient){void prepareGoogle();update({message:'Готуємо Google Identity. Коли кнопка стане доступною, натисніть ще раз.'});return;}if(!navigator.onLine){update({message:'Для авторизації потрібен інтернет.'});return;}requestedEpoch=++epoch;update({busy:true,message:''});tokenClient.requestAccessToken({prompt:'select_account'});}
function reportGoogleError(error:unknown){const message=String(error);if(message.includes('GOOGLE_AUTH_EXPIRED'))expire();else update({message,busy:false});}
async function connectCalendars(){if(!hasGoogleToken())return expire();const currentEpoch=epoch;update({busy:true});try{const calendars=await googlePages<GoogleCalendar>('users/me/calendarList',{maxResults:'250'},token);if(currentEpoch!==epoch)return;const owner=calendars.find(c=>c.primary)?.id;if(!owner)throw Error('Не знайдено основний календар Google.');const previousOwner=(await db.settings.get('googleOwner'))?.value;const existing=await db.calendarSources.toArray();await db.transaction('rw',[db.calendarSources,db.settings],async()=>{if(currentEpoch!==epoch)return;for(const source of existing.filter(x=>x.kind==='google'))await db.calendarSources.update(source.id,{enabled:previousOwner===owner?source.enabled:false});for(const c of calendars){const id=`google:${owner}:${c.id}`;const old=existing.find(s=>s.id===id);await db.calendarSources.put({id,kind:'google',name:c.summary||c.id,remoteId:c.id,enabled:old?.enabled??!!c.primary,lastSync:old?.lastSync,rangeStart:old?.rangeStart,rangeEnd:old?.rangeEnd});}await db.settings.put({key:'googleOwner',value:owner});await db.settings.put({key:'googleLinked',value:'yes'});});}finally{update({busy:false});}await syncGoogle();}
export const syncRange=()=>({from:DateTime.now().setZone(ZONE).minus({years:1}).startOf('year').toISODate()!,to:DateTime.now().setZone(ZONE).plus({years:2}).startOf('year').toISODate()!});
export async function replaceGoogleSnapshot(source:CalendarSource,events:CalendarEvent[],from:string,to:string){await db.transaction('rw',[db.calendarEvents,db.calendarSources],async()=>{await db.calendarEvents.where('sourceId').equals(source.id).delete();await db.calendarEvents.bulkPut(events);await db.calendarSources.update(source.id,{lastSync:new Date().toISOString(),rangeStart:from,rangeEnd:to,error:''});});}
export async function syncGoogle(){if(state.busy)return;if(!navigator.onLine){update({message:'Немає мережі. Показуємо збережений кеш Google.'});return;}if(!hasGoogleToken()){expire();return;}const currentEpoch=epoch,access=token;update({busy:true,message:''});try{const {from,to}=syncRange();const sources=(await db.calendarSources.toArray()).filter(s=>s.kind==='google'&&s.enabled);const failures:string[]=[];for(const source of sources){try{const raw=await googlePages<GoogleEvent>(`calendars/${encodeURIComponent(source.remoteId!)}/events`,{singleEvents:'true',showDeleted:'true',maxResults:'2500',timeZone:ZONE,timeMin:DateTime.fromISO(from,{zone:ZONE}).toISO()!,timeMax:DateTime.fromISO(to,{zone:ZONE}).toISO()!},access);if(currentEpoch!==epoch)return;const events=raw.map(e=>googleEvent(e,source.id)).filter((e):e is CalendarEvent=>!!e);await replaceGoogleSnapshot(source,[...new Map(events.map(e=>[e.id,e])).values()],from,to);}catch(e){if(currentEpoch!==epoch)return;if(String(e).includes('GOOGLE_AUTH_EXPIRED'))throw e;const message=String(e);await db.calendarSources.update(source.id,{error:message});failures.push(source.name);}}update({message:failures.length?`Не оновлено: ${failures.join(', ')}. Попередній кеш збережено.`:'Вибрані календарі Google оновлено.'});}catch(e){reportGoogleError(e);}finally{if(currentEpoch===epoch)update({busy:false});}}
export async function disconnectGoogle(){epoch++;const old=token;token='';expires=0;clearTimeout(expiryTimer);update({connected:false,busy:false,message:'Google відключено. Кеш збережено, джерела приховано.'});await db.settings.put({key:'googleLinked',value:'no'});await db.calendarSources.where('kind').equals('google').modify({enabled:false});if(old&&window.google)window.google.accounts.oauth2.revoke(old,()=>{});}
