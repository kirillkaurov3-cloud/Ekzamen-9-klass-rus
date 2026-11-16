import {Link,useNavigate} from 'react-router-dom';
import {ArrowRight} from 'lucide-react';
import type {State} from '../domain/schema';
import {studyActivities,studyPlan,studyCardSchedule,validStudySession,STUDY_LABELS,type StudyMode} from '../domain/study';
import {LESSON_TITLES} from '../content/studyLessons';
import {plural} from '../domain/format';
import {useLocalDay} from './RepetitionPage';
import type {StudyRun} from './StudyPage';
import * as store from '../storage/store';

export const LEARNING_MODES:StudyMode[]=['grammar','reason','lesson','cards'];
const activeFor=(state:State,mode:StudyMode)=>state.studySessions.find(s=>s.mode===mode&&s.status==='active'&&validStudySession(state.pack,s));
export function StudyHubs({state,run}:{state:State;run:StudyRun}) {
 const navigate=useNavigate(),day=useLocalDay();
 const descriptions:Record<StudyMode,string>={grammar:'Выдели слова выбранным инструментом. Найди подлежащие, сказуемые или единственный главный член.',reason:'Исправь ошибочное объяснение, затем выбери пример, который подтверждает правило.',lesson:'Короткие серии: правило, разобранный пример, шаг с подсказкой и два самостоятельных задания.',cards:'Вспомни основу или объясни правило. Проверяемые ответы и самооценка учитываются отдельно.',daily:'Повторение по сроку, короткий урок и самостоятельная практика.'};
 return <>{LEARNING_MODES.map(mode=>{
  const plan=studyPlan(state.pack,mode,state.studySessions,state.attempts,day),active=activeFor(state,mode),available=studyActivities(state.pack).some(a=>a.mode===mode);
  return <section className="card study-intro" key={mode}><span className="badge">{mode==='reason'?'ОГЭ № 6':'ОГЭ № 2'}</span><h2 style={{marginTop:20}}>{STUDY_LABELS[mode]}</h2><p>{descriptions[mode]}</p>
   {available?<>{mode==='lesson'?<Link className="button" to={active?'/workshop/lesson':'/workshop/lesson?list=1'}>{active?'Продолжить урок':'Выбрать урок'} <ArrowRight size={16}/></Link>:plan.length||active?<><p>{active?active.plan.length:plan.length} {plural(active?active.plan.length:plan.length,'шаг','шага','шагов')} в серии.</p><button className="button" onClick={()=>void run(store.startStudy(mode)).then(next=>{if(next)navigate(`/workshop/${mode}`);})}>{active?'Продолжить':mode==='grammar'?'Выделить основу':mode==='reason'?'Исправить рассуждение':'Повторить карточки'} <ArrowRight size={16}/></button></>:<><p>На сегодня карточки закончились.</p><Link className="text-link" to="/workshop/cards">Посмотреть расписание</Link></>}</>:<><p className="muted">Открой обновлённое пособие, чтобы начать этот режим.</p><Link className="text-link" to="/library">К библиотеке</Link></>}
  </section>;
 })}</>;
}
export function LessonHub({state,run}:{state:State;run:StudyRun}) {
 const navigate=useNavigate(),active=activeFor(state,'lesson');
 const ids=[...new Set(studyActivities(state.pack).filter(a=>a.mode==='lesson').map(a=>a.lessonId).filter((id):id is string=>!!id))];
 return <div className="reading"><Link className="back" to="/workshop">← К мастерской</Link><h1>Короткие уроки</h1><p>Сначала разберём пример вместе, затем попробуешь самостоятельно. Подсказки отмечаются в результате.</p><div className="lesson-hub">{ids.map(id=>{
  const completed=state.studySessions.some(s=>s.lessonId===id&&s.status==='completed'&&validStudySession(state.pack,s));
  return <section className="card" key={id}><span className="badge neutral">{completed?'✓ Пройден':'5 шагов'}</span><h2 style={{marginTop:16}}>{LESSON_TITLES[Number(id.split('.').at(-1))-1]}</h2><button className="button" disabled={!!active&&active.lessonId!==id} onClick={()=>void run(store.startStudy('lesson',id)).then(next=>{if(next)navigate('/workshop/lesson');})}>{active?.lessonId===id?'Продолжить урок':completed?'Пройти ещё раз':'Начать урок'} <ArrowRight size={16}/></button></section>;
 })}</div>{active&&<p className="progress-note">Сначала заверши начатый урок. Его состав и ответы сохранены.</p>}{!ids.length&&<Link className="button" to="/library">Открыть пособие</Link>}</div>;
}
export function CardOverview({state,run}:{state:State;run:StudyRun}) {
 const day=useLocalDay(),navigate=useNavigate(),plan=studyPlan(state.pack,'cards',state.studySessions,state.attempts,day),schedule=studyCardSchedule(state.pack,state.studySessions);
 const available=studyActivities(state.pack).filter(a=>a.mode==='cards');
 return <section className="card card-overview"><h2>Карточки и повторение</h2><p>{available.length?`В наборе ${available.length} ${plural(available.length,'карточка','карточки','карточек')}; в следующей серии ${plan.length}.`:'Карточки появятся после открытия обновлённого пособия.'}</p>
  {plan.length>0?<button className="button" onClick={()=>void run(store.startStudy('cards')).then(next=>{if(next)navigate('/workshop/cards');})}>Начать серию карточек <ArrowRight size={16}/></button>:available.length?<p>На сегодня всё. Можно выбрать свободную практику.</p>:<Link className="button" to="/library">Открыть пособие</Link>}
  <p className="progress-note">После самостоятельного успеха интервалы — 1, 3, 7, 14 дней. Ошибка, частичное воспоминание или помощь возвращают один день. Самооценка влияет только на свой график и не входит в объективную точность. Повторные нажатия не создают вторую карточку.</p>
  {schedule.length>0&&<ul className="repetition-list">{schedule.map(card=><li key={card.id}><p>{card.self?'Объясни правило':'Вспомни основу'} · {card.self?'самооценка':'проверяемый ответ'}</p><small>{card.due<=day?'Пора повторить':new Date(card.due+'T12:00:00').toLocaleDateString('ru-RU')}</small></li>)}</ul>}
 </section>;
}

