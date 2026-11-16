import 'fake-indexeddb/auto';
import {readFileSync} from 'node:fs';
import {afterAll,beforeEach,expect,it,vi} from 'vitest';
import {ContentPackSchema} from '../src/domain/schema';
import {currentStudyAttempts,emptyStudyDraft,expectedRoles,gradeStudy,studyActivities,studyCardSchedule,studyPlan,type StudyActivity,type StudyAttempt,type StudySession} from '../src/domain/study';
import * as store from '../src/storage/store';
const book=ContentPackSchema.parse(JSON.parse(readFileSync('public/packs/praktikum-2027.json','utf8')));
beforeEach(async()=>{vi.restoreAllMocks();await store.db.delete();await store.db.open();await store.loadState();});
afterAll(async()=>{await store.db.delete();});

it('provides five distinct five-step lessons with two independent questions and a source example',()=>{
 const activities=studyActivities(book).filter(a=>a.mode==='lesson');expect(activities).toHaveLength(25);expect(new Set(activities.map(a=>a.id)).size).toBe(25);
 for(let n=1;n<=5;n++){
  const plan=studyPlan(book,'lesson',[],[],undefined,`lesson.${n}`);expect(plan.map(a=>a.kind)).toEqual(['read','read','tokens','tokens','tokens']);expect(plan.filter(a=>a.independent)).toHaveLength(2);expect(plan.at(-1)?.origin).toBe('source');
  for(const a of plan.filter(a=>a.kind==='tokens'))expect(gradeStudy(a,{...emptyStudyDraft(),roles:expectedRoles(a)},book)).toEqual({correct:true,complete:true});
 }
 const noText={...book,texts:[]};expect(studyPlan(noText,'lesson')).toEqual([]);expect(studyPlan(noText,'cards')).toEqual([]);
});
it('persists lesson steps and refuses replacing an unfinished lesson with a different promise',async()=>{
 await store.importPack(book);let state=await store.startStudy('lesson','lesson.1');const id=state.activeStudy!.id,plan=studyPlan(book,'lesson',[],[],undefined,'lesson.1');
 await Promise.all([store.nextStudy(id,plan[0].id),store.nextStudy(id,plan[0].id)]);expect((await store.loadState()).activeStudy?.position).toBe(1);await store.nextStudy(id,plan[1].id);await expect(store.startStudy('lesson','lesson.2')).rejects.toThrow('начатый урок');
 for(const a of plan.slice(2)){await store.saveStudyDraft(id,a.id,{roles:expectedRoles(a)});await store.checkStudyCurrent(id,a.id);await store.nextStudy(id,a.id);}
 state=await store.loadState();const results=currentStudyAttempts(book,state.studySessions);expect(results.filter(a=>a.correct!==null)).toHaveLength(3);expect(results.filter(a=>a.independent)).toHaveLength(2);expect(state.studySessions[0]).toMatchObject({status:'completed',lessonId:'lesson.1'});expect(studyPlan(book,'lesson',state.studySessions)[0].lessonId).toBe('lesson.2');
});
it('requires revealing a self-assessment card and never converts its rating into objective correctness',async()=>{
 await store.importPack(book);const state=await store.startStudy('cards'),session=state.activeStudy!,plan=studyPlan(book,'cards');const first=plan[0],self=plan[1];expect(self.kind).toBe('self');
 await store.saveStudyDraft(session.id,first.id,{choice:first.key!});await store.checkStudyCurrent(session.id,first.id);await store.nextStudy(session.id,first.id);
 expect(gradeStudy(self,{...emptyStudyDraft(),rating:2},book)).toMatchObject({complete:false});await store.saveStudyDraft(session.id,self.id,{revealed:true,rating:2});await store.saveStudyDraft(session.id,self.id,{revealed:false});await store.checkStudyCurrent(session.id,self.id);
 const result=(await store.loadState()).activeStudy!.results[self.id];expect(result.correct).toBeNull();expect(result.independent).toBe(false);expect(result.answer.revealed).toBe(true);
});
function event(activity:StudyActivity,id:string,day:string,extra:Partial<StudyAttempt>={}):StudyAttempt {
 return {id,activityId:activity.id,activityVersion:activity.version,taskId:activity.sourceTaskId,taskVersion:activity.sourceTaskVersion,kind:activity.kind,mode:'cards',answer:{...emptyStudyDraft(),choice:activity.key??'',revealed:true,rating:2},correct:activity.kind==='self'?null:true,independent:activity.kind!=='self',checkedAt:Date.parse(day+'T12:00:00Z'),localDay:day,...extra};
}
function history(events:StudyAttempt[]):StudySession[]{return [{id:'history',packId:book.packId,mode:'cards',plan:events.map(a=>a.activityId),versions:Object.fromEntries(events.map(a=>[a.activityId,a.activityVersion])),position:0,drafts:{},results:Object.fromEntries(events.map(a=>[a.id,a])),status:'completed',startedAt:1,lastOpenedAt:1}];}
it('schedules objective answers and self-recall independently at 1/3/7/14 calendar days',()=>{
 for(const a of studyActivities(book).filter(a=>a.mode==='cards').slice(0,2)){
  const events=[event(a,'first','2026-11-16')];expect(studyCardSchedule(book,history(events))[0]).toMatchObject({step:0,due:'2026-11-17',self:a.kind==='self'});
  for(const [day,next,step] of [['2026-11-17','2026-11-20',1],['2026-11-20','2026-11-27',2],['2026-11-27','2026-12-11',3]] as const){events.push(event(a,day,day));expect(studyCardSchedule(book,history(events))[0]).toMatchObject({step,due:next});}
  expect(studyCardSchedule(book,history([...events,...events]))).toEqual(studyCardSchedule(book,history(events)));
 }
});
it('restarts cards after an error, partial recall or help and ignores early repeated success',()=>{
 const activities=studyActivities(book).filter(a=>a.mode==='cards'),objective=activities.find(a=>a.kind==='choice')!,self=activities.find(a=>a.kind==='self')!;
 for(const a of [objective,self]){
  const first=event(a,'a','2026-11-16'),success=event(a,'b','2026-11-17'),early=event(a,'c','2026-11-17');expect(studyCardSchedule(book,history([first,success,early]))[0].due).toBe('2026-11-20');
  const wrong=event(a,'d','2026-11-20',{correct:a.kind==='self'?null:false,answer:{...emptyStudyDraft(),revealed:true,rating:1}});expect(studyCardSchedule(book,history([first,success,wrong]))[0]).toMatchObject({step:0,due:'2026-11-21'});
  const help=event(a,'e','2026-11-20',{independent:false,answer:{...emptyStudyDraft(),revealed:true,rating:2,hintUsed:true}});expect(studyCardSchedule(book,history([first,success,help]))[0]).toMatchObject({step:0,due:'2026-11-21'});
 }
});
it('issues fixed five-card series, covers ten cards and does not offer future cards again today',async()=>{
 await store.importPack(book);const day=new Date(2026,10,16,12).getTime();vi.spyOn(Date,'now').mockReturnValue(day);const seen=new Set<string>();
 for(let round=0;round<2;round++){
  let state=await store.loadState();const plan=studyPlan(book,'cards',state.studySessions,state.attempts);expect(plan).toHaveLength(5);state=await store.startStudy('cards');const id=state.activeStudy!.id;
  expect((await store.loadState()).activeStudy?.plan).toEqual(plan.map(a=>a.id));
  for(const a of plan){expect(seen.has(a.id)).toBe(false);seen.add(a.id);await store.saveStudyDraft(id,a.id,a.kind==='self'?{revealed:true,rating:2}:{choice:a.key!});await store.checkStudyCurrent(id,a.id);await store.nextStudy(id,a.id);}
 }
 const state=await store.loadState();expect(seen.size).toBe(10);expect(studyPlan(book,'cards',state.studySessions)).toEqual([]);expect(studyPlan(book,'cards',state.studySessions,[],'2026-11-17')).toHaveLength(5);expect(state.attempts).toHaveLength(0);
});
