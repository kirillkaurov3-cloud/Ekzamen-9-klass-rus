import type {LearningSession} from './interactive';
import {z} from 'zod';
export const BlockSchema = z.discriminatedUnion('type',[
 z.object({type:z.literal('preformatted'),text:z.string().max(60000)}).strict(),
 z.object({type:z.literal('paragraph'),text:z.string().max(60000)}).strict(),
 z.object({type:z.literal('heading'),text:z.string().max(1000)}).strict(),
 z.object({type:z.literal('list'),items:z.array(z.string().max(20000)).max(200)}).strict(),
 z.object({type:z.literal('table'),headers:z.array(z.string()),rows:z.array(z.array(z.string()))}).strict(),
 z.object({type:z.literal('emphasis'),text:z.string().max(20000)}).strict()
]);
const id=z.string().min(1).max(160).regex(/^[a-zA-Z0-9_.:-]+$/);
const source=z.object({title:z.string(),pages:z.array(z.number().int().positive()).default([]),answerPages:z.array(z.number().int().positive()).default([]),checksum:z.string().optional()}).strict();
const option=z.object({id,text:z.string()}).strict();
export const TaskSchema=z.object({id,version:z.number().int().positive(),oge:z.number().int(),topicIds:z.array(id).min(1),type:z.enum(['single','multi','positions','boolean','text','matching','self']),prompt:z.array(BlockSchema).min(1),textId:id.optional(),sourceKey:z.string().optional(),reviewRequired:z.boolean().optional(),options:z.array(option).default([]),pairs:z.array(option).default([]),allowReuse:z.boolean().default(true),key:z.union([z.string(),z.array(z.string()),z.record(z.string(),z.string())]),accepted:z.array(z.string()).default([]),policy:z.object({yo:z.enum(['strict','fold']).default('strict'),ignoreSpaces:z.boolean().default(false)}).default({yo:'strict',ignoreSpaces:false}),explanation:z.array(BlockSchema).default([]),source,verification:z.enum(['rules','manual']),timed:z.boolean()}).strict();
export const ContentPackSchema=z.object({schemaVersion:z.literal(1),packId:id,packVersion:z.string().min(1),title:z.string().min(1),demo:z.boolean().default(false),source,topics:z.array(z.object({id,title:z.string(),oge:z.number().int(),parentId:id.optional(),description:z.string().default(''),theoryIds:z.array(id).default([])}).strict()),texts:z.array(z.object({id,blocks:z.array(BlockSchema),source}).strict()),theory:z.array(z.object({id,title:z.string(),blocks:z.array(BlockSchema),source}).strict()),tasks:z.array(TaskSchema).min(1).max(20000)}).strict().superRefine((p,ctx)=>{
 const issue=(message:string)=>ctx.addIssue({code:'custom',message});
 for(const [name,records] of [['tasks',p.tasks],['topics',p.topics],['texts',p.texts],['theory',p.theory]] as const){if(new Set(records.map(x=>x.id)).size!==records.length)issue(`Повторяющийся ID: ${name}`);}
 const topics=new Set(p.topics.map(x=>x.id)),texts=new Set(p.texts.map(x=>x.id)),theory=new Set(p.theory.map(x=>x.id));
 for(const t of p.topics){if(t.parentId&&!topics.has(t.parentId))issue('Не найдена родительская тема');for(const id of t.theoryIds)if(!theory.has(id))issue('Не найдена теория');}
 for(const t of p.tasks){
  if(t.topicIds.some(x=>!topics.has(x))||(t.textId&&!texts.has(t.textId)))issue(`${t.id}: нарушена ссылка`);
  if(![2,3,4,5,6,7,8,9,11,12].includes(t.oge))issue(`${t.id}: неизвестный номер ОГЭ`);
  const ids=t.options.map(x=>x.id);if(new Set(ids).size!==ids.length)issue(`${t.id}: повтор варианта`);
  if(t.reviewRequired && (t.type!=='self'||t.timed))issue(`${t.id}: ключ на сверке доступен только для самопроверки без таймера`);
  if(t.type==='self'&&t.timed)issue('Самопроверка не входит в мини-вариант');
  if(['single','boolean'].includes(t.type)&&(typeof t.key!=='string'||!ids.includes(t.key)))issue(`${t.id}: неверный ключ выбора`);
  if(['multi','positions'].includes(t.type)&&(!Array.isArray(t.key)||t.key.length===0||t.key.some(x=>!ids.includes(x))||new Set(t.key).size!==t.key.length))issue(`${t.id}: неверный ключ позиций`);
  if(t.type==='text'&&(typeof t.key!=='string'||!t.accepted.length))issue(`${t.id}: отсутствуют разрешённые формы`);
  if(t.type==='matching'){
   if(typeof t.key!=='object'||Array.isArray(t.key)||!t.pairs.length||Object.keys(t.key).length!==t.pairs.length||t.pairs.some(p=>!ids.includes((t.key as Record<string,string>)[p.id])))issue(`${t.id}: неверное соответствие`);
   else if(!t.allowReuse&&new Set(Object.values(t.key)).size!==t.pairs.length)issue(`${t.id}: пары повторяются`);
  }
  if(t.type==='self'&&!t.explanation.length)issue(`${t.id}: нет образца`);
 }
});
export type Block=z.infer<typeof BlockSchema>;
export type Task=z.infer<typeof TaskSchema>;
export type ContentPack=z.infer<typeof ContentPackSchema>;
export type Answer=string|string[]|Record<string,string>;
export type Result='correct'|'wrong'|'skipped'|'self';
export type Mode='practice'|'timed'|'review'|'diagnostic'|'spaced';
export interface Attempt {id:string;sessionId:string;taskId:string;taskVersion:number;answer:Answer;result:Result;incomplete:boolean;checkedAt:number;localDay?:string;hintUsed?:boolean;mode:Mode;packId:string;packVersion:string}
export interface Session {id:string;packId:string;packVersion:string;mode:Mode;taskIds:string[];position:number;drafts:Record<string,Answer>;results:Record<string,Attempt>;status:'active'|'completed';startedAt:number;endsAt?:number;finishedAt?:number}
export interface State {pack:ContentPack;attempts:Attempt[];sessions:Session[];active:Session|null;learningSessions:LearningSession[];activeLearning:LearningSession|null;theme:'system'|'light'|'dark'}
