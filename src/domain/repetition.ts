import type {Attempt, ContentPack} from './schema';
import {currentAttempts} from './engine';
import {isAssessable} from './learning';

export const REPETITION_INTERVALS = [1, 3, 7, 14] as const;
export const DAILY_REPETITION_LIMIT = 5;

/** Calendar days, not 24-hour durations: DST must not move the due date. */
export function localDay(time = Date.now()): string {
 const date = new Date(time);
 return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function addDays(day: string, days: number): string {
 const [year, month, date] = day.split('-').map(Number);
 return new Date(Date.UTC(year,month-1,date+days)).toISOString().slice(0,10);
}
export interface Repetition {
 taskId: string;
 step: number;
 dueDay: string;
 lastDay: string;
 lastAttemptId: string;
}

/** One event transition, shared by repetition and the XP ledger. */
export function advanceRepetition(previous:Repetition|undefined,event:Attempt):Repetition|undefined {
 if(event.result!=='correct'&&event.result!=='wrong')return previous;
 const day=event.localDay??localDay(event.checkedAt);
 if(!previous||event.result==='wrong'||event.hintUsed)return {taskId:event.taskId,step:0,dueDay:addDays(day,1),lastDay:day,lastAttemptId:event.id};
 if(event.mode==='spaced'&&day>=previous.dueDay&&day>previous.lastDay){const step=Math.min(previous.step+1,REPETITION_INTERVALS.length-1);return {taskId:event.taskId,step,dueDay:addDays(day,REPETITION_INTERVALS[step]),lastDay:day,lastAttemptId:event.id};}
 return previous;
}

/** Derived from persisted events, so replaying an event cannot duplicate a card. */
export function repetitionSchedule(pack: ContentPack, attempts: Attempt[]): Repetition[] {
 const allowed = new Set(pack.tasks.filter(isAssessable).map(t=>t.id));
 const events = currentAttempts(pack,attempts)
  .filter(a=>allowed.has(a.taskId)&&(a.result==='correct'||a.result==='wrong'))
  .sort((a,b)=>a.checkedAt-b.checkedAt||a.id.localeCompare(b.id));
 const seen = new Set<string>();
 const cards = new Map<string,Repetition>();
 for (const event of events) {
  if (seen.has(event.id)) continue;
  seen.add(event.id);
  const next=advanceRepetition(cards.get(event.taskId),event);if(next)cards.set(event.taskId,next);
 }
 return [...cards.values()].sort((a,b)=>a.dueDay.localeCompare(b.dueDay)||a.taskId.localeCompare(b.taskId));
}
export function dueRepetitions(pack: ContentPack, attempts: Attempt[], day = localDay()) {
 return repetitionSchedule(pack,attempts).filter(card=>card.dueDay<=day);
}
export function repetitionPlan(pack: ContentPack, attempts: Attempt[], day = localDay()): string[] {
 return dueRepetitions(pack,attempts,day).slice(0,DAILY_REPETITION_LIMIT).map(card=>card.taskId);
}
