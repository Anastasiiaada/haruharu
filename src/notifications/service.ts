import {z} from 'zod';
import {DateTime} from 'luxon';
import {db} from '../services/db';
import type {InboxItem} from '../calendar/models';
import {expandLocal,kyivNow,localTime,ZONE} from '../calendar/time';
import {releases} from '../calendar/updates';

export const notificationPreferencesSchema=z.object({lessons:z.boolean().default(true),homework:z.boolean().default(true),reviews:z.boolean().default(true),updates:z.boolean().default(true),leadMinutes:z.union([z.literal(10),z.literal(30),z.literal(60),z.literal(1440)]).default(30),reviewTime:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default('19:00'),browser:z.boolean().default(false)});
export type NotificationPreferences=z.infer<typeof notificationPreferencesSchema>;
export const defaultNotificationPreferences=notificationPreferencesSchema.parse({});
export function parseNotificationPreferences(value?:string):NotificationPreferences {try{return notificationPreferencesSchema.parse(JSON.parse(value||'{}'));}catch{return {...defaultNotificationPreferences};}}
export async function getNotificationPreferences(){return parseNotificationPreferences((await db.settings.get('notificationPreferences'))?.value);}
export function browserPermission():NotificationPermission|'unsupported'{return typeof window!=='undefined'&&window.isSecureContext&&'Notification'in window?Notification.permission:'unsupported';}
export async function requestBrowserPermission(){if(browserPermission()==='unsupported')return 'unsupported' as const;return Notification.requestPermission();}
export async function showBrowserNotification(item:InboxItem){
  if(browserPermission()!=='granted')return false;
  const options:NotificationOptions={body:item.body,tag:item.id,icon:`${import.meta.env.BASE_URL}icons/icon-192.png`,data:{url:`${import.meta.env.BASE_URL}#/notifications`}};
  if('serviceWorker'in navigator){const registration=await navigator.serviceWorker.getRegistration();if(registration?.active&&'showNotification'in registration){await registration.showNotification(item.title,options);return true;}}
  // Desktop fallback. Some mobile browsers reject this constructor; the inbox
  // still retains the message and the caller reports an actionable error.
  const notification=new Notification(item.title,options);notification.onclick=()=>{window.focus();location.hash='/notifications';notification.close();};return true;
}
export async function enqueueNotification(item:InboxItem,deliver:(item:InboxItem)=>Promise<boolean>=showBrowserNotification){
  const created=await db.transaction('rw',db.inbox,async()=>{if(await db.inbox.get(item.id))return false;await db.inbox.add(item);return true;});
  if(created&&(await getNotificationPreferences()).browser){try{if(await deliver(item))await db.inbox.update(item.id,{browserNotifiedAt:new Date().toISOString()});}catch{await db.settings.put({key:'notificationLastError',value:'Браузер не зміг показати сповіщення. Воно збережене у дзвіночку. Перевірте дозвіл і режим встановленої PWA.'});}}
  return created;
}
export async function collectReminders(now:DateTime=kyivNow()){
  const preferences=await getNotificationPreferences();
  const local=await db.localEvents.toArray();
  const events=expandLocal(local,now.minus({days:1}).toISODate()!,now.plus({days:8}).toISODate()!);
  for(const event of events){
    if(!event.reminder||event.kind==='lesson'&&!preferences.lessons||event.kind==='homework'&&!preferences.homework||event.kind==='review'&&!preferences.reviews)continue;
    const start=event.allDay?localTime(event.start).toMillis():Date.parse(event.start);
    if(start-event.reminder*60000>now.toMillis()||start<now.minus({hours:24}).toMillis())continue;
    const id=`reminder:${event.id}:${event.start}`;
    const type=event.kind==='homework'?'Домашнє завдання':event.kind==='review'?'Повторення слів':event.kind==='lesson'?'Урок корейської':'Твій план';
    await enqueueNotification({id,title:event.title,body:`${type} · ${localTime(event.start).toFormat('dd.MM HH:mm')} · Київ`,date:now.toISO()!,eventId:event.id,read:false});
  }
  if(preferences.reviews&&now.toFormat('HH:mm')>=preferences.reviewTime){
    const due=await db.words.filter(w=>w.due<=now.toMillis()).count();
    if(due)await enqueueNotification({id:`words:${now.setZone(ZONE).toISODate()}`,title:'Слова скучили за тобою 🌱',body:`До повторення готові ${due} карток. Кілька хвилин — і ще один маленький крок зроблено.`,date:now.toISO()!,read:false});
  }
}
export async function collectReleaseNotification(){const preferences=await getNotificationPreferences();if(!preferences.updates)return;const release=releases[0];await enqueueNotification({id:`release:${release.version}`,title:`Що нового? HaruHaru ${release.version}`,body:release.summary,date:release.date,read:false});}
