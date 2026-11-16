import {currentStudyAttempts,emptyStudyDraft,gradeStudy,resolveStudy,studyPlan,validStudySession,wordTokens,type StudyDraft,type StudyMode,type StudySession} from '../domain/study';
import {checkPunctuation,punctuationExercises,type PunctuationDraft,type PunctuationSession,type PunctuationSign} from '../domain/punctuation';
import {checkLetter,letterExercises,type LetterDraft,type LearningSession} from '../domain/interactive';
import {localDay, repetitionPlan} from '../domain/repetition';
import {validateDiagnosticPlan} from '../domain/learning';
import Dexie, {type Table} from 'dexie';
import {ContentPackSchema,type ContentPack,type State,type Answer,type Mode,type Session,type Attempt} from '../domain/schema';
import {check,selectTasks} from '../domain/engine';
import demoJSON from '../../content-demo/pack.json';
import {config} from '../config';
class Database extends Dexie {
 studySessions!:Table<StudySession,string>;punctuationSessions!:Table<PunctuationSession,string>;learningSessions!:Table<LearningSession,string>;packs!:Table<ContentPack,string>;sessions!:Table<Session,string>;attempts!:Table<Attempt,string>;settings!:Table<{key:string;value:string},string>;
 constructor(){super('zapyataya-v1');this.version(1).stores({packs:'packId',sessions:'id,packId,status',attempts:'id,packId,sessionId',settings:'key'});this.version(2).stores({learningSessions:'id,packId,status'});this.version(3).stores({punctuationSessions:'id,packId,status'});this.version(4).stores({studySessions:'id,packId,status'});}
}
export const db=new Database();
let chain:Promise<unknown>=Promise.resolve();
function serial<T>(fn:()=>Promise<T>):Promise<T>{const next=chain.then(fn,fn);chain=next.catch(()=>{});return next;}
async function snapshot():Promise<State>{const activeId=(await db.settings.get('pack'))?.value;const pack=activeId?await db.packs.get(activeId):undefined;if(!pack)throw new Error('Набор не найден');const sessions=await db.sessions.where('packId').equals(pack.packId).toArray();sessions.sort((a,b)=>a.startedAt-b.startedAt);const learningSessions=(await db.learningSessions.where('packId').equals(pack.packId).toArray()).sort((a,b)=>a.startedAt-b.startedAt);const punctuationSessions=(await db.punctuationSessions.where('packId').equals(pack.packId).toArray()).sort((a,b)=>a.startedAt-b.startedAt);const studySessions=(await db.studySessions.where('packId').equals(pack.packId).toArray()).sort((a,b)=>a.startedAt-b.startedAt);const punctuation=punctuationExercises(pack);const exercises=letterExercises(pack);return {pack,sessions,learningSessions,punctuationSessions,studySessions,activeStudy:[...studySessions].sort((a,b)=>b.lastOpenedAt-a.lastOpenedAt).find(s=>s.status==='active'&&validStudySession(pack,s))??null,activePunctuation:punctuationSessions.find(s=>s.status==='active'&&s.exerciseIds.every(id=>punctuation.some(e=>e.id===id&&e.version===s.exerciseVersions[id])))??null,activeLearning:learningSessions.find(s=>s.status==='active'&&s.exerciseIds.every(id=>exercises.some(e=>e.id===id&&e.version===s.exerciseVersions[id])))??null,attempts:[...(await db.attempts.where('packId').equals(pack.packId).toArray()),...currentStudyAttempts(pack,studySessions).flatMap(a=>a.canonical?[a.canonical]:[])].sort((a,b)=>a.checkedAt-b.checkedAt),active:sessions.find(s=>s.status==='active')??null,theme:((await db.settings.get('theme'))?.value as State['theme'])||'system'};}
async function finishInternal(){await db.transaction('rw',[db.sessions,db.attempts,db.packs,db.settings,db.learningSessions,db.punctuationSessions,db.studySessions],async()=>{const {pack,active}=await snapshot();if(!active)return;const now=Date.now();for(const id of active.taskIds){if(active.results[id])continue;const task=pack.tasks.find(t=>t.id===id)!;const answer=active.drafts[id]??'';const a:Attempt={id:`${active.id}:${id}`,sessionId:active.id,taskId:id,taskVersion:task.version,answer,...(active.drafts[id]===undefined?{result:'skipped' as const,incomplete:false}:check(task,answer)),checkedAt:now,localDay:localDay(now),mode:active.mode,packId:pack.packId,packVersion:pack.packVersion,hintUsed:active.helped?.includes(id)??false};await db.attempts.put(a);active.results[id]=a;}active.status='completed';active.finishedAt=active.endsAt?Math.min(now,active.endsAt):now;await db.sessions.put(active);});}
export function loadState(){return serial(async()=>{await db.transaction('rw',[db.packs,db.settings,db.punctuationSessions,db.studySessions],async()=>{if(!await db.settings.get('pack')){const demo=ContentPackSchema.parse(demoJSON);await db.packs.put(demo);await db.settings.put({key:'pack',value:demo.packId});}});const bundled=ContentPackSchema.parse(demoJSON); await db.transaction('rw',[db.packs,db.punctuationSessions,db.studySessions],async()=>{const saved=await db.packs.get(bundled.packId);if(saved?.demo){saved.theory=bundled.theory;saved.tasks=saved.tasks.map(t=>{const fresh=bundled.tasks.find(x=>x.id===t.id&&x.version===t.version);return fresh?{...t,explanation:fresh.explanation}:t;});await db.packs.put(saved);}});let s=await snapshot();if(s.active?.endsAt&&s.active.endsAt<=Date.now()){await finishInternal();s=await snapshot();}return s;});}
export function startSession(ids:string[],mode:Mode,count:number,minutes=10){return serial(async()=>{await db.transaction('rw',[db.sessions,db.attempts,db.packs,db.settings,db.learningSessions,db.punctuationSessions,db.studySessions],async()=>{const s=await snapshot();if(s.active)throw new Error('Сначала продолжите или завершите текущую серию');if(mode==='diagnostic'&&(count!==10||!validateDiagnosticPlan(s.pack,ids)))throw new Error('Для диагностики нужны 10 заданий: по одному проверяемому на каждый номер ОГЭ');if(mode==='spaced'){const due=repetitionPlan(s.pack,s.attempts);if(count!==ids.length||!ids.length||new Set(ids).size!==ids.length||ids.some(id=>!due.includes(id)))throw new Error('Очередь повторения обновилась. Открой её заново');}const eligible=mode==='timed'?ids.filter(id=>s.pack.tasks.some(t=>t.id===id&&t.timed&&t.type!=='self')):ids;const taskIds=mode==='timed'||mode==='diagnostic'||mode==='spaced'?[...new Set(eligible)].slice(0,count):selectTasks(s.pack,s.attempts,eligible,count);if(!taskIds.length)throw new Error('В этом разделе пока нет доступных заданий');if(mode==='timed'&&taskIds.length<count)throw new Error('Недостаточно заданий для этого мини-варианта');const now=Date.now();const session:Session={id:crypto.randomUUID(),packId:s.pack.packId,packVersion:s.pack.packVersion,mode,taskIds,position:0,drafts:{},results:{},status:'active',startedAt:now,...(mode==='timed'?{endsAt:now+minutes*60000}:{})};await db.sessions.put(session);});return snapshot();});}
export function saveDraft(taskId:string,answer:Answer){return serial(async()=>{await db.transaction('rw',[db.sessions,db.attempts,db.packs,db.settings,db.learningSessions,db.punctuationSessions,db.studySessions],async()=>{const {active}=await snapshot();if(!active||!active.taskIds.includes(taskId)||active.results[taskId])return;if(active.endsAt&&Date.now()>=active.endsAt)return;active.drafts[taskId]=answer;await db.sessions.put(active);});return snapshot();});}
export function setPosition(position:number){return serial(async()=>{const {active}=await snapshot();if(active){active.position=Math.min(active.taskIds.length-1,Math.max(0,position));await db.sessions.put(active);}return snapshot();});}
export function checkCurrent(skip=false){return serial(async()=>{await db.transaction('rw',[db.sessions,db.attempts,db.packs,db.settings,db.learningSessions,db.punctuationSessions,db.studySessions],async()=>{const {active,pack}=await snapshot();if(!active||active.mode==='timed'||active.mode==='diagnostic')return;const id=active.taskIds[active.position];if(active.results[id])return;const task=pack.tasks.find(t=>t.id===id)!;const answer=skip?'':active.drafts[id]??'';const a:Attempt={id:`${active.id}:${id}`,sessionId:active.id,taskId:id,taskVersion:task.version,answer,...(skip?{result:'skipped' as const,incomplete:false}:check(task,answer)),checkedAt:Date.now(),localDay:localDay(),mode:active.mode,packId:pack.packId,packVersion:pack.packVersion,hintUsed:active.helped?.includes(id)??false};await db.attempts.put(a);active.results[id]=a;await db.sessions.put(active);});return snapshot();});}
export function finishSession(){return serial(async()=>{await finishInternal();return snapshot();});}
export const abandonSession=finishSession;
export function setTheme(theme:State['theme']){return serial(async()=>{await db.settings.put({key:'theme',value:theme});return snapshot();});}
export async function parsePackFile(file:File):Promise<ContentPack>{if(file.size>config.maxPackBytes)throw new Error('Набор слишком большой. Максимум — 20 МБ');let data:unknown;try{data=JSON.parse(await file.text());}catch{throw new Error('Не удалось прочитать JSON. Выберите файл pack.json');}const result=ContentPackSchema.safeParse(data);if(!result.success)throw new Error('Набор несовместим или повреждён: '+result.error.issues.slice(0,3).map(i=>i.message).join('; '));return result.data;}
export function importPack(input:ContentPack){return serial(async()=>{const pack=ContentPackSchema.parse(input);await db.transaction('rw',[db.packs,db.sessions,db.settings,db.attempts,db.learningSessions,db.punctuationSessions,db.studySessions],async()=>{const state=await snapshot();if(state.active)throw new Error('Завершите текущую серию перед сменой набора');const old=await db.packs.get(pack.packId);if(old){if(old.packVersion===pack.packVersion&&JSON.stringify(old)!==JSON.stringify(pack))throw new Error('Конфликт: у этой версии набора уже другое содержимое');for(const task of pack.tasks){const prev=old.tasks.find(t=>t.id===task.id);if(prev&&prev.version===task.version&&JSON.stringify(prev)!==JSON.stringify(task)&&!(prev.verification==='rules'&&task.verification==='manual'&&JSON.stringify({...prev,verification:'manual'})===JSON.stringify(task)))throw new Error(`Изменённое задание ${task.id} должно иметь новую версию`);}}await db.packs.put(pack);await db.settings.put({key:'pack',value:pack.packId});});return snapshot();});}
export function useDemo(){return importPack(ContentPackSchema.parse(demoJSON));}

