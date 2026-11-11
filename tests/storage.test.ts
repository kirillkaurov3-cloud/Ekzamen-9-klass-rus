import 'fake-indexeddb/auto';
import {afterAll,beforeEach,describe,expect,it,vi} from 'vitest';
import * as store from '../src/storage/store';
import {errorIds,stats} from '../src/domain/engine';
import {pack,task} from './fixtures';

beforeEach(async()=>{vi.restoreAllMocks();await store.db.delete();await store.db.open();await store.loadState();});
afterAll(async()=>{await store.db.delete();});

describe('IndexedDB sessions and history',()=>{
 it('persists drafts and position across a fresh load',async()=>{
  const p=pack([task(),task({id:'test.2.2'})]);await store.importPack(p);
  await store.startSession(p.tasks.map(t=>t.id),'practice',2);
  await store.saveDraft('test.2.1',['12']);await store.setPosition(1);
  const restored=await store.loadState();
  expect(restored.active?.drafts['test.2.1']).toEqual(['12']);expect(restored.active?.position).toBe(1);expect(restored.attempts).toHaveLength(0);
 });
 it('saves double checks once and removes a corrected error while preserving history',async()=>{
  const p=pack();await store.importPack(p);await store.startSession([p.tasks[0].id],'practice',1);await store.saveDraft(p.tasks[0].id,['1']);
  await Promise.all([store.checkCurrent(),store.checkCurrent()]);let state=await store.finishSession();
  expect(state.attempts).toHaveLength(1);expect(errorIds(p,state.attempts)).toEqual([p.tasks[0].id]);
  await store.startSession([p.tasks[0].id],'review',1);await store.saveDraft(p.tasks[0].id,['12','1']);state=await store.checkCurrent();
  expect(state.attempts).toHaveLength(2);expect(errorIds(p,state.attempts)).toEqual([]);expect(stats(p,state.attempts)).toMatchObject({accuracy:50,solved:1,checked:2});
 });
 it('keeps timed answers ungraded until submission and saves racing submissions once',async()=>{
  const p=pack([task(),task({id:'test.2.2'})]);await store.importPack(p);const start=await store.startSession(p.tasks.map(t=>t.id),'timed',2,10);
  await store.saveDraft('test.2.1',['1','12']);expect((await store.checkCurrent()).attempts).toHaveLength(0);
  await Promise.all([store.finishSession(),store.finishSession()]);const state=await store.loadState();
  expect(state.active).toBeNull();expect(state.sessions).toHaveLength(1);expect(state.sessions[0].id).toBe(start.active?.id);expect(state.attempts).toHaveLength(2);expect(state.attempts.map(a=>a.result).sort()).toEqual(['correct','skipped']);
 });
 it('finishes an expired timer on load and refuses answers after deadline',async()=>{
  const p=pack();await store.importPack(p);const now=Date.now();vi.spyOn(Date,'now').mockReturnValue(now);
  const started=await store.startSession([p.tasks[0].id],'timed',1,10);expect(started.active?.endsAt).toBe(now+600000);
  vi.spyOn(Date,'now').mockReturnValue(now+600001);await store.saveDraft(p.tasks[0].id,['1','12']);
  const state=await store.loadState();expect(state.active).toBeNull();expect(state.attempts[0].result).toBe('skipped');expect(state.sessions[0].finishedAt).toBe(now+600000);
  expect((await store.loadState()).attempts).toHaveLength(1);
 });
 it('blocks replacement of an active session or active pack',async()=>{
  const state=await store.loadState();await store.startSession([state.pack.tasks[0].id],'practice',1);
  await expect(store.startSession([state.pack.tasks[1].id],'practice',1)).rejects.toThrow('текущую');await expect(store.importPack(pack())).rejects.toThrow('текущую');
  expect((await store.loadState()).active?.taskIds).toEqual([state.pack.tasks[0].id]);
 });
 it('rolls back write failures without creating a result',async()=>{
  const p=pack();await store.importPack(p);await store.startSession([p.tasks[0].id],'practice',1);await store.saveDraft(p.tasks[0].id,['1','12']);
  const failing=vi.spyOn(store.db.attempts,'put').mockRejectedValueOnce(new Error('QuotaExceededError'));
  await expect(store.checkCurrent()).rejects.toThrow('QuotaExceededError');failing.mockRestore();
  const state=await store.loadState();expect(state.attempts).toHaveLength(0);expect(state.active?.results).toEqual({});expect(state.active?.drafts[p.tasks[0].id]).toEqual(['1','12']);
  expect((await store.checkCurrent()).attempts).toHaveLength(1);
 });
});

