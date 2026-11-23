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
it('restores the page with options 41–51 and checks the unshifted punctuation key',()=>{
 const task=get(4,5,3);
 expect(task.source).toMatchObject({pages:[126,127,128,129],answerPages:[437]});
 expect(task.options).toHaveLength(51);
 expect(task.options.at(-1)?.text).toContain('Я помню чудное мгновенье');
 const key=['2','6','10','13','17','18','22','23','25','27','30','33','38','41','42','43','44','45','47','48','49','51'];
 expect(check(task,key).result).toBe('correct');
 expect(check(task,key.filter(value=>Number(value)<=40)).result).toBe('wrong');
});
it('grades corrected spelling assertions and leaves only source answer tables as self-assessments',()=>{
 expect(get(6,4,57)).toMatchObject({version:2,key:'false',source:{answerPages:[]}});
 expect([43,44,45,46,47].map(number=>get(6,8,number).key)).toEqual(['false','true','false','true','false']);
 expect(get(6,8,43).source.answerPages).toEqual([]);
 expect(get(6,8,47).source.answerPages).toEqual([474]);
 expect(pack.tasks.filter(t=>t.type==='self').every(t=>t.id.endsWith('-table'))).toBe(true);
 expect(pack.tasks.filter(t=>t.type==='self')).toHaveLength(90);
 expect(pack.tasks.filter(t=>t.type!=='self')).toHaveLength(1537);
});
