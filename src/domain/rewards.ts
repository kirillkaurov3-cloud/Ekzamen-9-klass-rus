import type {Attempt,State} from './schema';
import {addDays,localDay,repetitionSchedule,REPETITION_INTERVALS} from './repetition';
export const DAILY_XP_LIMIT=100;
export interface Reward {id:string;day:string;at:number;points:number;reason:string;exercise?:string;limit?:number}
export const LEVELS=[{at:0,title:'Первые шаги'},{at:50,title:'В ритме'},{at:150,title:'Набираю уверенность'},{at:300,title:'Знаю, как проверить'},{at:600,title:'Уверенная практика'}];
/** A deterministic ledger of persisted events. No mutable balance and no rewards for taps. */
export function rewards(state:State,day=localDay()) {
 const candidates:Reward[]=[],known=new Set<string>(),first=new Set<string>(),corrected=new Set<string>(),wrong=new Set<string>();
 const canonical=new Map<string,Attempt>();
 for(const a of [...state.attempts,...state.studySessions.flatMap(s=>Object.values(s.results).flatMap(a=>a.canonical?[a.canonical]:[]))])if(a.packId===state.pack.packId)canonical.set(a.id,a);
 const history:Attempt[]=[];
 for(const a of [...canonical.values()].sort((a,b)=>a.checkedAt-b.checkedAt||a.id.localeCompare(b.id))){
  const key=`task:${a.taskId}:v${a.taskVersion}`,date=a.localDay??localDay(a.checkedAt);
  if(a.result==='wrong')wrong.add(key);
  if(a.result==='correct'&&!a.hintUsed){
   if(wrong.has(key))corrected.add(key);
   const due=repetitionSchedule(state.pack,history).find(c=>c.taskId===a.taskId);
   const points=!first.has(key)?10:a.mode==='spaced'&&due&&due.dueDay<=date?5:0;
   if(points)candidates.push({id:`answer:${a.id}`,day:date,at:a.checkedAt,points,reason:!first.has(key)?'Первое самостоятельное решение':'Повторение по сроку',exercise:key,limit:10});
   first.add(key);
  }
  history.push(a);
 }
 const interactive:{id:string;key:string;at:number;day:string;success:boolean}[]=[];
 for(const s of state.learningSessions)for(const a of Object.values(s.results))interactive.push({id:a.id,key:`letter:${a.exerciseId}:v${a.exerciseVersion}`,at:a.checkedAt,day:a.localDay,success:a.lettersCorrect&&a.ruleCorrect&&!a.answer.hintUsed});
 for(const s of state.punctuationSessions)for(const a of Object.values(s.results))interactive.push({id:a.id,key:`punctuation:${a.exerciseId}:v${a.exerciseVersion}`,at:a.checkedAt,day:a.localDay,success:a.correctPositions===a.totalPositions&&!a.answer.hintUsed});
 const self=new Map<string,{step:number;due:string;last:string}>();
 for(const a of state.studySessions.flatMap(s=>Object.values(s.results)).sort((a,b)=>a.checkedAt-b.checkedAt||a.id.localeCompare(b.id))){
  if(known.has(a.id))continue;known.add(a.id);
  const key=`study:${a.activityId}:v${a.activityVersion}`;
  if(a.kind==='self'){
   const previous=self.get(key),assigned=!previous||a.localDay>=previous.due&&a.localDay>previous.last;
   // Honest self-assessment earns the same small reward for every rating.
   if(assigned)candidates.push({id:`self:${a.id}`,day:a.localDay,at:a.checkedAt,points:2,reason:'Карточка: воспоминание и самооценка',exercise:key,limit:2});
   if(!previous||a.answer.rating!==2||a.answer.hintUsed)self.set(key,{step:0,due:addDays(a.localDay,1),last:a.localDay});
   else if(assigned){const step=Math.min(3,previous.step+1);self.set(key,{step,due:addDays(a.localDay,REPETITION_INTERVALS[step]),last:a.localDay});}
  }else if(a.kind!=='ordinary'&&a.kind!=='read')interactive.push({id:a.id,key,at:a.checkedAt,day:a.localDay,success:a.correct===true&&a.independent});
 }
 for(const a of interactive.sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id))){if(!a.success||first.has(a.key))continue;first.add(a.key);candidates.push({id:`interactive:${a.id}`,day:a.day,at:a.at,points:5,reason:'Первый самостоятельный учебный ответ',exercise:a.key,limit:5});}
 const completedLessons=new Set<string>();
 for(const s of state.studySessions.filter(s=>s.status==='completed').sort((a,b)=>(a.finishedAt??a.startedAt)-(b.finishedAt??b.startedAt))){
  const at=s.finishedAt??s.startedAt,date=localDay(at);
  if(s.lessonId){completedLessons.add(s.lessonId);candidates.push({id:`lesson:${date}:${s.lessonId}`,day:date,at,points:15,reason:'Короткий урок завершён'});}
  if(s.mode==='daily')candidates.push({id:`daily:${date}`,day:date,at,points:5,reason:'Дневной план завершён'});
 }
 const ledger:Reward[]=[],seen=new Set<string>(),daily=new Map<string,number>(),perExercise=new Map<string,number>();
 for(const event of candidates.sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id))){
  if(seen.has(event.id))continue;seen.add(event.id);const used=daily.get(event.day)??0,exerciseKey=`${event.day}:${event.exercise}`,usedExercise=perExercise.get(exerciseKey)??0;
  const points=Math.max(0,Math.min(event.points,DAILY_XP_LIMIT-used,event.limit===undefined?Infinity:event.limit-usedExercise));
  if(!points)continue;ledger.push({...event,points});daily.set(event.day,used+points);if(event.exercise)perExercise.set(exerciseKey,usedExercise+points);
 }
 const total=ledger.reduce((n,e)=>n+e.points,0),level=LEVELS.filter(l=>l.at<=total).at(-1)!,next=LEVELS.find(l=>l.at>total);
 const days=new Set(ledger.map(e=>e.day));
 const achievements=[{id:'first',title:'Первый шаг',description:'Самостоятельно решить проверяемое задание',earned:first.size>0},{id:'lesson',title:'Правило стало понятнее',description:'Закончить короткий урок',earned:completedLessons.size>0},{id:'repair',title:'Разобрался',description:'Самостоятельно исправить прежнюю ошибку',earned:corrected.size>0},{id:'days',title:'Свой ритм',description:'Практиковаться в семь разных дней, без обязательной серии подряд',earned:days.size>=7}];
 return {total,today:daily.get(day)??0,ledger,level,next,achievements};
}
