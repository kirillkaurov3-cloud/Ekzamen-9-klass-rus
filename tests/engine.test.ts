import {describe,it,expect} from 'vitest';
import {check,normalize,empty,errorIds,stats,selectTasks,remaining} from '../src/domain/engine';
import {attempt,pack,task} from './fixtures';

describe('Проверка ответов',()=>{
 it('сравнивает множества независимо от порядка и отличает 12 от 1, 2',()=>{
  expect(check(task(),['12','1']).result).toBe('correct');
  expect(check(task(),['1','2']).result).toBe('wrong');
  expect(check(task(),['1','12','2']).result).toBe('wrong');
 });
 it('нормализует Unicode, регистр и пробелы, сохраняя ё и дефис по умолчанию',()=>{
  const t=task({type:'text',key:'жёлтый лист',accepted:['жёлтый лист']});
  expect(check(t,'  ЖЁЛТЫЙ   лист ').result).toBe('correct');
  expect(check(t,'желтый лист').result).toBe('wrong');
  expect(check(t,'жёлтыйлист').result).toBe('wrong');
  expect(normalize('Е\u0308Ж',{yo:'strict',ignoreSpaces:false})).toBe('ёж');
  expect(check(task({type:'text',key:'по-новому',accepted:['по-новому']}),'по новому').result).toBe('wrong');
 });
 it('применяет только явные альтернативы и политику конкретной задачи',()=>{
  const t=task({type:'text',key:'смотрелсмущаясь',accepted:['смотрел смущаясь','смущённо смотрел'],policy:{yo:'fold',ignoreSpaces:true}});
  expect(check(t,'СМУЩЕННОсмотрел').result).toBe('correct');
  expect(check(t,'смотрел смущённо').result).toBe('wrong');
 });
 it('отличает незавершённое сопоставление от пропуска',()=>{
  const t=task({type:'matching',pairs:[{id:'a',text:'А'},{id:'b',text:'Б'}],key:{a:'1',b:'12'},allowReuse:false});
  expect(check(t,{a:'1'})).toEqual({result:'wrong',incomplete:true});
  expect(check(t,{a:'',b:''})).toEqual({result:'skipped',incomplete:false});
  expect(check(t,{b:'12',a:'1'}).result).toBe('correct');
 });
 it('самопроверка и пропуск не получают обычный балл',()=>{
  expect(check(task({type:'self',timed:false,explanation:[{type:'paragraph',text:'Образец'}]}),'текст').result).toBe('self');
  expect(check(task(),[]).result).toBe('skipped');
  expect(empty(undefined)).toBe(true);
 });
});

describe('История и статистика',()=>{
 it('убирает исправленную ошибку, сохраняя обе попытки',()=>{
  const attempts=[attempt({result:'wrong'}),attempt({id:'attempt.2',checkedAt:2})];
  expect(errorIds(pack(),attempts)).toEqual([]);
  expect(stats(pack(),attempts)).toMatchObject({accuracy:50,checked:2,solved:1,errors:0});
 });
 it('не смешивает наборы, версии задач, пропуски и самопроверку',()=>{
  const attempts=[attempt(),attempt({packId:'demo'}),attempt({taskVersion:2}),attempt({result:'skipped'}),attempt({result:'self'})];
  expect(stats(pack(),attempts)).toMatchObject({checked:1,accuracy:100,solved:1,total:1});
 });
 it('после пропуска последняя проверенная ошибка остаётся в очереди',()=>{
  expect(errorIds(pack(),[attempt({result:'wrong'}),attempt({result:'skipped'})])).toEqual(['test.2.1']);
 });
 it('сначала предлагает новые задания и обеспечивает разнообразие мини-варианта',()=>{
  const p=pack([task(),task({id:'test.2.2'}),task({id:'test.3.1',oge:3})]);
  const ids=p.tasks.map(t=>t.id);
  expect(selectTasks(p,[attempt()],ids,2)).toEqual(['test.2.2','test.3.1']);
  expect(selectTasks(p,[],ids,2,true)).toEqual(['test.2.1','test.3.1']);
 });
 it('считает остаток по дедлайну, в том числе после возвращения из фона',()=>{
  expect(remaining(10000,1001)).toBe(9);
  expect(remaining(10000,12000)).toBe(0);
 });
});
