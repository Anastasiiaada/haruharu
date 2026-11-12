import {z} from 'zod';
import {DateTime} from 'luxon';
const calendarDate=z.string().refine(s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&DateTime.fromISO(s).isValid,'Некоректна календарна дата');
const wallTime=z.string().refine(s=>/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(s)&&DateTime.fromISO(s,{zone:'Europe/Kyiv'}).isValid,'Некоректний локальний час');
export const sourceKinds=['local','google','apple','ics','holidays'] as const;
export const eventKinds=['lesson','homework','review','other','holiday'] as const;
export const calendarSourceSchema=z.object({id:z.string(),kind:z.enum(sourceKinds),name:z.string(),enabled:z.boolean(),remoteId:z.string().optional(),lastSync:z.string().optional(),rangeStart:z.string().optional(),rangeEnd:z.string().optional(),error:z.string().optional(),publicUrl:z.string().optional()});
export const localEventSchema=z.object({id:z.string(),title:z.string().trim().min(1).max(200),description:z.string().max(10000),location:z.string().max(1000),meetingUrl:z.string().max(2000),start:wallTime,end:wallTime,allDay:z.boolean(),kind:z.enum(eventKinds),repeat:z.enum(['none','daily','weekly']),until:calendarDate,reminder:z.number().int().min(0).max(10080)}).superRefine((e,c)=>{const start=DateTime.fromISO(e.start,{zone:'Europe/Kyiv'}),end=DateTime.fromISO(e.end,{zone:'Europe/Kyiv'}),until=DateTime.fromISO(e.until,{zone:'Europe/Kyiv'});if(end<=start)c.addIssue({code:'custom',message:'Закінчення має бути після початку'});if((e.allDay&&(e.start.length!==10||e.end.length!==10))||(!e.allDay&&(e.start.length!==16||e.end.length!==16)))c.addIssue({code:'custom',message:'Формат часу не відповідає allDay'});if(!e.allDay&&(start.toFormat("yyyy-MM-dd'T'HH:mm")!==e.start||end.toFormat("yyyy-MM-dd'T'HH:mm")!==e.end))c.addIssue({code:'custom',message:'Час не існує через перехід DST'});if(e.repeat!=='none'&&(until<start.startOf('day')||until.diff(start,'days').days>3660))c.addIssue({code:'custom',message:'Некоректна кінцева дата повторення'});});
export const cachedEventSchema=z.object({id:z.string(),sourceId:z.string(),remoteId:z.string(),uid:z.string(),occurrence:z.string(),title:z.string(),description:z.string(),location:z.string(),meetingUrl:z.string(),start:z.string(),end:z.string(),allDay:z.boolean(),kind:z.enum(eventKinds),updated:z.string().optional()});
export type CalendarSource=z.infer<typeof calendarSourceSchema>;
export type LocalEvent=z.infer<typeof localEventSchema>;
export type CalendarEvent=z.infer<typeof cachedEventSchema>&{localId?:string;holidayKey?:string;sources?:string[];reminder?:number};
export interface IcsFeed {id:string;sourceId:string;text:string;}
export interface InboxItem {id:string;title:string;body:string;date:string;eventId?:string;read:boolean;browserNotifiedAt?:string;}
