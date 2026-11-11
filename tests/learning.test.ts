import {expect,it} from 'vitest';
import demo from '../content-demo/pack.json';
import {ContentPackSchema,type Session} from '../src/domain/schema';
import {diagnosticPlan,validateDiagnosticPlan,missingDiagnosticNumbers,diagnosticAreas,recommendation} from '../src/domain/learning';
import {pack,task,attempt} from './fixtures';
const full=()=>ContentPackSchema.parse(demo);
it('plans one assessable task per number and rejects duplicate or missing areas',()=>{
 const p=full(),ids=diagnosticPlan(p,[]);expect(ids).toHaveLength(10);expect(validateDiagnosticPlan(p,ids)).toBe(true);expect(validateDiagnosticPlan(p,[ids[0],...ids.slice(0,9)])).toBe(false);
 p.tasks=p.tasks.map(t=>t.oge===12?{...t,type:'self',timed:false,reviewRequired:true}:t);expect(missingDiagnosticNumbers(p)).toEqual([12]);expect(validateDiagnosticPlan(p,ids)).toBe(false);
});
it('excludes stale attempts and resolves an error after a newer correct answer',()=>{
 const p=pack([task(),task({id:'test.2.2'})]);p.topics.push({id:'topic.3',title:'Новая тема',oge:3,description:'',theoryIds:[]});p.tasks.push(task({id:'test.3.1',oge:3,topicIds:['topic.3']}));
 const wrong=attempt({result:'wrong',checkedAt:1});expect(recommendation(p,[wrong])?.topic.id).toBe('topic.2');expect(recommendation(p,[wrong])?.taskIds[0]).toBe('test.2.1');
 const correct=attempt({id:'later',checkedAt:2});expect(recommendation(p,[wrong,correct])?.topic.id).toBe('topic.3');expect(recommendation(p,[{...wrong,taskVersion:99}])?.errorCount).toBe(0);
});
it('does not recommend review-only material or treat a skip as evidence',()=>{
 const p=pack();expect(recommendation(p,[attempt({result:'skipped'})])?.evidenceCount).toBe(0);
 p.tasks=p.tasks.map(t=>({...t,type:'self',timed:false,reviewRequired:true}));expect(recommendation(p,[])).toBeNull();
});
it('diagnostic report distinguishes skipped, incorrect and obsolete answers',()=>{
 const p=full();const ids=diagnosticPlan(p,[]);const first=p.tasks.find(t=>t.id===ids[0])!;const s:Session={id:'d',packId:p.packId,packVersion:p.packVersion,mode:'diagnostic',taskIds:ids,position:0,drafts:{},results:{[first.id]:attempt({taskId:first.id,taskVersion:first.version,result:'skipped'})},status:'completed',startedAt:1};
 expect(diagnosticAreas(p,s)[0]).toMatchObject({result:'skipped',checked:0});s.results[first.id].result='wrong';expect(diagnosticAreas(p,s)[0]).toMatchObject({result:'wrong',checked:1});s.results[first.id].taskVersion++;expect(diagnosticAreas(p,s)[0].result).toBeUndefined();
});

it('rotates equally covered themes instead of recommending the same one forever',()=>{
 const p=pack();p.topics.push({id:'topic.3',title:'Вторая тема',oge:3,description:'',theoryIds:[]});p.tasks.push(task({id:'test.3.1',oge:3,topicIds:['topic.3']}));const a=attempt({checkedAt:1}),b=attempt({id:'b',taskId:'test.3.1',checkedAt:2});expect(recommendation(p,[a,b])?.topic.id).toBe('topic.2');expect(recommendation(p,[a,b,{...a,id:'c',checkedAt:3}])?.topic.id).toBe('topic.3');
});

it('requires manually verified keys for diagnostics while retaining automatic practice',()=>{
 const p=full();const ids=diagnosticPlan(p,[]);p.tasks=p.tasks.map(t=>t.oge===7?{...t,verification:'rules'}:t);expect(missingDiagnosticNumbers(p)).toEqual([7]);expect(validateDiagnosticPlan(p,ids)).toBe(false);expect(diagnosticPlan(p,[])).toHaveLength(9);
 const automatic=pack([task({verification:'rules'})]);expect(recommendation(automatic,[])?.taskIds).toEqual(['test.2.1']);
});
