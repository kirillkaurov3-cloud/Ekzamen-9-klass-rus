import {expect,it} from 'vitest';
import {pack,task,attempt} from './fixtures';
import {addDays,dueRepetitions,localDay,repetitionPlan,repetitionSchedule} from '../src/domain/repetition';

const event=(id:string,day:string,extra:Parameters<typeof attempt>[0]={})=>attempt({id,checkedAt:Date.parse(`${day}T12:00:00Z`),localDay:day,...extra});
it('uses local calendar dates and handles month, year, leap day and DST boundaries',()=>{
 expect(localDay(new Date(2026,10,11,23,59).getTime())).toBe('2026-11-11');
 expect(addDays('2026-12-31',1)).toBe('2027-01-01');expect(addDays('2028-02-28',1)).toBe('2028-02-29');expect(addDays('2026-03-28',3)).toBe('2026-03-31');
});
it('advances only assigned repetitions through 1, 3, 7, 14 days and caps the interval',()=>{
 const p=pack();const events=[event('a','2026-11-01')];
 expect(repetitionSchedule(p,events)[0]).toMatchObject({step:0,dueDay:'2026-11-02'});
 for(const [day,next,step] of [['2026-11-02','2026-11-05',1],['2026-11-05','2026-11-12',2],['2026-11-12','2026-11-26',3],['2026-11-26','2026-12-10',3]] as const){
  events.push(event(day,day,{mode:'spaced'}));expect(repetitionSchedule(p,events)[0]).toMatchObject({dueDay:next,step});
 }
 expect(dueRepetitions(p,events,'2026-12-09')).toHaveLength(0);expect(repetitionPlan(p,events,'2026-12-10')).toEqual([p.tasks[0].id]);
});
it('does not postpone due dates through same-day, early or free correct answers',()=>{
 const p=pack();const a=event('a','2026-11-01');
 const extras=[event('b','2026-11-01',{mode:'spaced'}),event('c','2026-11-02'),event('d','2026-11-03',{mode:'timed'})];
 expect(repetitionSchedule(p,[a,...extras])[0]).toMatchObject({dueDay:'2026-11-02',step:0,lastAttemptId:'a'});
 const repeat=event('e','2026-11-03',{mode:'spaced'});
 expect(repetitionSchedule(p,[a,...extras,repeat,{...repeat,id:'f'}])[0]).toMatchObject({dueDay:'2026-11-06',step:1});
});
it('restarts after an error or help; a skipped or self-assessed answer never advances it',()=>{
 const p=pack(),a=event('a','2026-11-01'),b=event('b','2026-11-02',{mode:'spaced'});
 for(const extra of [{result:'wrong' as const},{hintUsed:true}])expect(repetitionSchedule(p,[a,b,event('c','2026-11-05',{mode:'spaced',...extra})])[0]).toMatchObject({step:0,dueDay:'2026-11-06'});
 expect(repetitionSchedule(p,[a,b,event('c','2026-11-05',{mode:'spaced',result:'skipped'}),event('d','2026-11-05',{result:'self'})])[0].dueDay).toBe('2026-11-05');
});
it('replays each event once and ignores obsolete versions, foreign packs and review-only tasks',()=>{
 const p=pack(),a=event('a','2026-11-01');const b=event('b','2026-11-02',{mode:'spaced'});
 expect(repetitionSchedule(p,[b,a,b,a])).toEqual(repetitionSchedule(p,[a,b]));
 expect(repetitionSchedule(p,[{...a,taskVersion:99},{...a,packId:'other'}])).toEqual([]);
 expect(repetitionSchedule(pack([task({type:'self',timed:false,reviewRequired:true,explanation:[{type:'paragraph',text:'Образец'}]})]),[a])).toEqual([]);
});
it('bounds the series, orders overdue questions first and keeps independent pack plans',()=>{
 const tasks=Array.from({length:8},(_,i)=>task({id:`test.${i}`})),p=pack(tasks);
 const events=tasks.map((t,i)=>event(`a${i}`,i<2?'2026-10-31':'2026-11-01',{taskId:t.id}));
 expect(dueRepetitions(p,events,'2026-11-02')).toHaveLength(8);expect(repetitionPlan(p,events,'2026-11-02')).toEqual(tasks.slice(0,5).map(t=>t.id));
});