export async function findStoredPack(checksum:string){return (await db.packs.toArray()).find(p=>p.source.checksum===checksum)??null;}

export function startLetters(){return serial(async()=>{
 await db.transaction('rw',[db.learningSessions,db.packs,db.settings,db.sessions,db.attempts,db.punctuationSessions,db.studySessions],async()=>{
  const state=await snapshot();if(state.activeLearning){state.activeLearning.lastOpenedAt=Date.now();await db.learningSessions.put(state.activeLearning);return;}
  const exercises=letterExercises(state.pack);if(!exercises.length)throw new Error('Сначала открой проверенный набор пособия');
  for(const old of state.learningSessions.filter(s=>s.status==='active'))await db.learningSessions.put({...old,status:'completed',finishedAt:Date.now()});
  await db.learningSessions.put({id:crypto.randomUUID(),packId:state.pack.packId,mechanic:'letters',exerciseIds:exercises.map(e=>e.id),exerciseVersions:Object.fromEntries(exercises.map(e=>[e.id,e.version])),position:0,drafts:{},results:{},status:'active',startedAt:Date.now()});
 });return snapshot();
});}
export function saveLetterDraft(exerciseId:string,update:Partial<LetterDraft>){return serial(async()=>{
 await db.transaction('rw',[db.learningSessions,db.packs,db.settings,db.sessions,db.attempts,db.punctuationSessions,db.studySessions],async()=>{
  const {pack,activeLearning:session}=await snapshot();if(!session||session.results[exerciseId]||!session.exerciseIds.includes(exerciseId))return;
  const exercise=letterExercises(pack).find(e=>e.id===exerciseId);if(!exercise)return;
  const previous=session.drafts[exerciseId]??{letter:'',rule:'',hintUsed:false};
  const draft={...previous,...update,hintUsed:previous.hintUsed||update.hintUsed===true};
  if(!['','е','и'].includes(draft.letter)||draft.rule&&!exercise.choices.some(c=>c.id===draft.rule))throw new Error('Неизвестный вариант ответа');
  session.drafts[exerciseId]=draft;session.lastOpenedAt=Date.now();await db.learningSessions.put(session);
 });return snapshot();
});}
export function checkLetterCurrent(){return serial(async()=>{
 await db.transaction('rw',[db.learningSessions,db.packs,db.settings,db.sessions,db.attempts,db.punctuationSessions,db.studySessions],async()=>{
  const {pack,activeLearning:session}=await snapshot();if(!session)return;
  const id=session.exerciseIds[session.position];if(session.results[id])return;
  const exercise=letterExercises(pack).find(e=>e.id===id),draft=session.drafts[id];
  if(!exercise||!draft?.letter||!draft.rule)throw new Error('Выбери букву и объяснение');
  const now=Date.now();session.results[id]={id:`${session.id}:${id}`,exerciseId:id,exerciseVersion:exercise.version,taskId:exercise.taskId,taskVersion:exercise.taskVersion,answer:draft,...checkLetter(exercise,draft),checkedAt:now,localDay:localDay(now)};
  await db.learningSessions.put(session);
 });return snapshot();
});}
export function nextLetter(){return serial(async()=>{
 await db.transaction('rw',[db.learningSessions,db.packs,db.settings,db.sessions,db.attempts,db.punctuationSessions,db.studySessions],async()=>{
  const {activeLearning:session}=await snapshot();if(!session)return;
  if(!session.results[session.exerciseIds[session.position]])throw new Error('Сначала проверь ответ');
  if(session.position+1===session.exerciseIds.length){session.status='completed';session.finishedAt=Date.now();}else session.position++;
  await db.learningSessions.put(session);
 });return snapshot();
});}

