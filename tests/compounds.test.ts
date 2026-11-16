import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {ContentPackSchema} from '../src/domain/schema';
import {check} from '../src/domain/engine';
const pack=ContentPackSchema.parse(JSON.parse(readFileSync('public/packs/praktikum-2027.json','utf8')));
const get=(n:number,group:number,q:number)=>pack.tasks.find(t=>t.id===`rustutors-2026-2027-oge${n}-topic${group}-q${q}`)!;
it('retains real compounds and numeric suffixes while keeping a closing morpheme hyphen separate',()=>{
 const samples=[[get(3,2,6),'неопределённо-личным'],[get(3,3,17),'кислотно-щелочной'],[get(3,3,96),'Склодóвской-Кюри́'],[get(5,1,11),'военно-инженерного'],[get(5,3,15),'дворцово-парковых'],[get(5,4,5),'Какая-то'],[get(6,5,13),'1-го'],[get(6,7,6),'2-го'],[get(6,7,8),'3-го'],[get(6,8,41),'-ВШ- пишется'],[get(7,1,64),'юго-запад']] as const;
 for(const [task,phrase] of samples){expect(task).toMatchObject({version:2,verification:'manual',timed:true});expect(task.type).not.toBe('self');expect(task.prompt.flatMap(b=>'text' in b?[b.text]:[]).join(' ')).toContain(phrase);}
});
it('checks reviewed statement truth and positions by their original keys',()=>{
 for(const [n,group,q,answer] of [[3,2,6,'false'],[3,2,41,'true'],[3,2,52,'false'],[6,7,6,'true'],[6,7,8,'false']] as const){const task=get(n,group,q);expect(check(task,answer).result).toBe('correct');expect(check(task,answer==='true'?'false':'true').result).toBe('wrong');}
 expect(check(get(5,1,11),['1','8']).result).toBe('correct');expect(check(get(5,3,15),['3','4','5','8']).result).toBe('correct');expect(check(get(5,4,5),['1','2','7','8']).result).toBe('correct');expect(check(get(7,1,64),['3','5','8','9']).result).toBe('correct');
});
it('keeps unresolved primary records and all table assessments ungraded',()=>{
 const primary=pack.tasks.filter(t=>t.type==='self'&&!t.id.endsWith('-table')).map(t=>t.id);expect(primary.sort()).toEqual([get(4,5,3).id,get(6,4,57).id,get(6,8,47).id,get(12,3,9).id].sort());expect(pack.tasks.filter(t=>t.type==='self'&&t.id.endsWith('-table'))).toHaveLength(90);expect(pack.tasks.filter(t=>t.type!=='self')).toHaveLength(1533);
});
