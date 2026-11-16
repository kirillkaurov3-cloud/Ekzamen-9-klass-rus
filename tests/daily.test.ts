import 'fake-indexeddb/auto';
import {readFileSync} from 'node:fs';
import {afterAll,beforeEach,expect,it,vi} from 'vitest';
import * as store from '../src/storage/store';
import {ContentPackSchema,type Answer} from '../src/domain/schema';
import {dailyStudyPlan,emptyStudyDraft,expectedRoles,resolveStudy,studyCardSchedule,type StudyActivity} from '../src/domain/study';
import {errorIds,stats} from '../src/domain/engine';
import {repetitionSchedule} from '../src/domain/repetition';
const book=ContentPackSchema.parse(JSON.parse(readFileSync('public/packs/praktikum-2027.json','utf8')));
beforeEach(async()=>{vi.restoreAllMocks();await store.db.delete();await store.db.open();await store.loadState();});
afterAll(async()=>{await store.db.delete();});
function answer(a:StudyActivity,pack:typeof book){
 if(a.kind==='tokens')return {roles:expectedRoles(a)};
 if(a.kind==='choice')return {choice:a.key};
 if(a.kind==='self')return {revealed:true,rating:2 as const};
 const task=pack.tasks.find(t=>t.id===a.sourceTaskId)!;
 return {ordinary:(task.type==='text'?task.accepted[0]:task.key) as Answer};
}
it('fixes the daily plan across date changes and reload, with due tasks, a lesson and two different numbers',async()=>{
 vi.spyOn(Date,'now').mockReturnValue(new Date(2026,10,16,12).getTime());await store.importPack(book);
 const task=book.tasks.find(t=>t.oge===3&&t.verification==='manual')!;
 await store.startSession([task.id],'practice',1);await store.saveDraft(task.id,task.key);await store.checkCurrent();await store.finishSession();
 vi.spyOn(Date,'now').mockReturnValue(new Date(2026,10,17,12).getTime());let state=await store.loadState();const plan=dailyStudyPlan(book,state.studySessions,state.attempts);expect(plan.filter(a=>a.canonicalMode==='spaced')).toHaveLength(1);expect(plan.filter(a=>a.mode==='lesson')).toHaveLength(5);const practice=plan.filter(a=>a.canonicalMode==='practice');expect(practice).toHaveLength(2);expect(new Set(practice.map(a=>book.tasks.find(t=>t.id===a.sourceTaskId)!.oge)).size).toBe(2);
 state=await store.startStudy('daily');const original=state.activeStudy!;await store.saveStudyDraft(original.id,plan[0].id,answer(plan[0],book));
 vi.spyOn(Date,'now').mockReturnValue(new Date(2026,10,18,12).getTime());state=await store.startStudy('daily');expect(state.activeStudy?.id).toBe(original.id);expect(state.activeStudy?.day).toBe('2026-11-17');expect(state.activeStudy?.plan).toEqual(original.plan);expect(state.activeStudy?.drafts[plan[0].id]).toEqual({...emptyStudyDraft(),...answer(plan[0],book)});
 await Promise.all([store.checkStudyCurrent(original.id,plan[0].id),store.checkStudyCurrent(original.id,plan[0].id)]);state=await store.loadState();expect(state.attempts).toHaveLength(2);expect(state.attempts.at(-1)).toMatchObject({mode:'spaced',result:'correct'});expect(repetitionSchedule(book,state.attempts).find(c=>c.taskId===task.id)?.step).toBe(1);expect(await store.db.attempts.count()).toBe(1);
});
it('grades daily canonical tasks exactly once, separates interactive practice and closes the day',async()=>{
 vi.spyOn(Date,'now').mockReturnValue(new Date(2026,10,16,12).getTime());await store.importPack(book);let state=await store.startStudy('daily');const session=state.activeStudy!;
 for(const id of session.plan){const a=resolveStudy(book,id)!;if(a.kind!=='read'){await store.saveStudyDraft(session.id,id,answer(a,book));await store.checkStudyCurrent(session.id,id);}await store.nextStudy(session.id,id);}
 state=await store.loadState();expect(state.activeStudy).toBeNull();expect(state.attempts).toHaveLength(2);expect(stats(book,state.attempts).solved).toBe(2);expect(state.studySessions[0].results).toBeDefined();expect(dailyStudyPlan(book,state.studySessions,state.attempts)).toEqual([]);expect(dailyStudyPlan(book,state.studySessions,state.attempts,'2026-11-17').filter(a=>a.mode==='lesson')[0].lessonId).toBe('lesson.2');
});
it('runs in demo, records wrong/helped answers honestly and invalidates revised ordinary sources',async()=>{
 let state=await store.loadState();const demo=state.pack;state=await store.startStudy('daily');const session=state.activeStudy!;expect(session.plan).toHaveLength(4);
 for(const id of session.plan){const a=resolveStudy(demo,id)!;if(a.kind==='read'){await store.nextStudy(session.id,id);continue;}
 await store.saveStudyDraft(session.id,id,{ordinary:['wrong'],hintUsed:true});await store.checkStudyCurrent(session.id,id);await store.nextStudy(session.id,id);}
 state=await store.loadState();expect(state.attempts).toHaveLength(2);expect(state.attempts.every(a=>a.result==='wrong'&&a.hintUsed)).toBe(true);expect(errorIds(demo,state.attempts)).toHaveLength(2);const revised=structuredClone(demo);revised.packVersion+='-revision';for(const t of revised.tasks)t.version++;state=await store.importPack(revised);expect(state.attempts).toHaveLength(0);
});
it('counts cards reviewed inside a daily session in their own calendar schedule',async()=>{
 vi.spyOn(Date,'now').mockReturnValue(new Date(2026,10,16,12).getTime());await store.importPack(book);let state=await store.startStudy('cards');const cardSession=state.activeStudy!;
 for(const id of cardSession.plan){const a=resolveStudy(book,id)!;await store.saveStudyDraft(cardSession.id,id,answer(a,book));await store.checkStudyCurrent(cardSession.id,id);await store.nextStudy(cardSession.id,id);}
 vi.spyOn(Date,'now').mockReturnValue(new Date(2026,10,17,12).getTime());state=await store.startStudy('daily');const daily=state.activeStudy!;expect(daily.plan.slice(0,5).every(id=>id.startsWith('cards.'))).toBe(true);
 const id=daily.plan[0],a=resolveStudy(book,id)!;await store.saveStudyDraft(daily.id,id,answer(a,book));await store.checkStudyCurrent(daily.id,id);state=await store.loadState();expect(studyCardSchedule(book,state.studySessions).find(c=>c.id===id)).toMatchObject({step:1,due:'2026-11-20'});
});