export function startPunctuation(){return serial(async()=>{
 await db.transaction('rw',[db.punctuationSessions,db.learningSessions,db.packs,db.settings,db.sessions,db.attempts,db.studySessions],async()=>{
  const state=await snapshot();if(state.activePunctuation){state.activePunctuation.lastOpenedAt=Date.now();await db.punctuationSessions.put(state.activePunctuation);return;}
  const exercises=punctuationExercises(state.pack);if(!exercises.length)throw new Error('Сначала открой обновлённый набор пособия');
  for(const old of state.punctuationSessions.filter(s=>s.status==='active'))await db.punctuationSessions.put({...old,status:'completed',finishedAt:Date.now()});
  const now=Date.now();await db.punctuationSessions.put({id:crypto.randomUUID(),packId:state.pack.packId,exerciseIds:exercises.map(e=>e.id),exerciseVersions:Object.fromEntries(exercises.map(e=>[e.id,e.version])),position:0,drafts:{},results:{},status:'active',startedAt:now,lastOpenedAt:now});
 });return snapshot();
});}
export function savePunctuationDraft(exerciseId:string,update:{selected?:string;hintUsed?:boolean;position?:string;sign?:PunctuationSign|null}){return serial(async()=>{
 await db.transaction('rw',[db.punctuationSessions,db.learningSessions,db.packs,db.settings,db.sessions,db.attempts,db.studySessions],async()=>{
  const {pack,activePunctuation:session}=await snapshot();if(!session||session.results[exerciseId]||!session.exerciseIds.includes(exerciseId))return;
  const exercise=punctuationExercises(pack).find(e=>e.id===exerciseId);if(!exercise)return;
  const previous=session.drafts[exerciseId]??{signs:{},hintUsed:false,selected:exercise.positions[0].id};
  const draft:PunctuationDraft={...previous,signs:{...previous.signs},hintUsed:previous.hintUsed||update.hintUsed===true,selected:update.selected??previous.selected};
  if(!exercise.positions.some(p=>p.id===draft.selected))throw new Error('Неизвестная позиция');
  if(update.position!==undefined){
   if(!exercise.positions.some(p=>p.id===update.position)||update.sign!==null&&!['—',',','none'].includes(update.sign??''))throw new Error('Неизвестный знак или позиция');
   if(update.sign===null)delete draft.signs[update.position];else draft.signs[update.position]=update.sign!;
  }
  session.drafts[exerciseId]=draft;session.lastOpenedAt=Date.now();await db.punctuationSessions.put(session);
 });return snapshot();
});}
export function checkPunctuationCurrent(){return serial(async()=>{
 await db.transaction('rw',[db.punctuationSessions,db.learningSessions,db.packs,db.settings,db.sessions,db.attempts,db.studySessions],async()=>{
  const {pack,activePunctuation:session}=await snapshot();if(!session)return;
  const id=session.exerciseIds[session.position];if(session.results[id])return;
  const exercise=punctuationExercises(pack).find(e=>e.id===id),draft=session.drafts[id];
  if(!exercise||!draft)throw new Error('Заполни все позиции; отсутствие знака выбери явно');
  const result=checkPunctuation(exercise,draft);if(!result.complete)throw new Error('Заполни все позиции; отсутствие знака выбери явно');
  const now=Date.now();session.results[id]={id:`${session.id}:${id}`,exerciseId:id,exerciseVersion:exercise.version,taskId:exercise.taskId,taskVersion:exercise.taskVersion,answer:draft,correctPositions:result.correctPositions,totalPositions:result.totalPositions,checkedAt:now,localDay:localDay(now)};
  session.lastOpenedAt=now;await db.punctuationSessions.put(session);
 });return snapshot();
});}
export function nextPunctuation(){return serial(async()=>{
 await db.transaction('rw',[db.punctuationSessions,db.learningSessions,db.packs,db.settings,db.sessions,db.attempts,db.studySessions],async()=>{
  const {activePunctuation:session}=await snapshot();if(!session)return;
  if(!session.results[session.exerciseIds[session.position]])throw new Error('Сначала проверь ответ');
  if(session.position+1===session.exerciseIds.length){session.status='completed';session.finishedAt=Date.now();}else session.position++;
  session.lastOpenedAt=Date.now();await db.punctuationSessions.put(session);
 });return snapshot();
});}

