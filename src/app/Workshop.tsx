import {useEffect,useRef,useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {ArrowRight,Check,Lightbulb} from 'lucide-react';
import type {ContentPack,State} from '../domain/schema';
import {letterExercises,learningResults,type LetterDraft,type LetterExercise,type LearningSession} from '../domain/interactive';
import * as store from '../storage/store';

type Run=(action:Promise<State>)=>Promise<State|undefined>;
export function InteractiveStats({state}:{state:State}) {
 const attempts=learningResults(state.pack,state.learningSessions);
 const independent=attempts.filter(a=>!a.answer.hintUsed);
 return <section className="card mode-stats" aria-label="Результаты интерактивов"><h2>Интерактивы: буква и правило</h2>
  <p>Это отдельные учебные примеры. Они не прибавляют решённые вопросы пособия и не меняют точность обычных заданий.</p>
  <dl><div><dt>Проверено примеров</dt><dd>{attempts.length}</dd></div>
   <div><dt>Буквы верны</dt><dd>{attempts.filter(a=>a.lettersCorrect).length} / {attempts.length}</dd></div>
   <div><dt>Правила верны</dt><dd>{attempts.filter(a=>a.ruleCorrect).length} / {attempts.length}</dd></div>
   <div><dt>Оба шага самостоятельно</dt><dd>{independent.filter(a=>a.lettersCorrect&&a.ruleCorrect).length} / {independent.length}{independent.length>0&&independent.length<5?' · мало данных':''}</dd></div>
   <div><dt>С подсказкой или теорией</dt><dd>{attempts.length-independent.length}</dd></div>
  </dl>
 </section>;
}
export function Workshop({state,run}:{state:State;run:Run}) {
 const navigate=useNavigate();
 const exercises=letterExercises(state.pack);
 return <div className="reading"><h1>Мастерская правил</h1><p className="muted">Объясни свой выбор на конкретном слове.</p>
  <section className="card"><span className="badge">ОГЭ № 7</span><h2 style={{marginTop:20}}>Буква и правило</h2>
   <p>Вставь букву, затем выбери объяснение. Пять примеров из таблицы разбора: корень или окончание, проверяемая гласная или словарное слово.</p>
   {exercises.length?<button className="button" onClick={()=>void run(store.startLetters()).then(next=>{if(next)navigate('/workshop/letters');})}>{state.activeLearning?'Продолжить интерактив':'Разобрать 5 примеров'} <ArrowRight size={16}/></button>:<><p>Примеры связаны с пособием. Открой его в библиотеке — после загрузки мастерская работает и без сети.</p><Link className="button" to="/library">Открыть пособие <ArrowRight size={16}/></Link></>}
   <p className="progress-note">Проверены пять строк задания 57: условие — страница 285, таблица ключа — 512. Пояснения и подсказки написаны для приложения по этой таблице.</p>
  </section>
  {exercises.length>0&&<InteractiveStats state={state}/>}
 </div>;
}
export function LettersPage({state,run}:{state:State;run:Run}) {
 const exercises=letterExercises(state.pack);
 const session=state.activeLearning;
 const exercise=exercises.find(e=>e.id===session?.exerciseIds[session.position]);
 if(session&&exercise)return <LetterQuestion key={`${session.id}:${exercise.id}`} pack={state.pack} session={session} exercise={exercise} run={run}/>;
 const finished=state.learningSessions.filter(s=>s.status==='completed').at(-1);
 if(!exercises.length||!finished)return <Workshop state={state} run={run}/>;
 const results=learningResults(state.pack,[finished]);
 return <div className="reading"><Link className="back" to="/workshop">← К мастерской</Link><section className="card">
  <span className="badge lime">Серия завершена</span><h1 style={{marginTop:20}}>Буква — и причина</h1>
  <p>Буквы: {results.filter(a=>a.lettersCorrect).length} из {results.length}. Правила: {results.filter(a=>a.ruleCorrect).length} из {results.length}.</p>
  <p>С помощью: {results.filter(a=>a.answer.hintUsed).length}. В статистике самостоятельные ответы учитываются отдельно.</p>
  <ul className="repetition-list">{results.map(result=>{
   const ex=exercises.find(e=>e.id===result.exerciseId)!;
   return <li key={result.id}><strong>{ex.before}{ex.letter}{ex.after}</strong><p>{result.lettersCorrect?'✓ Буква верна':'✕ Ошибка в букве'} · {result.ruleCorrect?'✓ Правило верно':'✕ Ошибка в правиле'}</p><p>{ex.explanation}</p></li>;
  })}</ul>
  <Link className="button" to="/progress">Мой прогресс <ArrowRight size={16}/></Link>
 </section></div>;
}

function LetterQuestion({pack,session,exercise,run}:{pack:ContentPack;session:LearningSession;exercise:LetterExercise;run:Run}) {
 const navigate=useNavigate();
 const [draft,setDraft]=useState<LetterDraft>(session.drafts[exercise.id]??{letter:'',rule:'',hintUsed:false});
 const [saving,setSaving]=useState(false);
 const [busy,setBusy]=useState(false);
 const checked=session.results[exercise.id];
 const title=useRef<HTMLHeadingElement>(null);
 const feedback=useRef<HTMLDivElement>(null);
 useEffect(()=>{title.current?.focus();window.scrollTo(0,0);},[]);
 useEffect(()=>{if(checked)feedback.current?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});},[checked]);
 useEffect(()=>{
  if(!saving)return;
  const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
  window.addEventListener('beforeunload',warn);return ()=>window.removeEventListener('beforeunload',warn);
 },[saving]);
 const update=async(change:Partial<LetterDraft>)=>{
  if(saving||busy||checked)return;
  const previous=draft;setDraft({...draft,...change});setSaving(true);
  const next=await run(store.saveLetterDraft(exercise.id,change));if(!next)setDraft(previous);setSaving(false);return next;
 };
 const action=async(next:boolean)=>{if(busy||saving)return;setBusy(true);await run(next?store.nextLetter():store.checkLetterCurrent());setBusy(false);};
 const task=pack.tasks.find(t=>t.id===exercise.taskId)!;
 const topic=pack.topics.find(t=>task.topicIds.includes(t.id));
 return <div className="reading letter-session">
  <div className="session-header"><Link className="back" to="/">← Выйти и сохранить</Link><span className="badge neutral">Буква и правило</span></div>
  <div className="progress-line"><span style={{width:`${(session.position+1)/session.exerciseIds.length*100}%`}}/></div>
  <section className="card question-card">
   <h1 ref={title} tabIndex={-1}>Пример {session.position+1} из {session.exerciseIds.length}</h1>
   <p>Вставь букву в слове из текста. Затем объясни, почему она здесь нужна.</p>
   <label className="letter-word"><span className="sr-only">Буква в слове {exercise.before}…{exercise.after}</span><span>{exercise.before}</span><select aria-label="Пропущенная буква" value={draft.letter} disabled={!!checked||saving||busy} onChange={e=>void update({letter:e.target.value})}><option value="">…</option><option value="е">е</option><option value="и">и</option></select><span>{exercise.after}</span></label>
   <fieldset className="answer-fieldset"><legend>Какое правило объясняет написание?</legend><div className="options">{exercise.choices.map(choice=><label className="option radio-option" key={choice.id}><input type="radio" name={`rule-${exercise.id}`} value={choice.id} checked={draft.rule===choice.id} disabled={!!checked||saving||busy} onChange={()=>void update({rule:choice.id})}/><span>{choice.text}</span></label>)}</div></fieldset>
   {!checked&&<button className="text-link" disabled={saving||busy||draft.hintUsed} onClick={()=>void update({hintUsed:true})}><Lightbulb size={17}/> {draft.hintUsed?'Подсказка открыта':'Нужна подсказка'}</button>}
   {draft.hintUsed&&<p className="notice" role="note">{exercise.hint} Этот ответ будет отмечен как решение с помощью.</p>}
   {checked&&<div ref={feedback} className="explanation letter-feedback" role="status" aria-label="Результат интерактива">
    <h2>Проверим оба шага</h2>
    <p className={checked.lettersCorrect?'correct-text':'wrong-text'}>{checked.lettersCorrect?'✓ Буква верна':'✕ Ошибка в букве'}. Твой ответ: {checked.answer.letter.toLocaleUpperCase('ru')}. Верно: {exercise.letter.toLocaleUpperCase('ru')}.</p>
    <p className={checked.ruleCorrect?'correct-text':'wrong-text'}>{checked.ruleCorrect?'✓ Правило верно':'✕ Ошибка в правиле'}.</p>
    <p><strong>Твоё объяснение:</strong> {exercise.choices.find(c=>c.id===checked.answer.rule)?.text}</p>
    <p><strong>Верное объяснение:</strong> {exercise.choices.find(c=>c.id===exercise.rule)?.text}</p>
    <p>{exercise.explanation}</p><small>Авторский разбор по таблице ключа, страница 512.</small>
   </div>}
   <details className="source-context"><summary>Показать исходный текст и страницы</summary>{task.prompt.map((block,i)=>'text' in block?<p key={i}>{block.text}</p>:null)}<p>Разбираем пропуск ({exercise.position}). Задание 57 · условие: стр. 285 · ключ: стр. 512.</p><Link className="text-link" to={`/topics/${task.topicIds[0]}`}>Обычная практика № 7</Link></details>
   {topic?.theoryIds[0]&&<p style={{marginTop:20}}><Link className="text-link" to={`/theory/${topic.theoryIds[0]}?topic=${topic.id}`} onClick={async event=>{
    event.preventDefault();if(saving||busy)return;
    const target=`/theory/${topic.theoryIds[0]}?topic=${topic.id}`;
    if(checked||draft.hintUsed){navigate(target);return;}
    const saved=await update({hintUsed:true});if(saved)navigate(target);
   }}>Правило по теме</Link><small style={{display:'block',marginTop:8}}>Открытие теории до проверки отмечается как помощь.</small></p>}
  </section>
  <div className="action-bar"><small role="status" aria-label="Сохранение интерактива">{saving?'Сохраняем…':'Черновик сохранён'}</small><button className="button" disabled={busy||saving||!checked&&(!draft.letter||!draft.rule)} onClick={()=>void action(!!checked)}>{checked?session.position+1===session.exerciseIds.length?'Завершить интерактив':'Следующий пример':'Проверить'} {checked?<ArrowRight size={16}/>:<Check size={16}/>}</button></div>
 </div>;
}
