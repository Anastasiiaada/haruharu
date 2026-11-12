import {z} from 'zod';
export const rewardSchema=z.object({id:z.string(),kind:z.enum(['answer','review','mastered','session','goal']),reference:z.string(),xp:z.number().int().min(0).max(100),date:z.string(),correct:z.boolean().optional()});
export const badgeSchema=z.object({id:z.string(),date:z.string()});
export type Reward=z.infer<typeof rewardSchema>;
export type Badge=z.infer<typeof badgeSchema>;
export interface GameAction {xp:number;totalXP:number;beforeLevel:number;level:number;badges:string[];}
export const badgeDefinitions=[
{id:'first-answer',title:'Перший паросток',description:'Виконай свою першу вправу',symbol:'🌱'},
{id:'correct-25',title:'На одній хвилі',description:'Дай 25 правильних відповідей',symbol:'🌊'},
{id:'words-10',title:'Збирач слів',description:'Познач 10 слів вивченими',symbol:'🌸'},
{id:'streak-3',title:'Три дні вогню',description:'Навчайся 3 дні поспіль',symbol:'🔥'},
{id:'streak-7',title:'Тиждень з Хару',description:'Навчайся 7 днів поспіль',symbol:'🍀'},
{id:'perfect',title:'완벽해요!',description:'Заверши заняття з 5+ завдань без помилок',symbol:'💎'},
{id:'daily-goal',title:'Маленька перемога',description:'Досягни щоденної цілі',symbol:'⭐'},
] as const;
