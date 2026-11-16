import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import {readFileSync} from 'node:fs';
import {afterAll,beforeEach,expect,it,vi} from 'vitest';
import {ContentPackSchema} from '../src/domain/schema';
import {emptyStudyDraft,expectedRoles,gradeStudy,studyActivities,studyPlan,wordTokens,currentStudyAttempts} from '../src/domain/study';
import {stats} from '../src/domain/engine';
import {workshopResume} from '../src/domain/workshop';
import {punctuationExercises,type PunctuationSession} from '../src/domain/punctuation';
import * as store from '../src/storage/store';
const book=ContentPackSchema.parse(JSON.parse(readFileSync('public/packs/praktikum-2027.json','utf8')));
beforeEach(async()=>{vi.restoreAllMocks();await store.db.delete();await store.db.open();await store.loadState();});
afterAll(async()=>{await store.db.delete();});

it('links five complete sentences to the checked source and preserves punctuation and stable word IDs',()=>{
 const activities=studyPlan(book,'grammar');expect(activities).toHaveLength(5);
 for(const a of activities){
  const task=book.tasks.find(t=>t.id===a.sourceTaskId)!;expect(task.source.pages).toContain(36);expect(task.source.answerPages).toContain(417);
  expect(book.texts.find(t=>t.id===task.textId)!.blocks.some(b=>'text' in b&&b.text.includes(a.prompt))).toBe(true);
  const tokens=wordTokens(a);expect(tokens).toEqual(wordTokens(a));expect(new Set(tokens.map(t=>t.id)).size).toBe(tokens.length);
  for(const token of tokens)expect(a.prompt.slice(token.start,token.end)).toBe(token.text);
  expect(gradeStudy(a,{...emptyStudyDraft(),roles:expectedRoles(a)},book)).toEqual({correct:true,complete:true});
 }
 const fourth=activities[3],roles=Object.values(expectedRoles(fourth));expect(roles).toEqual(['main','main']);
 expect(Object.values(expectedRoles(activities[1])).filter(r=>r==='predicate')).toHaveLength(3);
 expect(Object.values(expectedRoles(activities[4])).filter(r=>r==='predicate')).toHaveLength(6);
});
it('detects extra words, missing words and incorrect roles instead of accepting an incomplete basis',()=>{
 const [a,,,single]=studyPlan(book,'grammar'),roles=expectedRoles(a),extra=wordTokens(a)[0].id;
 expect(gradeStudy(a,emptyStudyDraft(),book)).toMatchObject({complete:false});
 expect(gradeStudy(a,{...emptyStudyDraft(),roles:{...roles,[extra]:'subject'}},book).correct).toBe(false);
 const wrong=Object.fromEntries(Object.keys(expectedRoles(single)).map(id=>[id,'predicate' as const]));expect(gradeStudy(single,{...emptyStudyDraft(),roles:wrong},book).correct).toBe(false);
});
it('uses five actual false assertions and independently checks repair and confirming example',()=>{
 const activities=studyPlan(book,'reason');expect(activities).toHaveLength(5);expect(new Set(activities.map(a=>a.sourceTaskId)).size).toBe(5);
 for(const a of activities){
  const task=book.tasks.find(t=>t.id===a.sourceTaskId)!;expect(task.key).toBe('false');expect(task.verification).toBe('manual');expect(task.source.pages).toContain(212);expect(task.source.answerPages).toContain(460);
  expect(a.prompt).toBe(task.prompt.slice(1).flatMap(b=>'text' in b?[b.text]:[]).join('\n'));
  expect(gradeStudy(a,{...emptyStudyDraft(),choice:a.key!},book)).toMatchObject({complete:false});
  expect(gradeStudy(a,{...emptyStudyDraft(),choice:a.key!,example:'not-proof'},book)).toEqual({correct:false,complete:true});
  expect(gradeStudy(a,{...emptyStudyDraft(),choice:a.key!,example:a.exampleKey!},book)).toEqual({correct:true,complete:true});
 }
});
it('does not expose a changed edition or a source sentence that no longer matches the annotation',()=>{
 expect(studyActivities({...book,source:{...book.source,checksum:'wrong'}})).toEqual([]);
 const changed={...book,texts:book.texts.map(t=>({...t,blocks:[]}))};expect(studyPlan(changed,'grammar')).toEqual([]);expect(studyPlan(changed,'reason')).toHaveLength(5);
});
it('restores two drafts, preserves help, and resumes the most recently opened mode',async()=>{
 await store.importPack(book);vi.spyOn(Date,'now').mockReturnValue(1000);let state=await store.startStudy('grammar');const grammar=studyPlan(book,'grammar')[0],id=state.activeStudy!.id;
 await store.saveStudyDraft(id,grammar.id,{roles:expectedRoles(grammar),hintUsed:true});await store.saveStudyDraft(id,grammar.id,{hintUsed:false});
 vi.spyOn(Date,'now').mockReturnValue(2000);state=await store.startStudy('reason');const reasonId=state.activeStudy!.id,reason=studyPlan(book,'reason')[0];await store.saveStudyDraft(reasonId,reason.id,{choice:'right'});
 expect(workshopResume(await store.loadState())?.path).toBe('/workshop/reason');vi.spyOn(Date,'now').mockReturnValue(3000);state=await store.startStudy('grammar');expect(state.activeStudy?.id).toBe(id);expect(state.activeStudy?.drafts[grammar.id].hintUsed).toBe(true);expect(state.studySessions.find(s=>s.id===reasonId)?.drafts[reason.id].choice).toBe('right');
 await store.useDemo();expect((await store.loadState()).activeStudy).toBeNull();state=await store.importPack(book);expect(state.activeStudy?.id).toBe(id);
});
it('checks once and guards navigation with the expected step so double next cannot skip a question',async()=>{
 await store.importPack(book);const state=await store.startStudy('grammar'),session=state.activeStudy!,[a,b]=studyPlan(book,'grammar');await store.saveStudyDraft(session.id,a.id,{roles:expectedRoles(a)});
 await Promise.all([store.checkStudyCurrent(session.id,a.id),store.checkStudyCurrent(session.id,a.id)]);expect(currentStudyAttempts(book,(await store.loadState()).studySessions)).toHaveLength(1);
 await Promise.all([store.nextStudy(session.id,a.id),store.nextStudy(session.id,a.id)]);const next=await store.loadState();expect(next.activeStudy?.position).toBe(1);expect(next.activeStudy?.plan[1]).toBe(b.id);expect(stats(book,next.attempts).solved).toBe(0);
});
it('rejects unknown tokens and rolls back a failed result write while retaining the draft',async()=>{
 await store.importPack(book);const state=await store.startStudy('grammar'),session=state.activeStudy!,[a]=studyPlan(book,'grammar');
 await expect(store.saveStudyDraft(session.id,a.id,{roles:{unknown:'subject'}})).rejects.toThrow('Неизвестное');await store.saveStudyDraft(session.id,a.id,{roles:expectedRoles(a)});
 const failure=vi.spyOn(store.db.studySessions,'put').mockRejectedValueOnce(new Error('QuotaExceededError'));await expect(store.checkStudyCurrent(session.id,a.id)).rejects.toThrow('QuotaExceededError');failure.mockRestore();const restored=await store.loadState();expect(restored.activeStudy?.results).toEqual({});expect(restored.activeStudy?.drafts[a.id].roles).toEqual(expectedRoles(a));
});
it('adds database v4 without deleting a saved punctuation series from v3',async()=>{
 await store.db.delete();const legacy=new Dexie('zapyataya-v1');legacy.version(1).stores({packs:'packId',sessions:'id,packId,status',attempts:'id,packId,sessionId',settings:'key'});legacy.version(2).stores({learningSessions:'id,packId,status'});legacy.version(3).stores({punctuationSessions:'id,packId,status'});await legacy.open();
 const exercises=punctuationExercises(book),e=exercises[0];const old:PunctuationSession={id:'saved-v3',packId:book.packId,exerciseIds:exercises.map(e=>e.id),exerciseVersions:Object.fromEntries(exercises.map(e=>[e.id,e.version])),position:0,drafts:{[e.id]:{signs:{'1':'—'},selected:'2',hintUsed:true}},results:{},status:'active',startedAt:1,lastOpenedAt:1};
 await legacy.table('packs').put(book);await legacy.table('settings').put({key:'pack',value:book.packId});await legacy.table('punctuationSessions').put(old);legacy.close();await store.db.open();const restored=await store.loadState();expect(restored.activePunctuation).toEqual(old);expect(restored.studySessions).toEqual([]);
});
