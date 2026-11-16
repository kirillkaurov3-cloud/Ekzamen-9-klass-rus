import type {Answer,Attempt,ContentPack} from './schema';
import {check} from './engine';
import {addDays,localDay,REPETITION_INTERVALS} from './repetition';

export type StudyMode='grammar'|'reason'|'lesson'|'cards'|'daily';
export type GrammarRole='subject'|'predicate'|'main';
export const ROLE_LABELS:Record<GrammarRole,string>={subject:'Подлежащее',predicate:'Сказуемое',main:'Главный член'};
export interface StudyActivity {
 id:string;version:number;mode:StudyMode;kind:'tokens'|'repair'|'choice'|'self'|'read'|'ordinary';
 title:string;instruction:string;prompt:string;explanation:string;hint:string;
 sourceTaskId:string;sourceTaskVersion:number;independent:boolean;
 ranges?:{phrase:string;role:GrammarRole}[];
 choices?:{id:string;text:string}[];key?:string;
 examples?:{id:string;text:string}[];exampleKey?:string;
 origin?:'source'|'author';lessonId?:string;stage?:string;canonicalMode?:'practice'|'spaced';
}
export interface StudyDraft {
 roles:Record<string,GrammarRole>;choice:string;example:string;hintUsed:boolean;revealed:boolean;
 rating?:0|1|2;ordinary?:Answer;
}
export interface StudyAttempt {
 id:string;activityId:string;activityVersion:number;taskId:string;taskVersion:number;
 kind:StudyActivity['kind'];mode:StudyMode;answer:StudyDraft;correct:boolean|null;
 independent:boolean;checkedAt:number;localDay:string;canonical?:Attempt;
}
export interface StudySession {
 id:string;packId:string;mode:StudyMode;plan:string[];versions:Record<string,number>;
 position:number;drafts:Record<string,StudyDraft>;results:Record<string,StudyAttempt>;
 status:'active'|'completed'|'archived';startedAt:number;lastOpenedAt:number;finishedAt?:number;lessonId?:string;day?:string;
}
export interface WordToken {id:string;text:string;start:number;end:number}
export const emptyStudyDraft=():StudyDraft=>({roles:{},choice:'',example:'',hintUsed:false,revealed:false});
export function wordTokens(activity:StudyActivity):WordToken[] {
 return [...activity.prompt.matchAll(/\p{L}+(?:[-’]\p{L}+)*/gu)].map((m,i)=>({id:`${activity.id}.w${i+1}`,text:m[0],start:m.index,end:m.index+m[0].length}));
}
export function expectedRoles(activity:StudyActivity) {
 const result:Record<string,GrammarRole>={};
 for(const range of activity.ranges??[]){
  const start=activity.prompt.indexOf(range.phrase);
  if(start<0||activity.prompt.indexOf(range.phrase,start+1)!==-1)throw new Error(`${activity.id}: неоднозначный диапазон ${range.phrase}`);
  for(const token of wordTokens(activity))if(token.start>=start&&token.end<=start+range.phrase.length)result[token.id]=range.role;
 }
 return result;
}
export function gradeStudy(activity:StudyActivity,draft:StudyDraft,pack:ContentPack) {
 if(activity.kind==='read')return {correct:null,complete:true};
 if(activity.kind==='self')return {correct:null,complete:draft.revealed&&draft.rating!==undefined};
 if(activity.kind==='tokens'){
  const expected=expectedRoles(activity);
  return {correct:Object.keys(draft.roles).every(id=>draft.roles[id]===expected[id])&&Object.keys(expected).every(id=>expected[id]===draft.roles[id]),complete:Object.keys(draft.roles).length>0};
 }
 if(activity.kind==='ordinary'){
  const task=pack.tasks.find(t=>t.id===activity.sourceTaskId&&t.version===activity.sourceTaskVersion);
  if(!task)return {correct:false,complete:false};const result=check(task,draft.ordinary);
  return {correct:result.result==='correct',complete:result.result==='correct'||result.result==='wrong'};
 }
 return {correct:draft.choice===activity.key&&(activity.kind!=='repair'||draft.example===activity.exampleKey),complete:!!draft.choice&&(activity.kind!=='repair'||!!draft.example)};
}
export const GRAMMAR_TASK='rustutors-2026-2027-oge2-topic1-q55-part1';
const grammar=(n:number,prompt:string,ranges:StudyActivity['ranges'],explanation:string,hint:string):StudyActivity=>({id:`grammar.s55.${n}`,version:1,mode:'grammar',kind:'tokens',title:`Основа: предложение ${n}`,instruction:'Отметь все подлежащие и сказуемые. В односоставном предложении используй «Главный член». Союзы между однородными членами не отмечай.',prompt,ranges,explanation,hint,sourceTaskId:GRAMMAR_TASK,sourceTaskVersion:1,independent:true});
export const GRAMMAR_ACTIVITIES:StudyActivity[]=[
 grammar(1,'В воздухе пахучей струёй разливался аромат недавно распустившихся цветов.',[{phrase:'аромат',role:'subject'},{phrase:'разливался',role:'predicate'}],'Основа — «аромат разливался». Что разливалось? Аромат. «В воздухе» обозначает место, «пахучей струёй» — образ действия. Эти слова не входят в основу.','Найди, о чём говорится в предложении, и задай вопрос к действию.'),
 grammar(2,'Сирень, как невеста, стояла вся в белом.',[{phrase:'Сирень',role:'subject'},{phrase:'стояла',role:'predicate'},{phrase:'в белом',role:'predicate'}],'В разборе пособия основа — «сирень стояла в белом». Сказуемое включает сочетание «в белом»; выдели оба слова вместе со «стояла». Сравнение «как невеста» и слово «вся» в основу не входят.','Сравнение описывает сирень, но не заменяет сказуемого. Учти всю именную часть сказуемого.'),
 grammar(3,'Подстриженные щёткой акации образовали живые зелёные стены, и в них уютно прятались крошечные садовые диванчики и чугунные круглые столики.',[{phrase:'акации',role:'subject'},{phrase:'образовали',role:'predicate'},{phrase:'диванчики',role:'subject'},{phrase:'столики',role:'subject'},{phrase:'прятались',role:'predicate'}],'Две основы: «акации образовали» и «диванчики и столики прятались». Во второй части два однородных подлежащих. Союз «и» соединяет их, сам главным членом не является. «Стены» — дополнение: акации образовали что?','Раздели сложное предложение на две части. Во второй подлежащие находятся после сказуемого.'),
 grammar(4,'В этих нишах, напоминающих зелёные гнёздышки, хотелось отдохнуть.',[{phrase:'хотелось отдохнуть',role:'main'}],'Это односоставное безличное предложение. Единственный главный член — «хотелось отдохнуть»: модальное значение и действие выражены вместе. Подлежащего нет. «В этих нишах» — обстоятельство места.','Не добавляй воображаемое подлежащее. Выбери инструмент для единственного главного члена и отметь оба слова.'),
 grammar(5,'Вообще садовник хорошо знал своё дело: зимой у него расцветали камелии, ранней весной радовали глаз тюльпаны и гиацинты.',[{phrase:'садовник',role:'subject'},{phrase:'знал своё дело',role:'predicate'},{phrase:'камелии',role:'subject'},{phrase:'расцветали',role:'predicate'},{phrase:'тюльпаны',role:'subject'},{phrase:'гиацинты',role:'subject'},{phrase:'радовали глаз',role:'predicate'}],'В ключе три основы: «садовник знал своё дело», «камелии расцветали», «тюльпаны и гиацинты радовали глаз». Сочетания «знал своё дело» и «радовали глаз» включаем в сказуемые целиком, как в разборе пособия. Союз между подлежащими не отмечаем.','Найди три сообщения: о садовнике, камелиях, тюльпанах и гиацинтах. Сказуемое может состоять из устойчивого сочетания.')
];
const repair=(n:number,word:string,prompt:string,correct:string,wrong1:string,wrong2:string,example:string,badExample:string,explanation:string):StudyActivity=>({id:`reason.root.${n}`,version:1,mode:'reason',kind:'repair',title:`Исправь рассуждение: ${word}`,instruction:'В исходном объяснении есть ошибка. Выбери исправление, затем пример, который подтверждает правило.',prompt,choices:[{id:'wrong-a',text:wrong1},{id:'right',text:correct},{id:'wrong-b',text:wrong2}],key:'right',examples:[{id:'not-proof',text:badExample},{id:'proof',text:example}],exampleKey:'proof',explanation,hint:'Определи тип гласной в корне: проверяемая, непроверяемая или чередующаяся. Затем проверь, какое условие действительно выбирает букву.',sourceTaskId:`rustutors-2026-2027-oge6-topic1-q${n}`,sourceTaskVersion:1,independent:true});
export const REASON_ACTIVITIES:StudyActivity[]=[
 repair(1,'УКРОЩАТЬ','УКРОЩАТЬ (животных) — в корне слова пишется непроверяемая гласная.','Гласная проверяемая: проверочное слово кро́ткий.','Это чередование, выбор зависит от суффикса -а-.','Написание зависит только от согласной Щ.','Укрощать — кро́ткий: проверяемая О стоит под ударением.','Укрощать — укроти́ть: нужная О по-прежнему без ударения.','Ошибка — отнесение гласной к непроверяемым. В ключе дано «укрощать — кроткий». Ударная О в слове «кро́ткий» проверяет безударную гласную.'),
 repair(2,'СКАКАТЬ','СКАКАТЬ — написание безударной чередующейся гласной в корне зависит от суффикса -А-.','В -скак-/-скоч- выбор зависит от конечной согласной корня: перед К — А, перед Ч — О, с учётом исключений.','Для всех слов с этим корнем достаточно найти ударную гласную.','Написание корня всегда словарное.','Скака́ть — вы́скочить: К/Ч в конце корня определяет выбор А/О.','Скака́ть — скака́ть: повтор того же слова не показывает условие выбора.','Ошибка — неверное условие чередования. У «скакать» корень заканчивается на К, поэтому пишется А. Суффикс -а- не выбирает здесь гласную.'),
 repair(3,'БЛЕСТИТ','БЛЕСТИТ — написание безударной чередующейся гласной в корне зависит от последующих согласных.','В -блест-/-блист- перед суффиксом -а- пишется И, без него — Е.','Любая гласная в этом корне проверяется словом «блеск».','Всегда пишется И после сочетания БЛ.','Блестит — блистает: при появлении суффикса -а- меняется гласная корня.','Блестит — блеск: ударение не является условием этого чередования.','В ключе указано условие: наличие или отсутствие суффикса А после корня. В «блестит» его нет, поэтому Е; в «блистает» есть, поэтому И.'),
 repair(4,'СНИМАТЬ','СНИМАТЬ (кино) — написание безударной чередующейся гласной в корне зависит от места ударения.','Чередование -им-/-а-(-я-) определяется суффиксом -а- после корня.','Корень в этом слове непроверяемый.','Гласная всегда выбирается по конечной согласной корня.','Снимать — снять: в «снимать» после корня есть суффикс -а-.','Снимать — снима́ть: указание ударения не объясняет выбор ИМ.','Ошибка — ссылка на ударение. В ключе назван суффикс -а-. В паре «снимать — снять» видно чередование; написание ИМ связано с этим суффиксом.'),
 repair(5,'БЛЕСТЯЩИЙ','БЛЕСТЯЩИЙ — написание безударной гласной в корне проверяется словом «блеск».','Это чередование -блест-/-блист-: без суффикса -а- после корня пишется Е.','Это непроверяемая гласная, правило не применяется.','Выбор Е зависит от ударения в слове «блеск».','Блестящий — блистающий: сравни наличие суффикса -а- после корня.','Блестящий — блеск: ударение подменяет условие чередования.','Ошибка — применение проверочного слова к чередующемуся корню. В «блестящий» нет суффикса -а- после корня; Е объясняется правилом чередования, а не словом «блеск».')
];
export function sourceEligible(pack:ContentPack,activity:StudyActivity) {
 if(activity.sourceTaskId.startsWith('demo-'))return pack.demo&&pack.tasks.some(t=>t.id===activity.sourceTaskId&&t.version===activity.sourceTaskVersion);
 return pack.source.checksum==='f6ed218ac5b38133e1042d34cabd6cc13ce63b837dd6f4696c5dac85267bf127'&&pack.tasks.some(t=>t.id===activity.sourceTaskId&&t.version===activity.sourceTaskVersion&&t.verification==='manual'&&!t.reviewRequired&&t.type!=='self');
}
export function studyActivities(pack:ContentPack):StudyActivity[]{
 return [...GRAMMAR_ACTIVITIES,...REASON_ACTIVITIES].filter(a=>sourceEligible(pack,a)).filter(a=>{
  if(a.kind!=='tokens'||a.origin==='author')return true;
  const task=pack.tasks.find(t=>t.id===a.sourceTaskId),text=pack.texts.find(t=>t.id===task?.textId);
  return text?.blocks.some(b=>'text' in b&&b.text.includes(a.prompt));
 }).map(a=>a.kind==='repair'?{...a,prompt:pack.tasks.find(t=>t.id===a.sourceTaskId)!.prompt.slice(1).flatMap(b=>'text' in b?[b.text]:[]).join('\n')}:a);
}
export function resolveStudy(pack:ContentPack,id:string){return studyActivities(pack).find(a=>a.id===id);}
export function studyPlan(pack:ContentPack,mode:StudyMode,_sessions:StudySession[]=[],_attempts:Attempt[]=[],_day=localDay(),lessonId?:string):StudyActivity[]{
 void _sessions;void _attempts;void _day;
 return studyActivities(pack).filter(a=>a.mode===mode&&(!lessonId||a.lessonId===lessonId));
}
export function currentStudyAttempts(pack:ContentPack,sessions:StudySession[]) {
 return sessions.filter(s=>s.packId===pack.packId).flatMap(s=>Object.values(s.results)).filter(a=>{const current=resolveStudy(pack,a.activityId);return current?.version===a.activityVersion&&current.sourceTaskId===a.taskId&&current.sourceTaskVersion===a.taskVersion;});
}
export function validStudySession(pack:ContentPack,session:StudySession){return session.plan.length>0&&session.plan.every(id=>resolveStudy(pack,id)?.version===session.versions[id]);}
export const STUDY_LABELS:Record<StudyMode,string>={grammar:'Основа предложения',reason:'Исправление рассуждения',lesson:'Короткий урок',cards:'Карточки',daily:'Тренировка на сегодня'};

export function studyCardSchedule(pack:ContentPack,sessions:StudySession[]) {
 const cards=new Map<string,{id:string;step:number;due:string;lastDay:string;self:boolean}>(),seen=new Set<string>();
 for(const a of currentStudyAttempts(pack,sessions).filter(a=>a.mode==='cards').sort((a,b)=>a.checkedAt-b.checkedAt||a.id.localeCompare(b.id))){
  if(seen.has(a.id))continue;seen.add(a.id);const previous=cards.get(a.activityId);const success=a.kind==='self'?a.answer.rating===2:a.correct===true;
  if(!previous||!success||!a.independent){cards.set(a.activityId,{id:a.activityId,step:0,due:addDays(a.localDay,1),lastDay:a.localDay,self:a.kind==='self'});continue;}
  if(a.localDay>=previous.due&&a.localDay>previous.lastDay){const step=Math.min(3,previous.step+1);cards.set(a.activityId,{...previous,step,due:addDays(a.localDay,REPETITION_INTERVALS[step]),lastDay:a.localDay});}
 }
 return [...cards.values()].sort((a,b)=>a.due.localeCompare(b.due)||a.id.localeCompare(b.id));
}