export function startStudy(mode:StudyMode,lessonId?:string){return serial(async()=>{
 await db.transaction('rw',[db.studySessions,db.punctuationSessions,db.learningSessions,db.packs,db.settings,db.sessions,db.attempts],async()=>{
  const state=await snapshot();const active=state.studySessions.find(s=>s.mode===mode&&s.status==='active'&&validStudySession(state.pack,s));
  if(active){if(mode==='lesson'&&lessonId&&active.lessonId!==lessonId)throw new Error('Сначала продолжи или заверши начатый урок');active.lastOpenedAt=Date.now();await db.studySessions.put(active);return;}
  const plan=studyPlan(state.pack,mode,state.studySessions,state.attempts,localDay(),lessonId);if(!plan.length)throw new Error(mode==='cards'?'На сегодня карточки закончились':'Пока нет доступных упражнений. Открой обновлённый набор пособия');
  for(const old of state.studySessions.filter(s=>s.mode===mode&&s.status==='active'))await db.studySessions.put({...old,status:'archived',finishedAt:Date.now()});
  const now=Date.now();await db.studySessions.put({id:crypto.randomUUID(),packId:state.pack.packId,mode,plan:plan.map(a=>a.id),versions:Object.fromEntries(plan.map(a=>[a.id,a.version])),position:0,drafts:{},results:{},status:'active',startedAt:now,lastOpenedAt:now,...((lessonId??plan.find(a=>a.lessonId)?.lessonId)?{lessonId:lessonId??plan.find(a=>a.lessonId)?.lessonId}:{}),...(mode==='daily'?{day:localDay(now)}:{})});
 });return snapshot();
});}
export function saveStudyDraft(sessionId:string,activityId:string,change:Partial<StudyDraft>){return serial(async()=>{
 await db.transaction('rw',[db.studySessions,db.punctuationSessions,db.learningSessions,db.packs,db.settings,db.sessions,db.attempts],async()=>{
  const state=await snapshot(),session=state.studySessions.find(s=>s.id===sessionId&&s.status==='active'&&validStudySession(state.pack,s));if(!session||session.plan[session.position]!==activityId||session.results[activityId])return;
  const activity=resolveStudy(state.pack,activityId)!;const old=session.drafts[activityId]??emptyStudyDraft();
  const draft={...old,...change,hintUsed:old.hintUsed||change.hintUsed===true,revealed:old.revealed||change.revealed===true};
  if(activity.kind==='tokens'){
   const ids=new Set(wordTokens(activity).map(t=>t.id));
   if(Object.entries(draft.roles).some(([id,role])=>!ids.has(id)||!['subject','predicate','main'].includes(role)))throw new Error('Неизвестное слово или роль');
  }
  if(draft.choice&&!activity.choices?.some(c=>c.id===draft.choice)||draft.example&&!activity.examples?.some(c=>c.id===draft.example))throw new Error('Неизвестный вариант ответа');
  if(draft.rating!==undefined&&![0,1,2].includes(draft.rating))throw new Error('Неизвестная самооценка');
  session.drafts[activityId]=draft;session.lastOpenedAt=Date.now();await db.studySessions.put(session);
 });return snapshot();
});}
export function checkStudyCurrent(sessionId:string,activityId:string){return serial(async()=>{
 await db.transaction('rw',[db.studySessions,db.punctuationSessions,db.learningSessions,db.packs,db.settings,db.sessions,db.attempts],async()=>{
  const state=await snapshot(),session=state.studySessions.find(s=>s.id===sessionId&&s.status==='active'&&validStudySession(state.pack,s));if(!session||session.plan[session.position]!==activityId||session.results[activityId])return;
  const activity=resolveStudy(state.pack,activityId)!,draft=session.drafts[activityId]??emptyStudyDraft(),grade=gradeStudy(activity,draft,state.pack);if(!grade.complete)throw new Error('Сначала выполни оба шага задания');
  const now=Date.now();session.results[activityId]={id:`${session.id}:${activityId}`,activityId,activityVersion:activity.version,taskId:activity.sourceTaskId,taskVersion:activity.sourceTaskVersion,kind:activity.kind,mode:session.mode,answer:draft,correct:grade.correct,independent:activity.independent&&!draft.hintUsed,checkedAt:now,localDay:localDay(now)};
  if(activity.kind==='ordinary'){
   const task=state.pack.tasks.find(t=>t.id===activity.sourceTaskId)!;
   session.results[activityId].canonical={id:`${session.id}:${activityId}`,sessionId:session.id,taskId:task.id,taskVersion:task.version,answer:draft.ordinary!,...check(task,draft.ordinary),checkedAt:now,localDay:localDay(now),hintUsed:draft.hintUsed,mode:activity.canonicalMode??'practice',packId:state.pack.packId,packVersion:state.pack.packVersion};
  }
  session.lastOpenedAt=now;await db.studySessions.put(session);
 });return snapshot();
});}
export function nextStudy(sessionId:string,activityId:string){return serial(async()=>{
 await db.transaction('rw',[db.studySessions,db.punctuationSessions,db.learningSessions,db.packs,db.settings,db.sessions,db.attempts],async()=>{
  const state=await snapshot(),session=state.studySessions.find(s=>s.id===sessionId&&s.status==='active'&&validStudySession(state.pack,s));if(!session||session.plan[session.position]!==activityId)return;
  const activity=resolveStudy(state.pack,activityId)!;
  if(!session.results[activityId]){
   if(activity.kind!=='read')throw new Error('Сначала проверь ответ');
   const now=Date.now();session.results[activityId]={id:`${session.id}:${activityId}`,activityId,activityVersion:activity.version,taskId:activity.sourceTaskId,taskVersion:activity.sourceTaskVersion,kind:activity.kind,mode:session.mode,answer:emptyStudyDraft(),correct:null,independent:false,checkedAt:now,localDay:localDay(now)};
  }
  if(session.position+1===session.plan.length){session.status='completed';session.finishedAt=Date.now();}else session.position++;
  session.lastOpenedAt=Date.now();await db.studySessions.put(session);
 });return snapshot();
});}

export function markTaskHelp(taskId:string){return serial(async()=>{
 const {active}=await snapshot();
 if(active&&active.mode!=='timed'&&active.mode!=='diagnostic'&&active.taskIds.includes(taskId)&&!active.results[taskId]){
  active.helped=[...new Set([...(active.helped??[]),taskId])];await db.sessions.put(active);
 }
 return snapshot();
});}
