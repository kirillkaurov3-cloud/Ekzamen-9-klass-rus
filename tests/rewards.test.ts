import {expect,it} from 'vitest';
import {rewards,DAILY_XP_LIMIT} from '../src/domain/rewards';
import {attempt,pack,task} from './fixtures';
import type {State} from '../src/domain/schema';
const at=(day:string)=>Date.parse(day+'T12:00:00Z');
const state=(extra:Partial<State>={}):State=>({pack:pack(),attempts:[],sessions:[],active:null,learningSessions:[],activeLearning:null,punctuationSessions:[],activePunctuation:null,studySessions:[],activeStudy:null,theme:'system',...extra});
it('replays events once, rewards independent first answers and assigned repeats rather than early practice',()=>{
 const first=attempt({id:'first',checkedAt:at('2026-11-16'),localDay:'2026-11-16'}),early=attempt({id:'early',checkedAt:at('2026-11-16')+1,localDay:'2026-11-16'}),due=attempt({id:'due',checkedAt:at('2026-11-17'),localDay:'2026-11-17',mode:'spaced'});
 const s=state({attempts:[first,early,due,due]});expect(rewards(s,'2026-11-17')).toMatchObject({total:15,today:5});expect(rewards({...s,attempts:[...s.attempts,...s.attempts]})).toEqual(rewards(s));
 expect(rewards(state({attempts:[{...first,hintUsed:true}]})).total).toBe(0);
});
it('caps daily experience, keeps it after content revisions and does not create a penalty on inactive days',()=>{
 const tasks=Array.from({length:30},(_,i)=>task({id:`task.${i}`})),p=pack(tasks),attempts=tasks.map((t,i)=>attempt({id:`a.${i}`,taskId:t.id,checkedAt:at('2026-11-16')+i,localDay:'2026-11-16'}));
 const s=state({pack:p,attempts});expect(rewards(s,'2026-11-16')).toMatchObject({total:DAILY_XP_LIMIT,today:DAILY_XP_LIMIT});expect(rewards(s,'2026-11-30')).toMatchObject({total:DAILY_XP_LIMIT,today:0});expect(rewards({...s,pack:{...p,tasks:p.tasks.map(t=>({...t,version:2}))}}).total).toBe(DAILY_XP_LIMIT);
});
it('rewards honest self-assessment equally, never farms repeated same-day cards or duplicate lesson completion',()=>{
 const day='2026-11-16',time=at(day);const base={id:'self',activityId:'cards.self.1',activityVersion:1,taskId:'test.2.1',taskVersion:1,kind:'self' as const,mode:'cards' as const,answer:{roles:{},choice:'',example:'',hintUsed:false,revealed:true,rating:0 as const},correct:null,independent:false,checkedAt:time,localDay:day};
 const session={id:'s',packId:'test-pack',mode:'lesson' as const,plan:['self'],versions:{self:1},position:0,drafts:{},results:{self:base},status:'completed' as const,startedAt:time,lastOpenedAt:time,finishedAt:time,lessonId:'lesson.1'};
 const low=state({studySessions:[session,{...session,id:'s2',results:{self:{...base,id:'self2',checkedAt:time+1}}}]});const high=state({studySessions:[{...session,results:{self:{...base,answer:{...base.answer,rating:2}}}}]});
 expect(rewards(low).total).toBe(17);expect(rewards(high).total).toBe(17);expect(rewards(low).achievements.find(a=>a.id==='first')?.earned).toBe(false);
});
it('earns a correction badge only for a later independent correct answer',()=>{
 const wrong=attempt({result:'wrong',id:'wrong',checkedAt:1}),right=attempt({id:'right',checkedAt:2});expect(rewards(state({attempts:[wrong,right]})).achievements.find(a=>a.id==='repair')?.earned).toBe(true);expect(rewards(state({attempts:[wrong,{...right,hintUsed:true}]})).achievements.find(a=>a.id==='repair')?.earned).toBe(false);
});