describe('atomic pack imports',()=>{
 it('does not duplicate identical versions and preserves history on conflict',async()=>{
  const p=pack();await store.importPack(p);await store.startSession([p.tasks[0].id],'practice',1);await store.saveDraft(p.tasks[0].id,['1','12']);await store.checkCurrent();await store.finishSession();await store.importPack(p);
  expect(await store.db.packs.count()).toBe(2);const conflict={...p,title:'Несовместимое содержимое'};
  await expect(store.importPack(conflict)).rejects.toThrow('Конфликт');const state=await store.loadState();expect(state.pack.title).toBe(p.title);expect(state.attempts).toHaveLength(1);
 });
 it('separates demo progress and excludes obsolete versions from current metrics',async()=>{
  const p=pack();await store.importPack(p);await store.startSession([p.tasks[0].id],'practice',1);await store.saveDraft(p.tasks[0].id,['1','12']);await store.checkCurrent();await store.finishSession();
  expect((await store.useDemo()).attempts).toHaveLength(0);const changed={...p,packVersion:'2',tasks:[task({version:2,key:['2']})]};
  const state=await store.importPack(changed);expect(state.attempts).toHaveLength(1);expect(stats(changed,state.attempts).solved).toBe(0);
 });
 it('requires a task revision when the condition or key changes',async()=>{
  const p=pack();await store.importPack(p);await expect(store.importPack({...p,packVersion:'2',tasks:[task({key:['2']})]})).rejects.toThrow('новую версию');expect((await store.loadState()).pack.packVersion).toBe('1');
 });
 it('validates JSON, schema version, size, and references before import',async()=>{
  const valid=new File([JSON.stringify(pack())],'pack.json');expect((await store.parsePackFile(valid)).packId).toBe('test-pack');
  await expect(store.parsePackFile(new File(['{'],'bad.json'))).rejects.toThrow('JSON');
  await expect(store.parsePackFile(new File([JSON.stringify({...pack(),schemaVersion:100})],'version.json'))).rejects.toThrow('несовместим');
  await expect(store.parsePackFile(new File([JSON.stringify({...pack(),topics:[]})],'refs.json'))).rejects.toThrow('ссылка');
  const tooLarge={size:21*1024*1024,text:vi.fn()} as unknown as File;await expect(store.parsePackFile(tooLarge)).rejects.toThrow('20 МБ');expect(tooLarge.text).not.toHaveBeenCalled();
  expect((await store.loadState()).pack.demo).toBe(true);
 });
});

it('keeps the exact timed plan even when previous attempts change priorities',async()=>{
 const p=pack([task(),task({id:'test.2.2',oge:3})]);await store.importPack(p);await store.startSession(['test.2.1'],'practice',1);await store.checkCurrent(true);await store.finishSession();const s=await store.startSession(['test.2.1','test.2.2'],'timed',2);expect(s.active?.taskIds).toEqual(['test.2.1','test.2.2']);expect((await store.loadState()).active?.endsAt).toBe(s.active?.endsAt);
});
it('refreshes demo explanations without losing drafts or checked progress',async()=>{
 let s=await store.loadState();await store.startSession(['demo-2-1'],'practice',1);await store.saveDraft('demo-2-1',['1','3']);await store.checkCurrent();s=await store.loadState();const before=s.attempts;const old={...s.pack,theory:[],tasks:s.pack.tasks.map(t=>({...t,explanation:[]}))};await store.db.packs.put(old);s=await store.loadState();expect(s.attempts).toEqual(before);expect(s.active?.drafts['demo-2-1']).toEqual(['1','3']);expect(s.pack.tasks[0].explanation[0]).toHaveProperty('text',expect.stringContaining('туман'));
});