export function DailyHub({state,run}:{state:State;run:StudyRun}) {
 const day=useLocalDay(),navigate=useNavigate(),plan=studyPlan(state.pack,'daily',state.studySessions,state.attempts,day);
 const finished=state.studySessions.find(s=>s.mode==='daily'&&s.day===day&&s.status==='completed'&&validStudySession(state.pack,s));
 const repeats=plan.filter(a=>a.canonicalMode==='spaced'||a.mode==='cards').length;
 const lesson=plan.filter(a=>a.mode==='lesson').length;
 const results=finished?Object.values(finished.results).filter(a=>a.correct!==null):[];
 return <div className="reading"><Link className="back" to="/">← На главную</Link><h1>Тренировка на сегодня</h1><section className="card daily-overview"><span className="badge lime">{finished?'✓ План выполнен':'10–15 минут · в своём темпе'}</span><h2 style={{marginTop:20}}>{finished?'Сегодня уже получилось':'Понятный план на один подход'}</h2>
 {finished?<><p>Проверено {results.length}. Верно: {results.filter(a=>a.correct).length}. Самостоятельно: {results.filter(a=>a.independent&&a.correct).length} из {results.filter(a=>a.independent).length}.</p><p>Следующий дневной план появится завтра. Можно выбрать тему самостоятельно или отдохнуть.</p><Link className="button" to="/topics">Свободная практика <ArrowRight size={16}/></Link></>:plan.length?<><ol className="daily-steps"><li><strong>Вспомнить</strong><p>{repeats?`${repeats} повторений по календарному сроку — начнём с того, что пора закрепить.`:'Просроченных повторений пока нет. Начнём с короткого разбора.'}</p></li><li><strong>Разобраться</strong><p>{lesson?'Пять шагов урока: правило, пример, помощь и самостоятельное решение.':'Короткое правило и конкретный разобранный пример.'}</p></li><li><strong>Попробовать самому</strong><p>Два исходных задания. Их результаты попадут в обычный прогресс и очередь ошибок.</p></li></ol><p className="progress-note">Это ориентир по времени, таймер не ограничивает. Состав закрепится при старте; можно выйти и продолжить завтра. Карточки с самооценкой не повышают объективную точность.</p><button className="button" onClick={()=>void run(store.startStudy('daily')).then(next=>{if(next)navigate('/workshop/daily');})}>Начать дневной план <ArrowRight size={16}/></button></>:<><p>Для дневного плана нужны задания с проверяемым ответом.</p><Link className="button" to="/library">Открыть пособие</Link></>}
 </section><p><Link className="text-link" to="/workshop">Другие учебные режимы</Link></p></div>;
}
