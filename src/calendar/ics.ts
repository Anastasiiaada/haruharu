import ICAL from 'ical.js';
import {DateTime} from 'luxon';
type Time=InstanceType<typeof ICAL.Time>;
type IcalEvent=InstanceType<typeof ICAL.Event>;
import type {CalendarEvent,LocalEvent} from './models';
import {ZONE,localTime,overlaps,safeMeetingUrl} from './time';

function timeValue(time:Time,tzid?:string):string {
  if(time.isDate)return time.toString().slice(0,10);
  const zone=time.zone?.tzid&&time.zone.tzid!=='floating'?time.zone.tzid:tzid||ZONE;
  const dt=DateTime.fromObject({year:time.year,month:time.month,day:time.day,hour:time.hour,minute:time.minute,second:time.second},{zone:zone==='floating'?ZONE:zone==='Z'?'UTC':zone});
  if(dt.isValid)return dt.toUTC().toISO()!;
  if(time.zone?.tzid&&time.zone.tzid!=='floating')return time.toJSDate().toISOString();
  throw Error(`Невідомий часовий пояс ICS: ${zone}. Експортуйте календар із VTIMEZONE.`);
}
export function parseIcs(text:string,sourceId:string,from:string,to:string):CalendarEvent[]{
  if(new TextEncoder().encode(text).length>5_000_000)throw Error('ICS перевищує 5 МБ.');
  ICAL.TimezoneService.reset();
  const calendar=new ICAL.Component(ICAL.parse(text));
  if(calendar.name!=='vcalendar')throw Error('Файл не є календарем VCALENDAR.');
  for(const tz of calendar.getAllSubcomponents('vtimezone'))ICAL.TimezoneService.register(new ICAL.Timezone(tz));
  const components=calendar.getAllSubcomponents('vevent');
  if(components.length>5000)throw Error('ICS містить понад 5000 подій.');
  // ICAL.js ships without an IANA database. Supply offsets from the browser's
  // Intl database when a feed uses IANA TZID without a VTIMEZONE definition.
  const registerIana=(name:string)=>{if(ICAL.TimezoneService.has(name)||!DateTime.now().setZone(name).isValid)return;const zone=new ICAL.Timezone({tzid:name});zone.utcOffset=(time:Time)=>DateTime.fromObject({year:time.year,month:time.month,day:time.day,hour:time.hour,minute:time.minute,second:time.second},{zone:name}).offset*60;ICAL.TimezoneService.register(zone);};
  registerIana(ZONE);
  for(const component of components)for(const property of component.getAllProperties()){const tzid=property.getParameter('tzid');if(typeof tzid==='string')registerIana(tzid);}
  for(const component of components)for(const name of ['dtstart','dtend','recurrence-id','rdate','exdate'])for(const property of component.getAllProperties(name))for(const value of property.getValues()){if(value instanceof ICAL.Time&&!value.isDate&&value.zone.tzid==='floating'&&!property.getParameter('tzid'))value.zone=ICAL.TimezoneService.get(ZONE);}
  const records=components.map(c=>new ICAL.Event(c,{exceptions:[]}));
  const result:CalendarEvent[]=[];let iterations=0;
  const make=(event:IcalEvent,start:Time,end:Time,occurrence:Time,occurrenceZone?:string)=>{
    const timezone=event.component.getFirstProperty('dtstart')?.getParameter('tzid') as string|undefined;
    const startValue=timeValue(start,timezone);let endValue=timeValue(end,timezone);
    if(start.isDate&&endValue<=startValue)endValue=DateTime.fromISO(startValue).plus({days:1}).toISODate()!;
    const original=timeValue(occurrence,occurrenceZone||timezone);
    const description=event.description||'',location=event.location||'';
    const e:CalendarEvent={id:`${sourceId}:${event.uid}:${original}`,sourceId,remoteId:`${event.uid}:${original}`,uid:event.uid,occurrence:original,title:event.summary||'Без назви',description,location,meetingUrl:safeMeetingUrl(String(event.component.getFirstPropertyValue('url')||''),description,location),start:startValue,end:endValue,allDay:start.isDate,kind:'other'};
    if(overlaps(e,from,to))result.push(e);
    if(result.length>5000)throw Error('Понад 5000 входжень. Зменште діапазон або календар.');
  };
  const masterUids=new Set(records.filter(e=>!e.isRecurrenceException()).map(e=>e.uid));
  for(const master of records){
    if(!master.uid)throw Error('Подія ICS не має UID.');
    if(master.isRecurrenceException()&&masterUids.has(master.uid))continue;
    if(master.component.getFirstPropertyValue('status')==='CANCELLED')continue;
    if(!master.startDate)throw Error('Подія ICS не має DTSTART.');
    for(const rule of master.component.getAllProperties('rrule')){
      const value=String(rule.getFirstValue());
      if(/FREQ=(SECONDLY|MINUTELY|HOURLY)/.test(value))throw Error('Повторення частіше одного дня не підтримуються в ICS-імпорті.');
    }
    const exceptions=records.filter(e=>e.uid===master.uid&&e.isRecurrenceException());
    const cancelled=new Set(exceptions.filter(e=>e.component.getFirstPropertyValue('status')==='CANCELLED').map(e=>timeValue(e.recurrenceId,master.component.getFirstProperty('dtstart')?.getParameter('tzid') as string|undefined)));
    for(const e of exceptions)if(e.startDate&&e.component.getFirstPropertyValue('status')!=='CANCELLED')master.relateException(e);
    if(!master.isRecurring()){make(master,master.startDate,master.endDate,master.isRecurrenceException()?master.recurrenceId:master.startDate);continue;}
    // DTSTART belongs to the recurrence set, including an RDATE-only series.
    // ICAL.js's RDATE-only iterator otherwise omits that first occurrence.
    const first=new ICAL.Property('rdate');first.setValue(master.startDate.clone());master.component.addProperty(first);
    const iterator=master.iterator();let occurrence:Time|null;
    const included=new Set<string>();
    while((occurrence=iterator.next())){
      if(++iterations>25000)throw Error('Надто складне або давнє повторення ICS (ліміт 25000 входжень).');
      const raw=timeValue(occurrence,master.component.getFirstProperty('dtstart')?.getParameter('tzid') as string|undefined);
      if(raw.slice(0,10)>DateTime.fromISO(to).plus({days:2}).toISODate()!)break;
      if(cancelled.has(raw))continue;
      const detail=master.getOccurrenceDetails(occurrence);
      included.add(occurrence.toString());make(detail.item,detail.startDate,detail.endDate,occurrence,master.component.getFirstProperty('dtstart')?.getParameter('tzid') as string|undefined);
    }
    // Include exceptions moved into the visible window from a later original date.
    for(const e of exceptions)if(!included.has(e.recurrenceId.toString())&&!cancelled.has(timeValue(e.recurrenceId,master.component.getFirstProperty('dtstart')?.getParameter('tzid') as string|undefined))&&e.startDate)make(e,e.startDate,e.endDate,e.recurrenceId,master.component.getFirstProperty('dtstart')?.getParameter('tzid') as string|undefined);
  }
  return [...new Map(result.map(e=>[e.id,e])).values()];
}
const esc=(s:string)=>s.replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
function fold(line:string){let result='',current='',bytes=0;for(const char of line){const n=new TextEncoder().encode(char).length;if(bytes+n>73){result+=current+'\r\n ';current='';bytes=1;}current+=char;bytes+=n;}return result+current;}
export function exportIcs(events:LocalEvent[]){
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//HaruHaru//Learning Calendar//UK','CALSCALE:GREGORIAN','X-WR-CALNAME:HaruHaru','X-WR-TIMEZONE:Europe/Kyiv',
  'BEGIN:VTIMEZONE','TZID:Europe/Kyiv','BEGIN:DAYLIGHT','DTSTART:19960331T030000','TZOFFSETFROM:+0200','TZOFFSETTO:+0300','RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU','END:DAYLIGHT','BEGIN:STANDARD','DTSTART:19961027T040000','TZOFFSETFROM:+0300','TZOFFSETTO:+0200','RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU','END:STANDARD','END:VTIMEZONE'];
  for(const e of events){const date=(v:string)=>localTime(v).toFormat(e.allDay?'yyyyMMdd':"yyyyMMdd'T'HHmmss");const suffix=e.allDay?';VALUE=DATE':';TZID=Europe/Kyiv';
    lines.push('BEGIN:VEVENT',`UID:${esc(e.id)}@haruharu`,`DTSTAMP:${DateTime.utc().toFormat("yyyyMMdd'T'HHmmss'Z'")}`,`DTSTART${suffix}:${date(e.start)}`,`DTEND${suffix}:${date(e.end)}`,`SUMMARY:${esc(e.title)}`,`DESCRIPTION:${esc(e.description)}`,`LOCATION:${esc(e.location)}`);
    if(e.repeat!=='none')lines.push(`RRULE:FREQ=${e.repeat==='daily'?'DAILY':'WEEKLY'};UNTIL=${e.allDay?localTime(e.until).toFormat('yyyyMMdd'):localTime(e.until).endOf('day').toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'")}`);
    if(e.meetingUrl)lines.push(`URL:${esc(e.meetingUrl)}`);
    if(e.reminder)lines.push('BEGIN:VALARM','ACTION:DISPLAY',`DESCRIPTION:${esc(e.title)}`,`TRIGGER:-PT${e.reminder}M`,'END:VALARM');
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');return lines.map(fold).join('\r\n')+'\r\n';
}
export function downloadIcs(events:LocalEvent[]){const url=URL.createObjectURL(new Blob([exportIcs(events)],{type:'text/calendar;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='haruharu.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
