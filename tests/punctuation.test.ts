import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import {readFileSync} from 'node:fs';
import {afterAll,beforeEach,expect,it,vi} from 'vitest';
import {ContentPackSchema,type Attempt} from '../src/domain/schema';
import {stats} from '../src/domain/engine';
import {checkPunctuation,punctuationExercises,punctuationResults,punctuationText,splitPunctuationText} from '../src/domain/punctuation';
import {letterExercises,type LearningSession} from '../src/domain/interactive';
import {workshopResume} from '../src/domain/workshop';
import * as store from '../src/storage/store';
import {attempt} from './fixtures';

const book=ContentPackSchema.parse(JSON.parse(readFileSync('public/packs/praktikum-2027.json','utf8')));
beforeEach(async()=>{vi.restoreAllMocks();await store.db.delete();await store.db.open();await store.loadState();});
afterAll(async()=>{await store.db.delete();});

it('maps all 43 positions in five distinct source tasks to their original per-position explanations',()=>{
 const exercises=punctuationExercises(book);expect(exercises).toHaveLength(5);expect(new Set(exercises.map(e=>e.taskId)).size).toBe(5);expect(exercises.reduce((n,e)=>n+e.positions.length,0)).toBe(43);
 for(const e of exercises){
  const task=book.tasks.find(t=>t.id===e.taskId)!;
  expect(task.source.pages).toContain(172);expect(task.source.answerPages.some(p=>p===440||p===441)).toBe(true);
  const source=task.explanation.flatMap(b=>'text' in b?[b.text]:[]).join(' ');
  for(const p of e.positions){
   const explanation=source.match(new RegExp(`\\(${p.id}\\) ([\\s\\S]*?)(?=\\(\\d+\\)|$)`))?.[1];expect(explanation).toBeTruthy();
   const expected=explanation!.includes('нет знака')?'none':explanation!.includes('тире')?'—':',';
   expect(p.sign).toBe(expected);expect(p.reason.length).toBeGreaterThan(35);
  }
  const parts=splitPunctuationText(punctuationText(task));expect(parts.map(p=>p.text+(p.position?`(${p.position})`:'' )).join('')).toBe(punctuationText(task));
 }
});
it('requires explicit no-sign choices and keeps each incorrect position separate',()=>{
 const [e]=punctuationExercises(book);const draft={signs:{},selected:'1',hintUsed:false};expect(checkPunctuation(e,draft)).toMatchObject({complete:false,correctPositions:0});
 const signs=Object.fromEntries(e.positions.map(p=>[p.id,p.sign]));signs['1']=',';
 const result=checkPunctuation(e,{...draft,signs});expect(result).toMatchObject({complete:true,correctPositions:7,totalPositions:8});expect(result.rows.filter(r=>!r.correct).map(r=>r.id)).toEqual(['1']);
});
it('does not offer stale, unreviewed or changed-source exercises',()=>{
 expect(punctuationExercises({...book,source:{...book.source,checksum:'other'}})).toEqual([]);
 const id=punctuationExercises(book)[0].taskId;
 expect(punctuationExercises({...book,tasks:book.tasks.map(t=>t.id===id?{...t,version:2}:t)})).toHaveLength(4);
 expect(punctuationExercises({...book,tasks:book.tasks.map(t=>({...t,verification:'rules'}))})).toEqual([]);
});
it('persists explicit blanks, deletion, selection and hints without replacing the letter draft',async()=>{
 await store.importPack(book);await store.startLetters();const [letter]=letterExercises(book);await store.saveLetterDraft(letter.id,{letter:'и'});
 const start=await store.startPunctuation(),[e]=punctuationExercises(book);await store.savePunctuationDraft(e.id,{position:'1',sign:'—',selected:'2',hintUsed:true});
 await store.savePunctuationDraft(e.id,{position:'1',sign:null,hintUsed:false});await store.savePunctuationDraft(e.id,{position:'5',sign:'none'});
 const restored=await store.loadState();expect(restored.activePunctuation?.id).toBe(start.activePunctuation?.id);expect(restored.activePunctuation?.drafts[e.id]).toEqual({signs:{'5':'none'},selected:'2',hintUsed:true});expect(restored.activeLearning?.drafts[letter.id].letter).toBe('и');
 await expect(store.savePunctuationDraft(e.id,{position:'99',sign:','})).rejects.toThrow('Неизвестный');await expect(store.checkPunctuationCurrent()).rejects.toThrow('Заполни все');
 await store.useDemo();expect((await store.loadState()).activePunctuation).toBeNull();expect((await store.importPack(book)).activePunctuation?.drafts[e.id].signs).toEqual({'5':'none'});
});
it('records a checked text once, locks the answer and keeps ordinary statistics separate',async()=>{
 await store.importPack(book);await store.startPunctuation();const [e]=punctuationExercises(book);
 for(const p of e.positions)await store.savePunctuationDraft(e.id,{position:p.id,sign:p.sign});
 await Promise.all([store.checkPunctuationCurrent(),store.checkPunctuationCurrent()]);let state=await store.loadState();const original=state.activePunctuation?.results[e.id];expect(original).toMatchObject({correctPositions:8,totalPositions:8});expect(punctuationResults(book,state.punctuationSessions)).toHaveLength(1);
 await store.savePunctuationDraft(e.id,{position:'1',sign:','});state=await store.loadState();expect(state.activePunctuation?.results[e.id]).toEqual(original);expect(state.activePunctuation?.drafts[e.id].signs['1']).toBe('—');expect(stats(book,state.attempts).solved).toBe(0);
 await store.nextPunctuation();expect((await store.loadState()).activePunctuation?.position).toBe(1);
});
it('rolls back a failed result write and preserves the completed draft',async()=>{
 await store.importPack(book);await store.startPunctuation();const [e]=punctuationExercises(book);for(const p of e.positions)await store.savePunctuationDraft(e.id,{position:p.id,sign:p.sign});
 const failure=vi.spyOn(store.db.punctuationSessions,'put').mockRejectedValueOnce(new Error('QuotaExceededError'));await expect(store.checkPunctuationCurrent()).rejects.toThrow('QuotaExceededError');failure.mockRestore();
 const state=await store.loadState();expect(state.activePunctuation?.results).toEqual({});expect(Object.keys(state.activePunctuation!.drafts[e.id].signs)).toHaveLength(8);
});
it('resumes the most recently opened workshop while keeping both series intact',async()=>{
 await store.importPack(book);vi.spyOn(Date,'now').mockReturnValue(1000);await store.startLetters();vi.spyOn(Date,'now').mockReturnValue(2000);let state=await store.startPunctuation();expect(workshopResume(state)?.path).toBe('/workshop/punctuation');
 vi.spyOn(Date,'now').mockReturnValue(3000);state=await store.startLetters();expect(workshopResume(state)?.path).toBe('/workshop/letters');expect(state.activePunctuation).not.toBeNull();expect(state.learningSessions).toHaveLength(1);expect(state.punctuationSessions).toHaveLength(1);
});
it('upgrades database v2 without losing ordinary answers or an unfinished letter exercise',async()=>{
 await store.db.delete();const legacy=new Dexie('zapyataya-v1');legacy.version(1).stores({packs:'packId',sessions:'id,packId,status',attempts:'id,packId,sessionId',settings:'key'});legacy.version(2).stores({learningSessions:'id,packId,status'});await legacy.open();
 const [letter]=letterExercises(book),task=book.tasks.find(t=>t.oge===5)!;
 const a:Attempt={...attempt(),packId:book.packId,packVersion:book.packVersion,taskId:task.id,taskVersion:task.version,answer:task.key};
 const session:LearningSession={id:'old-letters',packId:book.packId,mechanic:'letters',exerciseIds:[letter.id],exerciseVersions:{[letter.id]:letter.version},position:0,drafts:{[letter.id]:{letter:'и',rule:'',hintUsed:true}},results:{},status:'active',startedAt:1};
 await legacy.table('packs').put(book);await legacy.table('attempts').put(a);await legacy.table('learningSessions').put(session);await legacy.table('settings').put({key:'pack',value:book.packId});legacy.close();await store.db.open();
 const state=await store.loadState();expect(state.attempts).toEqual([a]);expect(stats(book,state.attempts).solved).toBe(1);expect(state.activeLearning).toEqual(session);expect(state.punctuationSessions).toEqual([]);
});
