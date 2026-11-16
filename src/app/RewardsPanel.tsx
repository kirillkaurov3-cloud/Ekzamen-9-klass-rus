import {useMemo} from 'react';
import {CheckCircle2,Sparkles} from 'lucide-react';
import type {State} from '../domain/schema';
import {rewards,DAILY_XP_LIMIT} from '../domain/rewards';
import {useLocalDay} from './RepetitionPage';
export default function RewardsPanel({state}:{state:State}) {
 const day=useLocalDay(),result=useMemo(()=>rewards(state,day),[state,day]);
 return <section className="card rewards-panel" aria-label="Опыт и достижения"><div className="section-heading"><div><span className="badge lime"><Sparkles size={14}/> {result.level.title}</span><h2 style={{marginTop:12}}>Опыт этого набора</h2></div><strong className="xp-number">{result.total} <small>XP</small></strong></div><p>Сегодня +{result.today} из {DAILY_XP_LIMIT} XP. Опыт сохраняется; пропущенные дни ничего не отнимают.</p>
 {result.next&&<><div className="progress-line" role="progressbar" aria-label="До следующего уровня" aria-valuemin={result.level.at} aria-valuemax={result.next.at} aria-valuenow={result.total}><span style={{width:`${(result.total-result.level.at)/(result.next.at-result.level.at)*100}%`}}/></div><p className="progress-note">До уровня «{result.next.title}» — {result.next.at-result.total} XP. Уровень не является оценкой готовности к экзамену.</p></>}
 <ul className="achievement-list">{result.achievements.map(a=><li key={a.id} className={a.earned?'earned':''}><CheckCircle2 aria-hidden="true" size={20}/><div><strong>{a.title}</strong><p>{a.earned?'✓ Получено. ':''}{a.description}</p></div></li>)}</ul>
 <details><summary>Как начисляется опыт</summary><p>Первое самостоятельное решение исходного задания — 10 XP; назначенное повторение — 5 XP. Первый самостоятельный ответ в учебной механике — 5 XP. Урок — 15 XP один раз в день, дневной план — 5 XP один раз в день. Карточка с самооценкой — 2 XP при первом знакомстве или повторении по сроку, одинаково за честное «не вспомнил» и «вспомнил».</p><p>Ответ с подсказкой не получает очков за самостоятельное решение. Повторный клик и свободное повторение уже освоенного примера не увеличивают опыт. Дневной предел — 100 XP. Это спокойная отметка практики, без рейтинга одноклассников.</p></details>
 </section>;
}
