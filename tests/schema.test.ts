import {describe,it,expect} from 'vitest';
import {ContentPackSchema} from '../src/domain/schema';
import {pack,task} from './fixtures';

describe('Единая схема набора',()=>{
 it('принимает корректный набор',()=>expect(ContentPackSchema.safeParse(pack()).success).toBe(true));
 it('запрещает неизвестные поля, несовместимую версию и повторяющиеся ID',()=>{
  expect(ContentPackSchema.safeParse({...pack(),html:'<script>'}).success).toBe(false);
  expect(ContentPackSchema.safeParse({...pack(),schemaVersion:2}).success).toBe(false);
  expect(ContentPackSchema.safeParse({...pack(),tasks:[task(),task()]}).success).toBe(false);
 });
 it('проверяет ссылки и ключи до сохранения',()=>{
  expect(ContentPackSchema.safeParse({...pack(),tasks:[task({textId:'missing'})]}).success).toBe(false);
  expect(ContentPackSchema.safeParse({...pack(),tasks:[task({key:['99']})]}).success).toBe(false);
  expect(ContentPackSchema.safeParse({...pack(),tasks:[task({type:'text',key:'слово',accepted:[]})]}).success).toBe(false);
 });
 it('запрещает самопроверку в таймере и повтор пары при заданном ограничении',()=>{
  expect(ContentPackSchema.safeParse({...pack(),tasks:[task({type:'self',explanation:[{type:'paragraph',text:'Образец'}]})]}).success).toBe(false);
  const t=task({type:'matching',pairs:[{id:'a',text:'А'},{id:'b',text:'Б'}],key:{a:'1',b:'1'},allowReuse:false});
  expect(ContentPackSchema.safeParse({...pack(),tasks:[t]}).success).toBe(false);
 });
});

it('allows source layout fragments and confines review keys to ungraded self-checks',()=>{
 const p=pack([task({type:'self',key:'',timed:false,reviewRequired:true,explanation:[{type:'preformatted',text:'Колонка А       Колонка Б\nТест            Пример'}]})]);
 expect(ContentPackSchema.safeParse(p).success).toBe(true);
 expect(ContentPackSchema.safeParse({...p,tasks:[{...p.tasks[0],type:'text',accepted:['пример'],timed:false}]}).success).toBe(false);
});
