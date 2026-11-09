import type {Answer,Task,Attempt,ContentPack,Result} from './schema';
export function normalize(value:string,policy:Task['policy']):string {let s=value.normalize('NFC').toLocaleLowerCase('ru').trim().replace(/\s+/gu,' ');if(policy.yo==='fold')s=s.replace(/ё/g,'е');if(policy.ignoreSpaces)s=s.replace(/\s/gu,'');return s;}
export function empty(answer:Answer|undefined):boolean {return answer===undefined||typeof answer==='string'&&!answer.trim()||Array.isArray(answer)&&answer.length===0||typeof answer==='object'&&!Array.isArray(answer)&&Object.values(answer).every(x=>!x);}
export function check(task:Task,answer:Answer|undefined):{result:Result;incomplete:boolean}{
 if(task.type==='self')return {result:'self',incomplete:false};
 if(empty(answer))return {result:'skipped',incomplete:false};
 let correct=false,incomplete=false;
 if(task.type==='text')correct=typeof answer==='string'&&task.accepted.some(x=>normalize(x,task.policy)===normalize(answer,task.policy));
 else if(task.type==='matching'){
  const a=typeof answer==='object'&&!Array.isArray(answer)?answer:{};incomplete=task.pairs.some(p=>!a[p.id]);
  correct=!incomplete&&task.pairs.every(p=>a[p.id]===(task.key as Record<string,string>)[p.id])&&Object.keys(a).every(k=>task.pairs.some(p=>p.id===k));
 }else if(Array.isArray(task.key))correct=Array.isArray(answer)&&new Set(answer).size===task.key.length&&task.key.every(x=>answer.includes(x))&&answer.every(x=>(task.key as string[]).includes(x));
 else correct=answer===task.key;
 return {result:correct?'correct':'wrong',incomplete};
}
export function currentAttempts(pack:ContentPack,attempts:Attempt[]){return attempts.filter(a=>a.packId===pack.packId&&pack.tasks.some(t=>t.id===a.taskId&&t.version===a.taskVersion));}
export function errorIds(pack:ContentPack,attempts:Attempt[]):string[]{const latest=new Map<string,Attempt>();for(const a of currentAttempts(pack,attempts))if((a.result==='correct'||a.result==='wrong')&&(!latest.has(a.taskId)||latest.get(a.taskId)!.checkedAt<=a.checkedAt))latest.set(a.taskId,a);return [...latest.values()].filter(a=>a.result==='wrong').map(a=>a.taskId);}
export function stats(pack:ContentPack,attempts:Attempt[]){const all=currentAttempts(pack,attempts),checked=all.filter(a=>a.result==='correct'||a.result==='wrong'),correct=checked.filter(a=>a.result==='correct');return {accuracy:checked.length?Math.round(correct.length/checked.length*100):0,checked:checked.length,solved:new Set(correct.map(a=>a.taskId)).size,total:pack.tasks.filter(t=>t.type!=='self').length,errors:errorIds(pack,attempts).length};}
export function selectTasks(pack:ContentPack,attempts:Attempt[],ids:string[],count:number,mixed=false):string[]{const checked=new Set(currentAttempts(pack,attempts).map(a=>a.taskId));const tasks=pack.tasks.filter(t=>ids.includes(t.id)).sort((a,b)=>Number(checked.has(a.id))-Number(checked.has(b.id)));if(!mixed)return tasks.slice(0,count).map(t=>t.id);const selected:Task[]=[],numbers=new Set<number>();for(const t of tasks)if(!numbers.has(t.oge)&&selected.length<count){selected.push(t);numbers.add(t.oge);}for(const t of tasks)if(!selected.includes(t)&&selected.length<count)selected.push(t);return selected.map(t=>t.id);}
export function remaining(endsAt:number,now=Date.now()){return Math.max(0,Math.ceil((endsAt-now)/1000));}
