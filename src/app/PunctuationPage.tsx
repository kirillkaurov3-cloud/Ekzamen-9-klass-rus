import {useEffect,useRef,useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {ArrowRight,Check,Lightbulb,X} from 'lucide-react';
import type {ContentPack,State} from '../domain/schema';
import {plural} from '../domain/format';
import {checkPunctuation,punctuationExercises,punctuationResults,punctuationText,signLabel,splitPunctuationText,type PunctuationDraft,type PunctuationExercise,type PunctuationSession,type PunctuationSign} from '../domain/punctuation';
import * as store from '../storage/store';

type Run=(action:Promise<State>)=>Promise<State|undefined>;
const textCount=(n:number)=>`${n} ${plural(n,'текст','текста','текстов')}`;
export function PunctuationIntro({state,run}:{state:State;run:Run}) {
 const navigate=useNavigate(),exercises=punctuationExercises(state.pack);
 const positions=exercises.reduce((n,e)=>n+e.positions.length,0);
 return <section className="card punctuation-intro">
  <span className="badge">ОГЭ № 5</span><h2 style={{marginTop:20}}>Знаки на своих местах</h2>
  <p>Нажми на позицию в тексте и поставь запятую, тире или явно выбери «Без знака». После проверки разберём каждую позицию.</p>
  {exercises.length>0?<><p>{textCount(exercises.length)} · {positions} {plural(positions,'проверяемая позиция','проверяемые позиции','проверяемых позиций')}.</p>
   <button className="button" onClick={()=>void run(store.startPunctuation()).then(next=>{if(next)navigate('/workshop/punctuation');})}>{state.activePunctuation?'Продолжить расстановку':`Расставить знаки · ${textCount(exercises.length)}`} <ArrowRight size={16}/></button>
   {exercises.length<5&&<p className="progress-note">Для полной серии из пяти текстов открой обновлённое пособие в <Link className="text-link" to="/library">библиотеке</Link>.</p>}
  </>:<Link className="button secondary" to="/library">Открыть пособие</Link>}
  <p className="progress-note">Условие: стр. 172–173, разбор: 440–441. В книге нужно найти тире; здесь восстановим все знаки по разбору. Обычный формат доступен в теме № 5.</p>
 </section>;
}
export function PunctuationStats({state}:{state:State}) {
 const attempts=punctuationResults(state.pack,state.punctuationSessions);
 const independent=attempts.filter(a=>!a.answer.hintUsed);
 const correct=attempts.reduce((n,a)=>n+a.correctPositions,0),total=attempts.reduce((n,a)=>n+a.totalPositions,0);
 return <section className="card mode-stats" aria-label="Результаты расстановки знаков"><h2>Интерактивы: знаки препинания</h2>
  <p>Учебная проверка всех позиций учитывается отдельно от исходного задания на поиск тире.</p>
  <dl><div><dt>Проверено текстов</dt><dd>{attempts.length}</dd></div><div><dt>Позиции верны</dt><dd>{correct} / {total}</dd></div>
   <div><dt>Тексты без ошибок самостоятельно</dt><dd>{independent.filter(a=>a.correctPositions===a.totalPositions).length} / {independent.length}{independent.length>0&&independent.length<5?' · мало данных':''}</dd></div>
   <div><dt>С подсказкой или теорией</dt><dd>{attempts.length-independent.length}</dd></div></dl>
 </section>;
}
export default function PunctuationPage({state,run}:{state:State;run:Run}) {
 const exercises=punctuationExercises(state.pack),session=state.activePunctuation;
 const exercise=exercises.find(e=>e.id===session?.exerciseIds[session.position]);
 if(session&&exercise)return <PunctuationQuestion key={`${session.id}:${exercise.id}`} pack={state.pack} session={session} exercise={exercise} run={run}/>;
 const finished=state.punctuationSessions.filter(s=>s.status==='completed').at(-1);
 if(!finished||!exercises.length)return <div className="reading"><Link className="back" to="/workshop">← К мастерской</Link><h1>Расставим знаки</h1><PunctuationIntro state={state} run={run}/></div>;
 const results=punctuationResults(state.pack,[finished]);
 const correct=results.reduce((n,a)=>n+a.correctPositions,0),total=results.reduce((n,a)=>n+a.totalPositions,0);
 return <div className="reading"><Link className="back" to="/workshop">← К мастерской</Link><section className="card">
  <span className="badge lime">Серия завершена</span><h1 style={{marginTop:20}}>У каждого знака есть причина</h1>
  <p>Верно {correct} из {total} позиций. С помощью: {results.filter(a=>a.answer.hintUsed).length}.</p>
  <ul className="repetition-list">{results.map(a=>{
   const e=exercises.find(e=>e.id===a.exerciseId)!;
   return <li key={a.id}><h2>{e.title}</h2><p>{a.correctPositions} / {a.totalPositions} позиций верно</p>
    <details><summary>Разобрать позиции</summary><PositionFeedback exercise={e} draft={a.answer}/></details></li>;
  })}</ul><Link className="button" to="/progress">Мой прогресс <ArrowRight size={16}/></Link>
 </section></div>;
}
function PositionFeedback({exercise,draft}:{exercise:PunctuationExercise;draft:PunctuationDraft}) {
 return <ol className="punctuation-feedback-list">{checkPunctuation(exercise,draft).rows.map(row=><li key={row.id}>
  <strong className={row.correct?'correct-text':'wrong-text'}>{row.correct?'✓':'✕'} Позиция {row.id}</strong>
  <p>Твой ответ: {signLabel(row.chosen)}. Верно: {signLabel(row.sign)}.</p><p>{row.reason}</p>
 </li>)}</ol>;
}
function PunctuationQuestion({pack,session,exercise,run}:{pack:ContentPack;session:PunctuationSession;exercise:PunctuationExercise;run:Run}) {
 const navigate=useNavigate();
 const [draft,setDraft]=useState<PunctuationDraft>(session.drafts[exercise.id]??{signs:{},selected:exercise.positions[0].id,hintUsed:false});
 const [saving,setSaving]=useState(false),[busy,setBusy]=useState(false);
 const title=useRef<HTMLHeadingElement>(null),feedback=useRef<HTMLDivElement>(null);
 const slots=useRef(new Map<string,HTMLButtonElement>());
 const checked=session.results[exercise.id];
 const task=pack.tasks.find(t=>t.id===exercise.taskId)!;
 const topic=pack.topics.find(t=>task.topicIds.includes(t.id));
 useEffect(()=>{title.current?.focus();window.scrollTo(0,0);},[]);
 useEffect(()=>{if(checked)feedback.current?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});},[checked]);
 useEffect(()=>{
  if(!saving)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
  window.addEventListener('beforeunload',warn);return ()=>window.removeEventListener('beforeunload',warn);
 },[saving]);
 const update=async(change:Parameters<typeof store.savePunctuationDraft>[1])=>{
  if(saving||busy||checked)return;
  const previous=draft,signs={...draft.signs};
  if(change.position){if(change.sign===null)delete signs[change.position];else if(change.sign)signs[change.position]=change.sign;}
  setDraft({...draft,signs,selected:change.selected??draft.selected,hintUsed:draft.hintUsed||change.hintUsed===true});setSaving(true);
  const next=await run(store.savePunctuationDraft(exercise.id,change));if(!next)setDraft(previous);setSaving(false);return next;
 };
 const action=async()=>{if(saving||busy)return;setBusy(true);await run(checked?store.nextPunctuation():store.checkPunctuationCurrent());setBusy(false);};
 const filled=exercise.positions.filter(p=>draft.signs[p.id]!==undefined).length;
 const returnToText=()=>document.getElementById('punctuation-text')?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
 return <div className="reading punctuation-session">
  <div className="session-header"><Link className="back" to="/">← Выйти и сохранить</Link><span className="badge neutral">Знаки препинания</span></div>
  <div className="progress-line"><span style={{width:`${(session.position+1)/session.exerciseIds.length*100}%`}}/></div>
  <section className="card question-card"><h1 ref={title} tabIndex={-1}>Текст {session.position+1} из {session.exerciseIds.length}</h1><h2>{exercise.title}</h2>
   <p>Выбери позицию и поставь нужный знак кнопкой внизу. Если знак не нужен, выбери «Без знака». Можно переходить между позициями стрелками.</p>
   <div id="punctuation-text" className="punctuation-text" aria-label="Текст с позициями">{splitPunctuationText(punctuationText(task)).map((part,i)=><span key={i}>{part.text}{part.position&&<button
    ref={el=>{if(el)slots.current.set(part.position!,el);else slots.current.delete(part.position!);}}
    className={`punctuation-slot ${draft.selected===part.position?'selected':''} ${checked?(draft.signs[part.position]===exercise.positions.find(p=>p.id===part.position)?.sign?'correct-slot':'wrong-slot'):''}`}
    disabled={!!checked||saving||busy} aria-label={`Позиция ${part.position}, ${signLabel(draft.signs[part.position])}`} aria-pressed={draft.selected===part.position}
    onClick={()=>void update({selected:part.position})} onKeyDown={event=>{
     if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;event.preventDefault();
     const index=exercise.positions.findIndex(p=>p.id===part.position),next=exercise.positions[(index+(event.key==='ArrowRight'?1:-1)+exercise.positions.length)%exercise.positions.length].id;
     void update({selected:next}).then(saved=>{if(saved)window.requestAnimationFrame(()=>slots.current.get(next)?.focus());});
    }}><small>{part.position}</small><span>{draft.signs[part.position]===undefined?'?':draft.signs[part.position]==='none'?'∅':draft.signs[part.position]}</span></button>}</span>)}</div>
   {!checked&&<button className="text-link" disabled={saving||busy||draft.hintUsed} onClick={()=>void update({hintUsed:true})}><Lightbulb size={17}/> {draft.hintUsed?'Подсказка открыта':'Нужна подсказка'}</button>}
   {draft.hintUsed&&<p className="notice" role="note">{exercise.hint} Ответ отмечен как решение с помощью.</p>}
   {checked&&<div className="explanation" ref={feedback} role="status" aria-label="Результат расстановки знаков"><h2>Верно {checked.correctPositions} из {checked.totalPositions} позиций</h2>
    <PositionFeedback exercise={exercise} draft={checked.answer}/><p><small>Авторские пояснения по построчному разбору ключа пособия.</small></p>
    <button className="text-link" onClick={returnToText}>Вернуться к предложению ↑</button>
   </div>}
   <p className="source" style={{marginTop:24}}>Условие: стр. {task.source.pages.join(', ')} · разбор: {task.source.answerPages.join(', ')}. Учебный режим проверяет все позиции; исходное задание — только тире.</p>
   {topic?.theoryIds[0]&&<p><Link className="text-link" to={`/theory/${topic.theoryIds[0]}?topic=${topic.id}`} onClick={async event=>{
    event.preventDefault();if(saving||busy)return;const target=`/theory/${topic.theoryIds[0]}?topic=${topic.id}`;
    if(checked||draft.hintUsed){navigate(target);return;}const saved=await update({hintUsed:true});if(saved)navigate(target);
   }}>Правило по теме</Link><small style={{display:'block',marginTop:8}}>Теория до проверки отмечается как помощь.</small></p>}
   <Link className="text-link" to={`/topics/${task.topicIds[0]}`}>Обычная практика № 5</Link>
  </section>
  <div className="action-bar punctuation-bar">
   {!checked&&<div className="punctuation-tools"><small>Позиция {draft.selected} · {signLabel(draft.signs[draft.selected])}</small><div className="punctuation-signs" role="group" aria-label="Выбрать знак">
    {([',','—','none'] as PunctuationSign[]).map(sign=><button className="button secondary" key={sign} aria-label={`Поставить: ${signLabel(sign)}`} disabled={saving||busy} onClick={()=>void update({position:draft.selected,sign})}>{sign==='none'?'Без знака':sign}</button>)}
    <button className="button secondary" aria-label="Удалить знак" disabled={saving||busy||draft.signs[draft.selected]===undefined} onClick={()=>void update({position:draft.selected,sign:null})}><X size={18}/></button>
   </div></div>}
   <div className="punctuation-actions"><small role="status" aria-label="Сохранение знаков">{saving?'Сохраняем…':`Сохранено ${filled} из ${exercise.positions.length}`}</small>
    <button className="button" disabled={saving||busy||!checked&&filled!==exercise.positions.length} onClick={()=>void action()}>{checked?session.position+1===session.exerciseIds.length?'Завершить расстановку':'Следующий текст':'Проверить знаки'} {checked?<ArrowRight size={16}/>:<Check size={16}/>}</button>
   </div>
  </div>
 </div>;
}