it('persists a diagnostic plan and grades it only once on submission',async()=>{
 const s=await store.loadState();const {diagnosticPlan}=await import('../src/domain/learning');const ids=diagnosticPlan(s.pack,s.attempts);const started=await store.startSession(ids,'diagnostic',10);await store.saveDraft(ids[0],s.pack.tasks.find(t=>t.id===ids[0])!.key);await store.setPosition(3);expect((await store.checkCurrent()).attempts).toHaveLength(0);const restored=await store.loadState();expect(restored.active?.taskIds).toEqual(ids);expect(restored.active?.position).toBe(3);expect(restored.active?.endsAt).toBeUndefined();await Promise.all([store.finishSession(),store.finishSession()]);const finished=await store.loadState();expect(finished.sessions[0].id).toBe(started.active?.id);expect(finished.attempts).toHaveLength(10);expect(finished.attempts.filter(a=>a.result==='skipped')).toHaveLength(9);
});
it('refuses to save an incomplete or duplicated diagnostic plan',async()=>{
 const s=await store.loadState();await expect(store.startSession([s.pack.tasks[0].id],'diagnostic',10)).rejects.toThrow('10 заданий');expect((await store.loadState()).active).toBeNull();
});

it('allows only a manual verification promotion at the same task version and keeps progress',async()=>{
 const p=pack([task({verification:'rules'})]);await store.importPack(p);await store.startSession([p.tasks[0].id],'practice',1);await store.saveDraft(p.tasks[0].id,['1','12']);await store.checkCurrent();const before=await store.finishSession();
 const upgraded={...p,packVersion:'2',tasks:[{...p.tasks[0],verification:'manual' as const}]};
 const next=await store.importPack(upgraded);expect(next.attempts).toEqual(before.attempts);expect(stats(next.pack,next.attempts).solved).toBe(1);
 await expect(store.importPack({...upgraded,packVersion:'3',tasks:[{...upgraded.tasks[0],key:['2']}]})).rejects.toThrow('новую версию');
});
it('restores a fixed due plan offline, saves its day and advances a repetition only once',async()=>{
 const p=pack([task(),task({id:'test.2.2'})]);await store.importPack(p);
 const day1=new Date(2026,10,1,12).getTime();vi.spyOn(Date,'now').mockReturnValue(day1);
 await store.startSession(p.tasks.map(t=>t.id),'practice',2);await store.saveDraft(p.tasks[0].id,['1','12']);await store.checkCurrent();await store.finishSession();
 await expect(store.startSession([p.tasks[0].id],'spaced',1)).rejects.toThrow('обновилась');
 vi.spyOn(Date,'now').mockReturnValue(new Date(2026,10,2,12).getTime());
 await expect(store.startSession([p.tasks[1].id],'spaced',1)).rejects.toThrow('обновилась');
 const started=await store.startSession([p.tasks[0].id],'spaced',1);await store.saveDraft(p.tasks[0].id,['1','12']);expect((await store.loadState()).active?.id).toBe(started.active?.id);
 await Promise.all([store.checkCurrent(),store.checkCurrent()]);const final=await store.finishSession();expect(final.attempts.filter(a=>a.mode==='spaced')).toHaveLength(1);expect(final.attempts.at(-1)?.localDay).toBe('2026-11-02');
 const {repetitionSchedule}=await import('../src/domain/repetition');expect(repetitionSchedule(p,final.attempts)[0]).toMatchObject({dueDay:'2026-11-05',step:1});
});
