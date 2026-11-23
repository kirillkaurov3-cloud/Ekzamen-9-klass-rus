import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {ContentPackSchema} from '../src/domain/schema';
import {check} from '../src/domain/engine';
const pack=ContentPackSchema.parse(JSON.parse(readFileSync('public/packs/praktikum-2027.json','utf8')));
it('publishes 90 complete semantic answer tables as self-assessment without changing objective totals',()=>{
 const tasks=pack.tasks.filter(t=>/^rustutors-2026-2027-oge7-topic1-q\d+-table$/.test(t.id));expect(tasks).toHaveLength(90);
 for(const task of tasks){expect(task).toMatchObject({type:'self',version:2,timed:false,reviewRequired:true,verification:'rules'});expect(check(task,'любая заметка').result).toBe('self');const tables=task.explanation.filter(b=>b.type==='table');expect(tables).toHaveLength(1);const table=tables[0];expect(table.headers).toHaveLength(5);expect(table.rows.map(r=>r[0])).toEqual(['1','2','3','4','5','6','7','8','9']);expect(table.rows.every(r=>r.length===5&&r.every(c=>c.trim()&&!/[\ue000-\uf8ff]/.test(c)))).toBe(true);}
 expect(pack.tasks.filter(t=>t.type!=='self')).toHaveLength(1537);expect(pack.tasks.filter(t=>t.type==='self')).toHaveLength(90);
});
it('keeps all nine restored words in q57 and joins the reviewed split ending in q19',()=>{
 const table=(n:number)=>pack.tasks.find(t=>t.id===`rustutors-2026-2027-oge7-topic1-q${n}-table`)!.explanation.find(b=>b.type==='table')!;
 expect(table(57).rows.map(r=>r[4])).toEqual(['дальний','берег','(В) тумане','сумерках','наступающего','вечера','побеждая','медленно','приближаясь']);expect(table(19).rows[2]).toEqual(['3','СУЩ.','ОКОНЧАНИЕ','В Д.п. сущ. пишется окончание ЯМ','лохмотьям']);
});
