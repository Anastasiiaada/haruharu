import {portableSettings} from './portableSettings';
import {bundleSchema,type Bundle} from '../models';
import {db} from './db';
export async function exportData(type:Bundle['type']){
  const data=bundleSchema.parse({format:'haruharu',version:1,type});
  if(type==='backup')await db.transaction('r',db.tables,async()=>{
    Object.assign(data,{notes:await db.notes.toArray(),words:await db.words.toArray(),exercises:await db.exercises.toArray(),attempts:await db.attempts.toArray(),exams:await db.exams.toArray(),settings:portableSettings(await db.settings.toArray()),calendarSources:(await db.calendarSources.toArray()).map(({publicUrl:_,...s})=>s),localEvents:await db.localEvents.toArray(),calendarEvents:await db.calendarEvents.toArray(),icsFeeds:await db.icsFeeds.toArray(),inbox:await db.inbox.toArray(),rewards:await db.rewards.toArray(),badges:await db.badges.toArray()});
  });else Object.assign(data,{[type]:await db[type].toArray()});
  download(data,`haruharu-${type}.json`);
}
export function download(data:unknown,name:string){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export async function parseFile(file:File){if(file.size>10000000)throw Error('Файл перевищує 10 МБ.');const result=bundleSchema.safeParse(JSON.parse(await file.text()));if(!result.success)throw Error(result.error.issues.map(x=>`${x.path.join('.')}: ${x.message}`).slice(0,5).join('\n'));return result.data;}
export async function importData(b:Bundle){await db.transaction('rw',db.tables,async()=>{
  await db.notes.bulkAdd(b.notes.map(x=>({...x,id:crypto.randomUUID()})));await db.words.bulkAdd(b.words.map(x=>({...x,id:crypto.randomUUID()})));await db.exercises.bulkAdd(b.exercises.map(x=>({...x,id:crypto.randomUUID()})));
  if(b.type==='backup'){
    await db.attempts.bulkAdd(b.attempts.map(x=>({...x,id:crypto.randomUUID()})));await db.exams.bulkAdd(b.exams.map(x=>({...x,id:crypto.randomUUID()})));await db.settings.bulkPut(portableSettings(b.settings));
    for(const reward of b.rewards)if(!await db.rewards.get(reward.id))await db.rewards.add(reward);for(const badge of b.badges)if(!await db.badges.get(badge.id))await db.badges.add(badge);
    const ids=new Map(b.calendarSources.map(s=>[s.id,['local','holidays'].includes(s.id)?s.id:`restored:${crypto.randomUUID()}`]));
    for(const s of b.calendarSources){const id=ids.get(s.id)!;if(['local','holidays'].includes(id)){if(!await db.calendarSources.get(id))await db.calendarSources.add({...s,id});}else await db.calendarSources.add({...s,id,enabled:s.kind==='google'?false:s.enabled});}
    await db.localEvents.bulkAdd(b.localEvents.map(e=>({...e,id:crypto.randomUUID()})));
    await db.calendarEvents.bulkAdd(b.calendarEvents.filter(e=>ids.has(e.sourceId)).map(e=>({...e,id:crypto.randomUUID(),sourceId:ids.get(e.sourceId)!})));
    await db.icsFeeds.bulkAdd(b.icsFeeds.filter(f=>ids.has(f.sourceId)).map(f=>({...f,id:ids.get(f.sourceId)!,sourceId:ids.get(f.sourceId)!})));
    // Stable notification keys preserve deduplication and category links.
    // Restoring an older copy must never turn a read message unread again.
    for(const notification of b.inbox){const existing=await db.inbox.get(notification.id);if(!existing)await db.inbox.add(notification);else if(notification.read&&!existing.read)await db.inbox.update(notification.id,{read:true});}
  }
});}
