import {StudyHubs,LessonHub,CardOverview,DailyHub,LEARNING_MODES} from './StudyHubs';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Link,useNavigate,useParams,useSearchParams} from 'react-router-dom';
import {ArrowRight,Check,Lightbulb} from 'lucide-react';
import type {Answer,State,Task} from '../domain/schema';
import {currentStudyAttempts,emptyStudyDraft,expectedRoles,gradeStudy,ROLE_LABELS,resolveStudy,STUDY_LABELS,validStudySession,wordTokens,type GrammarRole,type StudyActivity,type StudyDraft,type StudyMode,type StudySession} from '../domain/study';
import * as store from '../storage/store';

export type StudyRun=(action:Promise<State>)=>Promise<State|undefined>;
export type OrdinaryRenderer=(props:{task:Task;answer:Answer|undefined;onChange:(answer:Answer)=>void;disabled:boolean;feedback?:boolean})=>ReactNode;
const activeFor=(state:State,mode:StudyMode)=>state.studySessions.find(s=>s.mode===mode&&s.status==='active'&&validStudySession(state.pack,s));
const ENABLED_MODES=LEARNING_MODES;
export function StudyIntros({state,run}:{state:State;run:StudyRun}) {return <StudyHubs state={state} run={run}/>;}
export function StudyStats({state}:{state:State}) {
 const attempts=currentStudyAttempts(state.pack,state.studySessions);
 return <section className="card mode-stats" aria-label="Результаты учебных режимов"><h2>Мастерская: самостоятельные ответы</h2><p>Учебные преобразования учитываются отдельно от обычных вопросов. Самооценка и чтение не входят в объективную точность.</p><dl>{ENABLED_MODES.map(mode=>{
  const all=attempts.filter(a=>resolveStudy(state.pack,a.activityId)?.mode===mode&&a.kind!=='ordinary'&&a.correct!==null),independent=all.filter(a=>a.independent);
  return <div key={mode}><dt>{STUDY_LABELS[mode]}</dt><dd>{independent.filter(a=>a.correct).length} / {independent.length} самостоятельно · с помощью: {all.length-independent.length}{independent.length>0&&independent.length<5?' · мало данных':''}</dd></div>;
 })}</dl><p className="progress-note">Карточки с самооценкой: {attempts.filter(a=>a.kind==='self').length}. Эти ответы не входят в число объективно верных.</p></section>;
}
export default function StudyPage({state,run,renderOrdinary}:{state:State;run:StudyRun;renderOrdinary?:OrdinaryRenderer}) {
 const {mode:raw}=useParams();const [search]=useSearchParams();
 if(!raw||!Object.hasOwn(STUDY_LABELS,raw))return <div className="reading"><h1>Режим не найден</h1><Link className="button" to="/workshop">К мастерской</Link></div>;
 const mode=raw as StudyMode,session=activeFor(state,mode);
 if(mode==='daily'&&!session)return <DailyHub state={state} run={run}/>;
 if(mode==='lesson'&&search.get('list')==='1')return <LessonHub state={state} run={run}/>;
 const activity=session?resolveStudy(state.pack,session.plan[session.position]):undefined;
 if(session&&activity)return <StudyQuestion key={`${session.id}:${activity.id}`} state={state} session={session} activity={activity} run={run} renderOrdinary={renderOrdinary}/>;
 const finished=state.studySessions.filter(s=>s.mode===mode&&s.status==='completed'&&validStudySession(state.pack,s)).at(-1);
 if(!finished&&mode==='lesson')return <LessonHub state={state} run={run}/>;
 if(!finished&&mode==='cards')return <div className="reading"><Link className="back" to="/workshop">← К мастерской</Link><h1>Карточки</h1><CardOverview state={state} run={run}/></div>;
 if(!finished)return <div className="reading"><Link className="back" to="/workshop">← К мастерской</Link><h1>{STUDY_LABELS[mode]}</h1><StudyIntros state={state} run={run}/></div>;
 const results=Object.values(finished.results).filter(a=>a.kind!=='read'),checked=results.filter(a=>a.correct!==null);
 return <div className="reading"><Link className="back" to="/workshop">← К мастерской</Link><section className="card"><span className="badge lime">Серия завершена</span><h1 style={{marginTop:20}}>{STUDY_LABELS[mode]}</h1>
  <p>Верно: {checked.filter(a=>a.correct).length} из {checked.length}. С помощью: {results.filter(a=>a.correct!==null&&!a.independent).length}.</p>
  {mode==='lesson'&&<p>Самостоятельно: {checked.filter(a=>a.independent&&a.correct).length} из {checked.filter(a=>a.independent).length}. Вернись к объяснению тех шагов, где осталось непонимание.</p>}
  {mode==='cards'&&<p>Самооценок: {results.filter(a=>a.kind==='self').length}. Они не включены в число верных проверяемых ответов.</p>}
  <ul className="repetition-list">{finished.plan.map(id=>{const a=resolveStudy(state.pack,id)!,result=finished.results[id];return <li key={id}><h2>{a.title}</h2>{result&&<><p>{result.correct===null?result.kind==='read'?'Учебный шаг прочитан':'Самооценка сохранена':result.correct?'✓ Верно':'✕ Нужно повторить'}</p><details><summary>Разобрать</summary><StudyFeedback activity={a} answer={result.answer}/></details></>}</li>;})}</ul>
  <div className="series-options">{mode==='reason'&&<button className="button" onClick={()=>void run(store.startStudy(mode))}>Следующая серия <ArrowRight size={16}/></button>}<Link className={mode==='reason'?'button secondary':'button'} to="/progress">Мой прогресс <ArrowRight size={16}/></Link></div>
 </section>{mode==='cards'&&<CardOverview state={state} run={run}/>}{mode==='lesson'&&<p><Link className="button secondary" to="/workshop/lesson?list=1">Выбрать следующий урок</Link></p>}</div>;
}
function TokenInput({activity,draft,change,disabled,checked}:{activity:StudyActivity;draft:StudyDraft;change:(patch:Partial<StudyDraft>)=>void;disabled:boolean;checked:boolean}) {
 const [tool,setTool]=useState<GrammarRole|'erase'>('subject');const keyboardTarget=useRef<string|null>(null);const buttons=useRef(new Map<string,HTMLButtonElement>());
 useEffect(()=>{if(!disabled&&keyboardTarget.current){buttons.current.get(keyboardTarget.current)?.focus();keyboardTarget.current=null;}},[disabled]);
 const expected=checked?expectedRoles(activity):{};
 const tokens=wordTokens(activity);let cursor=0;
 return <><div className="grammar-tools" role="group" aria-label="Инструмент выделения">{([...Object.keys(ROLE_LABELS),'erase'] as (GrammarRole|'erase')[]).map(role=><button key={role} className="button secondary" aria-pressed={tool===role} disabled={disabled} onClick={()=>setTool(role)}>{role==='erase'?'Убрать':ROLE_LABELS[role]}</button>)}</div>
  <div className="grammar-sentence" aria-label="Предложение для выделения">{tokens.map(token=>{
   const prefix=activity.prompt.slice(cursor,token.start);cursor=token.end;
   const chosen=draft.roles[token.id],expectedRole=expected[token.id];
   return <span key={token.id}>{prefix}<button data-token-id={token.id} data-role-mark={chosen?chosen==='subject'?'П':chosen==='predicate'?'С':'Г':''} ref={el=>{if(el)buttons.current.set(token.id,el);else buttons.current.delete(token.id);}} className={`grammar-word ${chosen?`role-${chosen}`:''} ${checked&&(chosen||expectedRole)?chosen===expectedRole?'token-correct':'token-wrong':''}`} aria-label={`${token.text}, ${chosen?ROLE_LABELS[chosen]:'не выделено'}`} aria-pressed={!!chosen} disabled={disabled} onClick={event=>{
    if(event.detail===0)keyboardTarget.current=token.id;
    const roles={...draft.roles};if(tool==='erase'||roles[token.id]===tool)delete roles[token.id];else roles[token.id]=tool;change({roles});
   }}>{token.text}</button></span>;
  })}{activity.prompt.slice(cursor)}</div><p className="progress-note">П — подлежащее, С — сказуемое, Г — главный член односоставного предложения. Нажми повторно тем же инструментом, чтобы убрать выделение.</p></>;
}
export function StudyFeedback({activity,answer}:{activity:StudyActivity;answer:StudyDraft}) {
 const expected=activity.kind==='tokens'?expectedRoles(activity):{};
 return <div className="study-feedback-content">
  {activity.kind==='tokens'&&<ul className="token-feedback">{wordTokens(activity).filter(t=>expected[t.id]||answer.roles[t.id]).map(t=>{
   const chosen=answer.roles[t.id],correct=expected[t.id];return <li key={t.id} className={chosen===correct?'correct-text':'wrong-text'}>{chosen===correct?'✓':!chosen?'＋ Пропущено:':!correct?'✕ Лишнее:':'✕ Другая роль:'} <strong>{t.text}</strong> · выбрано: {chosen?ROLE_LABELS[chosen]:'ничего'}; верно: {correct?ROLE_LABELS[correct]:'не входит в основу'}</li>;
  })}</ul>}
  {(activity.kind==='repair'||activity.kind==='choice')&&<><p className={answer.choice===activity.key?'correct-text':'wrong-text'}>{answer.choice===activity.key?'✓':'✕'} {activity.kind==='repair'?'Твоё объяснение':'Твой ответ'}: {activity.choices?.find(c=>c.id===answer.choice)?.text}</p><p><strong>Верно:</strong> {activity.choices?.find(c=>c.id===activity.key)?.text}</p>{activity.kind==='repair'&&<><p className={answer.example===activity.exampleKey?'correct-text':'wrong-text'}>{answer.example===activity.exampleKey?'✓':'✕'} Твой пример: {activity.examples?.find(c=>c.id===answer.example)?.text}</p><p><strong>Подтверждает правило:</strong> {activity.examples?.find(c=>c.id===activity.exampleKey)?.text}</p></>}</>}
  {activity.kind==='self'&&answer.rating!==undefined&&<p>Твоя самооценка: {['Не вспомнил','Частично','Вспомнил сам'][answer.rating]}.</p>}<p>{activity.explanation}</p>
 </div>;
}
function StudyQuestion({state,session,activity,run,renderOrdinary}:{state:State;session:StudySession;activity:StudyActivity;run:StudyRun;renderOrdinary?:OrdinaryRenderer}) {
 const navigate=useNavigate(),[draft,setDraft]=useState<StudyDraft>(session.drafts[activity.id]??emptyStudyDraft());
 const [pending,setPending]=useState(0),[busy,setBusy]=useState(false);const saving=pending>0;const draftRef=useRef(draft);const checked=session.results[activity.id];
 const heading=useRef<HTMLHeadingElement>(null),feedback=useRef<HTMLDivElement>(null),sample=useRef<HTMLDivElement>(null);
 const keyboardRadio=useRef(false),radioFocus=useRef<HTMLInputElement|null>(null);
 useEffect(()=>{if(!saving&&radioFocus.current){radioFocus.current.focus();radioFocus.current=null;}},[saving]);
 const task=state.pack.tasks.find(t=>t.id===activity.sourceTaskId)!,topic=state.pack.topics.find(t=>task.topicIds.includes(t.id));
 useEffect(()=>{heading.current?.focus();window.scrollTo(0,0);void run(store.startStudy(session.mode,session.lessonId));},[]);
 useEffect(()=>{if(checked)feedback.current?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});},[checked]);
 useEffect(()=>{if(draft.revealed&&!checked){sample.current?.focus({preventScroll:true});sample.current?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}},[draft.revealed]);
 useEffect(()=>{if(!saving)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',warn);return ()=>window.removeEventListener('beforeunload',warn);},[saving]);
 const change=async(patch:Partial<StudyDraft>)=>{
  if((saving&&activity.kind!=='ordinary')||busy||checked)return;const previous=draftRef.current;const next={...previous,...patch};draftRef.current=next;setDraft(next);setPending(n=>n+1);
  const saved=await run(store.saveStudyDraft(session.id,activity.id,patch));if(!saved&&draftRef.current===next){draftRef.current=previous;setDraft(previous);}setPending(n=>n-1);return saved;
 };
 const action=async()=>{if(saving||busy)return;setBusy(true);await run(checked||activity.kind==='read'?store.nextStudy(session.id,activity.id):store.checkStudyCurrent(session.id,activity.id));setBusy(false);};
 const select=(items:{id:string;text:string}[],field:'choice'|'example',label:string)=><fieldset className="study-fieldset"><legend>{label}</legend><div className="study-options">{items.map(c=><label className="option radio-option" key={c.id}><input type="radio" name={`${activity.id}-${field}`} disabled={!!checked||saving||busy} checked={draft[field]===c.id} onKeyDown={event=>{if(['ArrowDown','ArrowUp','ArrowLeft','ArrowRight',' '].includes(event.key))keyboardRadio.current=true;}} onChange={event=>{if(keyboardRadio.current){radioFocus.current=event.currentTarget;keyboardRadio.current=false;}void change({[field]:c.id});}}/><span>{c.text}</span></label>)}</div></fieldset>;
 return <div className="reading study-session"><div className="session-header"><Link className="back" to="/">← Выйти и сохранить</Link><span className="badge neutral">{STUDY_LABELS[session.mode]}</span></div>
  <ol className="study-route" aria-label="Маршрут серии">{session.plan.map((id,index)=>{const step=resolveStudy(state.pack,id)!;return <li key={id} aria-current={index===session.position?'step':undefined} className={session.results[id]?'done':index===session.position?'current':''}><span aria-hidden="true">{session.results[id]?'✓':index+1}</span><small>{session.mode==='lesson'?step.stage:step.kind==='read'?'Разбор':step.kind==='ordinary'?'Практика':step.mode==='cards'?'Вспомнить':step.stage??'Проверка'}</small></li>;})}</ol>
  <div className="progress-line"><span style={{width:`${(session.position+1)/session.plan.length*100}%`}}/></div>
  <section className="card question-card"><h1 ref={heading} tabIndex={-1}>Шаг {session.position+1} из {session.plan.length}</h1><h2>{activity.title}</h2>{activity.stage&&<span className="badge neutral">{activity.stage}</span>}<p>{activity.instruction}</p>
   {activity.kind==='tokens'?<TokenInput activity={activity} draft={draft} change={patch=>void change(patch)} disabled={!!checked||saving||busy} checked={!!checked}/>:<p className="study-prompt">{activity.prompt}</p>}
   {(activity.kind==='repair'||activity.kind==='choice')&&select(activity.choices??[],'choice',activity.kind==='repair'?'Какое объяснение верно?':'Выбери верный ответ')}
   {activity.kind==='repair'&&select(activity.examples??[],'example','Какой пример подтверждает правило?')}
   {activity.kind==='ordinary'&&renderOrdinary?.({task,answer:draft.ordinary,onChange:answer=>void change({ordinary:answer}),disabled:!!checked||busy})}
   {activity.kind==='self'&&!checked&&<>{!draft.revealed?<button className="button secondary" disabled={saving||busy} onClick={()=>void change({revealed:true})}>Открыть образец</button>:<><div className="explanation" ref={sample} tabIndex={-1} role="region" aria-label="Образец карточки"><StudyFeedback activity={activity} answer={draft}/></div><fieldset className="study-fieldset"><legend>Насколько удалось вспомнить?</legend>{([{value:0,label:'Не вспомнил'},{value:1,label:'Частично'},{value:2,label:'Вспомнил сам'}] as const).map(r=><label key={r.value} className="option radio-option"><input type="radio" name={activity.id+'-rating'} disabled={saving||busy} checked={draft.rating===r.value} onKeyDown={event=>{if(['ArrowDown','ArrowUp',' '].includes(event.key))keyboardRadio.current=true;}} onChange={event=>{if(keyboardRadio.current){radioFocus.current=event.currentTarget;keyboardRadio.current=false;}void change({rating:r.value});}}/><span>{r.label}</span></label>)}</fieldset></>}</>}
   {!checked&&activity.kind!=='read'&&activity.independent&&<button className="text-link" disabled={saving||busy||draft.hintUsed} onClick={()=>void change({hintUsed:true})}><Lightbulb size={17}/> {draft.hintUsed?'Подсказка открыта':'Нужна подсказка'}</button>}
   {(draft.hintUsed||!activity.independent&&activity.kind==='tokens')&&<p className="notice" role="note">{activity.hint} Ответ учитывается как решение с помощью.</p>}
   {checked&&<div className="explanation" ref={feedback} role="status" aria-label="Результат учебного шага"><h2>{checked.correct===null?'Образец и самооценка':checked.correct?'✓ Верно':'✕ Разберём ошибку'}</h2>{activity.kind==='ordinary'?renderOrdinary?.({task,answer:checked.answer.ordinary,onChange:()=>{},disabled:true,feedback:true}):<StudyFeedback activity={activity} answer={checked.answer}/>}</div>}
   <p className="source" style={{marginTop:24}}>{activity.origin==='author'?'Авторский учебный пример. Связанное задание:':'Источник:'} № {task.oge}, условие — стр. {task.source.pages.join(', ')||'демо'}, ключ — {task.source.answerPages.join(', ')||'авторский пример'}. Разметка и пояснения подготовлены для учебного режима.</p>
   {topic?.theoryIds[0]&&<p><Link className="text-link" to={`/theory/${topic.theoryIds[0]}?topic=${topic.id}`} onClick={async event=>{event.preventDefault();if(saving||busy)return;const target=`/theory/${topic.theoryIds[0]}?topic=${topic.id}`;if(checked||draft.hintUsed){navigate(target);return;}const saved=await change({hintUsed:true});if(saved)navigate(target);}}>Правило по теме</Link><small style={{display:'block',marginTop:8}}>Теория до проверки отмечается как помощь.</small></p>}
   <Link className="text-link" to={`/topics/${task.topicIds[0]}`}>Обычная практика № {task.oge}</Link>
  </section>
  <div className="action-bar"><small role="status" aria-label="Сохранение учебного шага">{saving?'Сохраняем…':'Черновик сохранён'}</small><button className="button" disabled={saving||busy||!checked&&activity.kind!=='read'&&!gradeStudy(activity,draft,state.pack).complete} onClick={()=>void action()}>{checked||activity.kind==='read'?session.position+1===session.plan.length?'Завершить серию':'Следующий шаг':activity.kind==='self'?'Сохранить самооценку':'Проверить шаг'} {checked?<ArrowRight size={16}/>:<Check size={16}/>}</button></div>
 </div>;
}
