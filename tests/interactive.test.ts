import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import {readFileSync} from 'node:fs';
import {afterAll,beforeEach,expect,it,vi} from 'vitest';
import {ContentPackSchema} from '../src/domain/schema';
import {checkLetter,letterExercises,learningResults} from '../src/domain/interactive';
import {stats} from '../src/domain/engine';
import * as store from '../src/storage/store';
import {pack,attempt} from './fixtures';

const book=ContentPackSchema.parse(JSON.parse(readFileSync('public/packs/praktikum-2027.json','utf8')));
beforeEach(async()=>{vi.restoreAllMocks();await store.db.delete();await store.db.open();await store.loadState();});
afterAll(async()=>{await store.db.delete();});

it('links five checked words to the original task, key positions and theory',()=>{
 const exercises=letterExercises(book);expect(exercises).toHaveLength(5);expect(new Set(exercises.map(e=>e.id)).size).toBe(5);
 for(const e of exercises){
  const task=book.tasks.find(t=>t.id===e.taskId)!;
  expect(task.version).toBe(e.taskVersion);expect(task.source.pages).toContain(285);expect(task.source.answerPages).toContain(512);
  expect((task.key as string[]).includes(e.position)).toBe(e.letter==='и');
  expect(e.choices.some(c=>c.id===e.rule)).toBe(true);expect(book.topics.find(t=>task.topicIds.includes(t.id))?.theoryIds.length).toBeGreaterThan(0);
 }
});
it('grades letters and explanations separately and refuses stale or unverified source editions',()=>{
 const [e]=letterExercises(book);
 expect(checkLetter(e,{letter:'е',rule:e.rule,hintUsed:false})).toEqual({lettersCorrect:false,ruleCorrect:true});
 expect(checkLetter(e,{letter:'и',rule:'root',hintUsed:false})).toEqual({lettersCorrect:true,ruleCorrect:false});
 expect(letterExercises({...book,source:{...book.source,checksum:'other'}})).toEqual([]);
 expect(letterExercises({...book,tasks:book.tasks.map(t=>t.id===e.taskId?{...t,version:2}:t)})).toEqual([]);
 expect(letterExercises({...book,tasks:book.tasks.map(t=>t.id===e.taskId?{...t,verification:'rules'}:t)})).toEqual([]);
});
it('persists choice, hints and fixed order; double checks produce one separate learning attempt',async()=>{
 await store.importPack(book);const start=await store.startLetters();const [e,next]=letterExercises(book);
 await store.saveLetterDraft(e.id,{letter:e.letter,rule:'root',hintUsed:true});await store.saveLetterDraft(e.id,{hintUsed:false});
 const restored=await store.loadState();expect(restored.activeLearning?.id).toBe(start.activeLearning?.id);expect(restored.activeLearning?.drafts[e.id].hintUsed).toBe(true);
 await Promise.all([store.checkLetterCurrent(),store.checkLetterCurrent()]);const checked=await store.loadState();
 expect(Object.keys(checked.activeLearning!.results)).toEqual([e.id]);expect(checked.activeLearning?.results[e.id]).toMatchObject({lettersCorrect:true,ruleCorrect:false});expect(checked.attempts).toEqual([]);
 await store.saveLetterDraft(e.id,{letter:'е',rule:e.rule});expect((await store.loadState()).activeLearning?.results[e.id]).toEqual(checked.activeLearning?.results[e.id]);
 await store.nextLetter();expect((await store.loadState()).activeLearning?.exerciseIds[1]).toBe(next.id);expect((await store.loadState()).activeLearning?.position).toBe(1);
 await store.useDemo();expect((await store.loadState()).activeLearning).toBeNull();const reopened=await store.importPack(book);expect(reopened.activeLearning?.position).toBe(1);
});
it('does not grade an incomplete answer and rolls back a failed result write',async()=>{
 await store.importPack(book);await store.startLetters();const [e]=letterExercises(book);
 await expect(store.checkLetterCurrent()).rejects.toThrow('Выбери букву');await store.saveLetterDraft(e.id,{letter:e.letter,rule:e.rule});
 const failure=vi.spyOn(store.db.learningSessions,'put').mockRejectedValueOnce(new Error('QuotaExceededError'));
 await expect(store.checkLetterCurrent()).rejects.toThrow('QuotaExceededError');failure.mockRestore();
 expect((await store.loadState()).activeLearning?.results).toEqual({});expect((await store.loadState()).activeLearning?.drafts[e.id].letter).toBe(e.letter);
});
it('completes five examples without changing ordinary task statistics',async()=>{
 await store.importPack(book);await store.startLetters();
 for(const e of letterExercises(book)){await store.saveLetterDraft(e.id,{letter:e.letter,rule:e.rule});await store.checkLetterCurrent();await store.nextLetter();}
 const state=await store.loadState();expect(state.activeLearning).toBeNull();expect(state.learningSessions[0].status).toBe('completed');expect(learningResults(book,state.learningSessions)).toHaveLength(5);expect(stats(book,state.attempts).solved).toBe(0);
});
it('upgrades the existing v1 database without deleting its ordinary progress',async()=>{
 await store.db.delete();const legacy=new Dexie('zapyataya-v1');legacy.version(1).stores({packs:'packId',sessions:'id,packId,status',attempts:'id,packId,sessionId',settings:'key'});await legacy.open();
 const p=pack(),a=attempt();await legacy.table('packs').put(p);await legacy.table('attempts').put(a);await legacy.table('settings').put({key:'pack',value:p.packId});legacy.close();
 await store.db.open();const restored=await store.loadState();expect(restored.attempts).toEqual([a]);expect(stats(restored.pack,restored.attempts).solved).toBe(1);expect(restored.learningSessions).toEqual([]);
});
