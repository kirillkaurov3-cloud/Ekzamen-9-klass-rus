import 'fake-indexeddb/auto';
import {readFileSync} from 'node:fs';
import {afterAll,beforeEach,expect,it} from 'vitest';
import {ContentPackSchema} from '../src/domain/schema';
import {check,currentAttempts,stats} from '../src/domain/engine';
import {wordTokens} from '../src/domain/study';
import * as store from '../src/storage/store';
const book=ContentPackSchema.parse(JSON.parse(readFileSync('public/packs/praktikum-2027.json','utf8'))),prefix='rustutors-2026-2027-oge12-topic1-q';
const lexical=(n:number)=>book.tasks.find(t=>t.id===prefix+n)!;
beforeEach(async()=>{await store.db.delete();await store.db.open();await store.loadState();});afterAll(async()=>{await store.db.delete();});
it('grades the complete lexical-meaning group with explicit forms and retains unrelated review tasks',()=>{
 const tasks=book.tasks.filter(t=>t.topicIds.includes('rustutors-2026-2027-oge12-topic1'));expect(tasks).toHaveLength(41);expect(tasks.every(t=>t.type==='text'&&t.verification==='manual'&&t.version===2&&!t.reviewRequired)).toBe(true);
 for(const t of tasks){for(const form of t.accepted)expect(check(t,`  ${form.toUpperCase()}  `).result).toBe('correct');expect(check(t,'неподходящее слово').result).toBe('wrong');expect(check(t,'').result).toBe('skipped');}
 expect(book.tasks.filter(t=>t.oge===12&&t.type==='self')).toHaveLength(1);
});
it('accepts reviewed inflections and dictionary forms without accepting a merely related word or wrong part of speech',()=>{
 for(const [n,form] of [[10,'пренебречь'],[12,'кузов'],[13,'просека'],[24,'мостовая'],[28,'потрясти'],[37,'сморить'],[40,'отведать']] as const)expect(check(lexical(n),form).result).toBe('correct');
 for(const [n,form] of [[5,'гордился'],[12,'кузовной'],[24,'мостовой'],[28,'потрясение'],[40,'отведывать']] as const)expect(check(lexical(n),form).result).toBe('wrong');
 expect(check(lexical(9),'студёный').result).toBe('correct');expect(check(lexical(9),'студёную').result).toBe('correct');expect(check(lexical(9),'студеный').result).toBe('wrong');
});
it('updates old review-only questions without losing checked practice, source IDs or an unfinished workshop draft',async()=>{
 const old=structuredClone(book);old.packVersion+='-old-review-state';for(const t of old.tasks.filter(t=>t.oge===12&&!(t.topicIds.includes('rustutors-2026-2027-oge12-topic1')&&Number(t.id.slice(prefix.length))<=4))){t.version=1;t.type='self';t.key='';t.accepted=[];t.timed=false;t.reviewRequired=true;t.verification='rules';}
 expect(old.tasks.filter(t=>t.type!=='self')).toHaveLength(1411);await store.importPack(old);await store.startSession([prefix+'5'],'practice',1);await store.saveDraft(prefix+'5','гордость');await store.checkCurrent();await store.finishSession();
 const original=book.tasks.find(t=>t.id==='rustutors-2026-2027-oge2-topic1-q55-part1')!;await store.startSession([original.id],'practice',1);await store.saveDraft(original.id,original.key);await store.checkCurrent();await store.finishSession();let state=await store.startStudy('grammar');const session=state.activeStudy!,token=wordTokens((await import('../src/domain/study')).resolveStudy(book,session.plan[0])!)[0];await store.saveStudyDraft(session.id,session.plan[0],{roles:{[token.id]:'subject'}});
 state=await store.importPack(book);expect(state.activeStudy?.id).toBe(session.id);expect(state.activeStudy?.drafts[session.plan[0]].roles[token.id]).toBe('subject');expect(stats(book,state.attempts)).toMatchObject({solved:1,checked:1,total:1515});expect(currentAttempts(book,state.attempts).some(a=>a.taskId===prefix+'5')).toBe(false);expect(state.attempts.some(a=>a.taskId===prefix+'5'&&a.result==='self')).toBe(true);
});

it('checks synonym alternatives, case forms, two-word answers and idioms without losing their boundaries',()=>{
 const get=(group:number,n:number)=>book.tasks.find(t=>t.id===`rustutors-2026-2027-oge12-topic${group}-q${n}`)!;
 for(const form of ['худой','хилый','худому','хилому'])expect(check(get(2,12),form).result).toBe('correct');
 for(const form of ['дрогнут мёрзнут','мерзнут дрогнут','мёрзнуть дрогнуть'])expect(check(get(2,2),form).result).toBe('correct');
 expect(check(get(2,2),'дрогнут').result).toBe('wrong');expect(check(get(2,23),'незрячий слепой').result).toBe('correct');expect(check(get(3,1),'короткий длинная').result).toBe('correct');expect(check(get(3,1),'короткая').result).toBe('wrong');
 expect(check(get(4,1),'не сводя с женщины глаз').result).toBe('correct');expect(check(get(4,14),'взяться за ум').result).toBe('correct');expect(check(get(4,14),'взяться за работу').result).toBe('wrong');expect(check(get(4,17),'развести руками').result).toBe('correct');
 expect(get(2,7).prompt.flatMap(b=>'text' in b?[b.text]:[]).join(' ')).toContain('найдите синоним');expect(get(3,9)).toMatchObject({type:'self',reviewRequired:true});expect(book.tasks.filter(t=>t.oge===12&&t.type==='text')).toHaveLength(108);
});
