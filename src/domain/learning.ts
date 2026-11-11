import type {Attempt, ContentPack, Session, Task} from './schema';
import {currentAttempts} from './engine';

export const OGE_NUMBERS = [2,3,4,5,6,7,8,9,11,12] as const;
export const isDiagnosticEligible = (task:Task) => task.type !== 'self' && !task.reviewRequired && task.verification === 'manual';
export const isAssessable = (task:Task) => task.type !== 'self' && !task.reviewRequired;

export function diagnosticPlan(pack:ContentPack, attempts:Attempt[]){
 const seen=new Set(currentAttempts(pack,attempts).map(a=>a.taskId));
 return OGE_NUMBERS.map(n=>pack.tasks.filter(t=>t.oge===n&&isDiagnosticEligible(t)).sort((a,b)=>
  Number(b.verification==='manual')-Number(a.verification==='manual') || Number(seen.has(a.id))-Number(seen.has(b.id))
 )[0]?.id).filter((id):id is string=>!!id);
}
export function missingDiagnosticNumbers(pack:ContentPack){
 return OGE_NUMBERS.filter(n=>!pack.tasks.some(t=>t.oge===n&&isDiagnosticEligible(t)));
}
export function validateDiagnosticPlan(pack:ContentPack, ids:string[]){
 const tasks=ids.map(id=>pack.tasks.find(t=>t.id===id));
 return ids.length===10 && new Set(ids).size===10 && tasks.every((t):t is Task=>!!t&&isDiagnosticEligible(t)) && OGE_NUMBERS.every(n=>tasks.filter(t=>t?.oge===n).length===1);
}
export function diagnosticAreas(pack:ContentPack, session:Session){
 return OGE_NUMBERS.map(oge=>{
  const task=pack.tasks.find(t=>session.taskIds.includes(t.id)&&t.oge===oge);
  const result=task?session.results[task.id]:undefined;
  const current=!!task&&isDiagnosticEligible(task)&&result?.taskVersion===task.version;
  return {oge,taskId:task?.id,result:current?result?.result:undefined,checked:current&&(result?.result==='correct'||result?.result==='wrong')?1:0};
 });
}
export function recommendation(pack:ContentPack, attempts:Attempt[]){
 const latest=new Map<string,Attempt>();
 for(const a of currentAttempts(pack,attempts))if((a.result==='correct'||a.result==='wrong')&&(!latest.has(a.taskId)||latest.get(a.taskId)!.checkedAt<=a.checkedAt))latest.set(a.taskId,a);
 const choices=pack.topics.map(topic=>{
  const tasks=pack.tasks.filter(t=>t.topicIds.includes(topic.id)&&isAssessable(t));
  const checked=tasks.filter(t=>latest.has(t.id)).length;
  const wrong=tasks.filter(t=>latest.get(t.id)?.result==='wrong').length;
  const lastPracticed=tasks.reduce((last,t)=>Math.max(last,latest.get(t.id)?.checkedAt??0),0);
  return {topic,tasks,checked,wrong,lastPracticed};
 }).filter(c=>c.tasks.length).sort((a,b)=>b.wrong-a.wrong||a.checked-b.checked||a.lastPracticed-b.lastPracticed);
 const chosen=choices[0];if(!chosen)return null;
 const ordered=[...chosen.tasks].sort((a,b)=>{
  const rank=(t:Task)=>latest.get(t.id)?.result==='wrong'?0:!latest.has(t.id)?1:2;
  return rank(a)-rank(b);
 });
 const reason=chosen.wrong?'По этой теме ещё есть неисправленные ошибки. Разберём правило и повторим задание.':chosen.checked<3?'По этой теме пока мало данных. Короткая практика поможет уточнить первичную оценку.':'Последние ответы верны. Закрепим правило на короткой практике.';
 return {topic:chosen.topic,taskIds:ordered.slice(0,5).map(t=>t.id),evidenceCount:chosen.checked,errorCount:chosen.wrong,reason};
}
