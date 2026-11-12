import {DateTime} from 'luxon';
import type {Attempt} from '../models';
import type {Reward} from './models';
export const gameDay=(date:string|Date=new Date())=>DateTime.fromJSDate(typeof date==='string'?new Date(date):date).setZone('Europe/Kyiv').toISODate()!;
export const dailyGoal=(value?:string)=>[5,10,20].includes(Number(value))?Number(value):10;
export function levelProgress(xp:number){let level=1,threshold=0,required=100;const safe=Math.max(0,Math.floor(xp));while(safe>=threshold+required){threshold+=required;level++;required=100+(level-1)*50;}return {level,current:safe-threshold,required,remaining:required-(safe-threshold),percent:(safe-threshold)/required*100};}
export function learningDays(attempts:Attempt[],rewards:Reward[]){return [...new Set([...attempts.map(a=>gameDay(a.date)),...rewards.filter(r=>r.kind==='answer'||r.kind==='review').map(r=>gameDay(r.date))])].sort();}
export function currentStreak(days:string[],today=gameDay()){const set=new Set(days);let d=DateTime.fromISO(today);if(!set.has(today))d=d.minus({days:1});let count=0;while(set.has(d.toISODate()!)){count++;d=d.minus({days:1});}return count;}
export function dailyActions(attempts:Attempt[],rewards:Reward[],today=gameDay()){return attempts.filter(a=>gameDay(a.date)===today).length+rewards.filter(r=>r.kind==='review'&&gameDay(r.date)===today).length;}
