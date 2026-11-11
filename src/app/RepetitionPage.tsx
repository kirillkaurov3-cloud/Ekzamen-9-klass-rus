import {useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowRight, RotateCcw} from 'lucide-react';
import type {Mode, State} from '../domain/schema';
import {taskCount} from '../domain/format';
import {dueRepetitions, localDay, repetitionPlan, repetitionSchedule} from '../domain/repetition';

export function useLocalDay() {
 const [day,setDay] = useState(localDay());
 useEffect(()=>{
  const refresh=()=>setDay(localDay());
  const timer=window.setInterval(refresh,30000);
  window.addEventListener('focus',refresh);
  document.addEventListener('visibilitychange',refresh);
  return ()=>{clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
 },[]);
 return day;
}
const dateLabel=(day:string)=>new Date(`${day}T12:00:00`).toLocaleDateString('ru-RU',{day:'numeric',month:'long'});

export function RepetitionCard({state}:{state:State}) {
 const day=useLocalDay();
 const schedule=repetitionSchedule(state.pack,state.attempts);
 const due=dueRepetitions(state.pack,state.attempts,day);
 return <section className="card repetition-card">
  <div><h2><RotateCcw size={20}/> Повторение по плану</h2>
   <p>{due.length ? `На сегодня ${taskCount(due.length)}. Начнём с ${Math.min(5,due.length)} — остальные останутся в очереди.` : schedule.length ? `Ближайшее повторение — ${dateLabel(schedule[0].dueDay)}.` : 'Реши первый вопрос: завтра он вернётся для закрепления.'}</p>
  </div>
  <Link className="text-link" to="/repeat">{due.length?'К повторению':'Посмотреть план'} <ArrowRight size={16}/></Link>
 </section>;
}

export default function RepetitionPage({state,begin}:{state:State;begin:(ids:string[],mode:Mode,count:number)=>void}) {
 const day=useLocalDay();
 const schedule=repetitionSchedule(state.pack,state.attempts);
 const due=dueRepetitions(state.pack,state.attempts,day);
 const ids=repetitionPlan(state.pack,state.attempts,day);
 return <div className="reading">
  <Link className="back" to="/">← На главную</Link>
  <div className="page-heading"><div><h1>Вспомнить и закрепить</h1><p className="muted">Короткая серия с проверкой ответа и разбором.</p></div></div>
  <section className="card">
   <span className="badge">1 → 3 → 7 → 14 дней</span>
   <h2 style={{marginTop:20}}>{due.length?'Пора вернуться к знакомому':'На сегодня всё'}</h2>
   <p data-testid="repetition-due">{due.length ? `В очереди ${taskCount(due.length)}. В этой серии — ${taskCount(ids.length)}.` : schedule.length ? `Следующее повторение — ${dateLabel(schedule[0].dueDay)}. Пока можно выбрать другую тему.` : 'После первого проверенного ответа здесь появится план повторения.'}</p>
   {state.active?.mode==='spaced'?<Link className="button" to="/session">Продолжить повторение <ArrowRight size={16}/></Link>:ids.length>0?<button className="button" onClick={()=>begin(ids,'spaced',ids.length)}>Повторить {taskCount(ids.length)} <ArrowRight size={16}/></button>:<Link className="button secondary" to="/topics">Выбрать тему</Link>}
   {due.length>5&&<p className="progress-note">Просроченные вопросы не пропадают. Чтобы не перегружать день, выдаём по пять за серию.</p>}
  </section>
  {schedule.length>0&&<section className="card" style={{marginTop:20}}><h2>Ближайшие вопросы</h2><ul className="repetition-list">{schedule.slice(0,10).map(card=>{
   const task=state.pack.tasks.find(t=>t.id===card.taskId)!;
   const topic=state.pack.topics.find(t=>task.topicIds.includes(t.id));
   return <li key={card.taskId}><Link to={`/topics/${task.topicIds[0]}`}><strong>№ {task.oge} · {topic?.title}</strong><small>{card.dueDay<=day?'Пора повторить':dateLabel(card.dueDay)} · интервал {([1,3,7,14])[card.step]} дн.</small></Link></li>;
  })}</ul>{schedule.length>10&&<p className="muted">Показаны ближайшие 10 из {schedule.length}.</p>}</section>}
  <details className="card repetition-rules" style={{marginTop:20}}><summary>Как устроен план</summary>
   <p>Первый проверенный ответ назначает вопрос на завтра. В назначенном повторении самостоятельный верный ответ увеличивает интервал: 3, 7, затем 14 дней. Дальше — каждые 14 дней.</p>
   <p>Ошибка возвращает интервал в один день. Досрочная свободная практика не удлиняет срок. Пропуски, самопроверка и устаревшие версии вопросов не меняют план. Самооценка не считается проверенным ответом.</p>
   <p>Сроки считаются по календарным дням устройства. Новый день проверяется при возвращении в приложение и каждые 30 секунд. Повторная проверка одного ответа не создаёт новую карточку. Всё сохраняется на устройстве и работает офлайн.</p>
  </details>
 </div>;
}
