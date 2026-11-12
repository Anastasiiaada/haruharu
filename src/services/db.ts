import type {Reward,Badge} from '../game/models';
import Dexie, { type Table } from 'dexie';
import type {Note,Word,Exercise,Attempt,Exam} from '../models';
import {seedNotes,seedWords,seedExercises} from '../data';
import type {CalendarSource,LocalEvent,CalendarEvent,IcsFeed,InboxItem} from '../calendar/models';
export class Database extends Dexie { rewards!:Table<Reward>; badges!:Table<Badge>; notes!:Table<Note>; words!:Table<Word>; exercises!:Table<Exercise>; attempts!:Table<Attempt>; exams!:Table<Exam>; settings!:Table<{key:string,value:string}>; calendarSources!:Table<CalendarSource>; localEvents!:Table<LocalEvent>; calendarEvents!:Table<CalendarEvent>; icsFeeds!:Table<IcsFeed>; inbox!:Table<InboxItem>; constructor(databaseName='haruharu'){super(databaseName);this.version(1).stores({notes:'id,category',words:'id,category,due',exercises:'id,topic',attempts:'id,date',exams:'id,date',settings:'key'});this.version(2).stores({calendarSources:'id,kind',localEvents:'id,start',calendarEvents:'id,sourceId,start',icsFeeds:'id,sourceId',inbox:'id,date'});this.version(3).stores({rewards:'id,date,kind,reference',badges:'id,date'});} }
export const db=new Database();
export async function initialize(){await db.transaction('rw',[db.notes,db.words,db.exercises,db.settings],async()=>{if(!await db.settings.get('initialized')){await db.notes.bulkAdd(seedNotes);await db.words.bulkAdd(seedWords);await db.exercises.bulkAdd(seedExercises);await db.settings.put({key:'initialized',value:'yes'});}});}
export const uid=()=>crypto.randomUUID();
export function day(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
