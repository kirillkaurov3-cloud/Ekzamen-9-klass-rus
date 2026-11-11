import { taskCount } from '../domain/format';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, Link, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BarChart3, BookOpen, Check, CheckCircle2, ChevronRight, CircleHelp, Clock3, Download, Home as HomeIcon, Layers, ListChecks, LoaderCircle, Monitor, Moon, Search, Settings as SettingsIcon, ShieldCheck, Smartphone, Sparkles, Sun, Target, Timer, Upload, X, XCircle, Zap } from 'lucide-react';
import type { Answer, Block, ContentPack, Mode, Session, State, Task } from '../domain/schema';
import { currentAttempts, empty, errorIds, remaining, selectTasks, stats } from '../domain/engine';
import * as store from '../storage/store';
import { config } from '../config';
import '../ui/styles.css';
import { useRegisterSW } from 'virtual:pwa-register/react';
type Run = (action: Promise<State>) => Promise<State | undefined>;
type Begin = (ids: string[], mode: Mode, count: number, minutes?: number) => void;
const resultLabels = { correct: 'Верно', wrong: 'Неверно', skipped: 'Пропущено', self: 'Самопроверка' };
let catalogPath = '/topics';
let catalogScroll = 0;
const navItems = [{ to: '/', label: 'Главная', icon: HomeIcon }, { to: '/topics', label: 'Темы', icon: Layers }, { to: '/errors', label: 'Ошибки', icon: ListChecks }, { to: '/progress', label: 'Прогресс', icon: BarChart3 }];
function Brand() { return <Link to="/" className="brand" aria-label={`${config.name}, главная`}><span className="brand-mark" aria-hidden="true">,</span>{config.name}</Link>; }
function Navigation({ errors }: {
    errors: number;
}) { return <>{navItems.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Icon size={20}/><span>{label}</span>{to === '/errors' && errors > 0 && <span className="nav-number">{errors}</span>}</NavLink>)}</>; }
function ButtonLink({ to, children, secondary = false }: {
    to: string;
    children: ReactNode;
    secondary?: boolean;
}) { return <Link className={`button ${secondary ? 'secondary' : ''}`} to={to}>{children}</Link>; }
function Blocks({ blocks, task, answer, onChange, disabled }: {
    blocks: Block[];
    task?: Task;
    answer?: Answer;
    onChange?: (answer: Answer) => void;
    disabled?: boolean;
}) {
    const text = (value: string) => task?.type === 'positions' && onChange ? value.split(/(\(\d+\))/g).map((part, i) => { const id = part.match(/^\((\d+)\)$/)?.[1]; return id && task.options.some(o => o.id === id) ? <button type="button" key={i} className="inline-position" aria-label={`Позиция ${id}`} aria-pressed={Array.isArray(answer) && answer.includes(id)} disabled={disabled} onClick={() => onChange(toggle(answer, id))}>{id}</button> : part; }) : value.split(/(\(\d+\))/g).map((part, i) => /^\(\d+\)$/.test(part) ? <strong className="sentence-number" key={i}>{part}</strong> : part);
    return <div className="blocks">{blocks.map((b, i) => b.type === 'paragraph' ? <p key={i}>{text(b.text)}</p> : b.type === 'heading' ? <h3 key={i}>{b.text}</h3> : b.type === 'emphasis' ? <p key={i}><strong>{b.text}</strong></p> : b.type === 'list' ? <ul key={i}>{b.items.map((item, j) => <li key={j}>{item}</li>)}</ul> : <div className="table-wrap" key={i} tabIndex={0} role="region" aria-label="Таблица, прокрутка по горизонтали"><table><thead><tr>{b.headers.map((h, j) => <th key={j}>{h}</th>)}</tr></thead><tbody>{b.rows.map((row, j) => <tr key={j}>{row.map((cell, k) => <td key={k}>{cell}</td>)}</tr>)}</tbody></table></div>)}</div>;
}
function toggle(answer: Answer | undefined, id: string): string[] { const selected = Array.isArray(answer) ? answer : []; return selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]; }
function answerText(answer: Answer | undefined, task: Task): string { if (empty(answer))
    return 'Нет ответа'; const label = (id: string) => task.options.find(x => x.id === id)?.text ?? id; if (Array.isArray(answer))
    return answer.map(label).join('; '); if (typeof answer === 'object')
    return task.pairs.map(p => `${p.text}: ${answer[p.id] ? label(answer[p.id]) : '—'}`).join('; '); return ['single', 'boolean'].includes(task.type) ? label(answer ?? '') : answer ?? ''; }
function Source({ source }: {
    source: Task['source'];
}) { return <div className="source">{source.title}{source.pages.length > 0 && <> · Условие: с. {source.pages.join(', ')}</>}{source.answerPages.length > 0 && <> · Ответ: с. {source.answerPages.join(', ')}</>}</div>; }
function PageTitle({ title, subtitle, extra }: {
    title: string;
    subtitle?: string;
    extra?: ReactNode;
}) { return <div className="page-heading"><div><h1>{title}</h1>{subtitle && <p className="intro">{subtitle}</p>}</div>{extra}</div>; }
function Empty({ title, children }: {
    title: string;
    children: ReactNode;
}) { return <div className="empty"><div className="card-icon"><Sparkles size={28}/></div><h2>{title}</h2>{children}</div>; }
function TopicCard({ topic, state }: {
    topic: ContentPack['topics'][number];
    state: State;
}) { const tasks = state.pack.tasks.filter(t => t.topicIds.includes(topic.id)); const solved = new Set(currentAttempts(state.pack, state.attempts).filter(a => a.result === 'correct' && tasks.some(t => t.id === a.taskId)).map(a => a.taskId)).size; return <Link to={`/topics/${topic.id}`} className="topic-card"><span className="topic-number">№ {topic.oge}</span><h3>{topic.title}</h3><div className="topic-meta"><span>{taskCount(tasks.length)}</span><span>{solved} решено</span></div><div className="progress-line"><span style={{ width: `${tasks.length ? solved / tasks.length * 100 : 0}%` }}/></div></Link>; }
function StatsCards({ state }: {
    state: State;
}) { const s = stats(state.pack, state.attempts); return <div className="stats-row"><div className="stat-card"><div className="stat-icon"><CheckCircle2 size={21}/></div><div><div className="stat-number">{s.solved}<small style={{ fontSize: 13, fontWeight: 500 }}> / {s.total}</small></div><div className="stat-label">Решено верно</div></div></div><div className="stat-card"><div className="stat-icon"><Target size={21}/></div><div><div className="stat-number">{s.checked ? `${s.accuracy}%` : '—'}</div><div className="stat-label">Точность ответов</div></div></div><div className="stat-card"><div className="stat-icon"><Zap size={21}/></div><div><div className="stat-number">{s.checked}</div><div className="stat-label">Проверено ответов</div></div></div></div>; }
function Home({ state }: {
    state: State;
}) { const errors = errorIds(state.pack, state.attempts).length; return <><PageTitle title="Всё получится." subtitle="Выбери тему или продолжи свою серию." extra={<span className="badge lime"><Sparkles size={13}/> В своём темпе</span>}/><section className="hero"><div className="hero-copy"><span className="badge lime">РУССКИЙ ЯЗЫК · 9 КЛАСС</span><h2>{state.active ? 'Продолжим с того же места' : 'Русский — на практике'}</h2><p>{state.active ? `${state.pack.topics.find(t => state.pack.tasks.find(x => x.id === state.active!.taskIds[state.active!.position])?.topicIds.includes(t.id))?.title ?? 'Тренировка'} · Вопрос ${state.active.position + 1} из ${state.active.taskIds.length}` : 'Выбери тему, реши задание и разберись в ответе.'}</p><Link to={state.active ? '/session' : '/topics'} className="button lime">{state.active ? 'Продолжить серию' : 'Начать тренировку'}<ArrowRight size={17}/></Link></div><div className="hero-art" aria-hidden="true"><div className="hero-orbit"/><div className="hero-orbit"/><div className="hero-orbit"/><div className="big-comma">,</div><span className="orbit-label">шаг за шагом</span><span className="orbit-label last">у тебя получится ✦</span></div></section><StatsCards state={state}/><p className="progress-note">В наборе {taskCount(state.pack.tasks.length)}. В прогрессе учитываются {state.pack.tasks.filter(t => t.type !== 'self').length} с проверяемым ответом; самопроверка исключена из точности и числа решённых.</p><div className="section-heading"><h2>Как потренируемся?</h2><span className="muted" style={{ fontSize: 12 }}>Выбирай свой ритм</span></div><div className="home-grid"><section className="card mode-card"><div className="card-icon"><Timer size={23}/></div><h3>Мини-вариант</h3><p>Разные темы, один таймер.<br />Проверь себя в режиме экзамена.</p><Link to="/mini" className="text-link">Выбрать вариант <ArrowRight size={16}/></Link></section><section className="card mode-card"><div className="card-icon green"><ListChecks size={23}/></div><h3>Работа над ошибками</h3><p>{errors ? `В очереди ${taskCount(errors)}. Закрепим то, что пока не получилось.` : 'Ошибаться — часть обучения. Здесь соберём то, что стоит повторить.'}</p><Link to="/errors" className="text-link">{errors ? 'Повторить задания' : 'К моим ошибкам'} <ArrowRight size={16}/></Link></section></div><div className="section-heading"><h2>Тема за темой</h2><Link to="/topics" className="text-link">Все темы <ArrowRight size={15}/></Link></div><div className="topics-grid">{state.pack.topics.slice(0, 3).map(t => <TopicCard key={t.id} topic={t} state={state}/>)}</div><div className="import-banner"><BookOpen size={24}/><div><h3>{state.pack.demo ? 'Сейчас открыт демонабор' : state.pack.title}</h3><p>{state.pack.demo ? 'Попробуй все режимы или загрузи свой учебный набор.' : `${taskCount(state.pack.tasks.length)} · Прогресс сохраняется на этом устройстве.`}</p></div><Link to="/settings" className="text-link">Загрузить набор <Upload size={15}/></Link></div></>; }
function NumberCatalog({ state, topics }: {state: State; topics: ContentPack['topics']}) {
    return <div className="number-catalog">{[...new Set(topics.map(t => t.oge))].map(n => {
        const group = topics.filter(t => t.oge === n);
        const tasks = state.pack.tasks.filter(t => t.oge === n && t.type !== 'self');
        const solved = new Set(currentAttempts(state.pack, state.attempts).filter(a => a.result === 'correct' && tasks.some(t => t.id === a.taskId)).map(a => a.taskId)).size;
        const label = <><span className="topic-number">№ {n}</span><span className="number-title">{group.length === 1 ? group[0].title : `${group[0].title} и другие темы (${group.length})`}</span><span className="number-progress">{solved}/{tasks.length}<span className="sr-only"> решено верно из проверяемых заданий</span></span><ChevronRight size={18}/></>;
        return group.length === 1 ? <Link className="number-row" key={n} to={`/topics/${group[0].id}`}>{label}</Link> : <details className="number-group" key={n}><summary className="number-row">{label}</summary><div className="number-children"><Link className="text-link" to={`/number/${n}`}>Тренировать весь номер <ArrowRight size={16}/></Link>{group.map(t => <TopicCard key={t.id} topic={t} state={state}/>)}</div></details>;
    })}</div>;
}
function Topics({ state }: {
    state: State;
}) { const [params, setParams] = useSearchParams(); useEffect(() => { catalogPath = `/topics${params.toString() ? '?' + params.toString() : ''}`; }, [params]); useEffect(() => () => { catalogScroll = window.scrollY; }, []); const search = params.get('q') ?? ''; const mode = params.get('view') ?? 'themes'; const numberQuery = search.trim().match(/^(?:№\s*|задание\s+)?(\d+)$/iu); const topics = state.pack.topics.filter(t => numberQuery ? t.oge === Number(numberQuery[1]) : t.title.toLocaleLowerCase('ru').includes(search.trim().toLocaleLowerCase('ru'))); const set = (key: string, value: string) => { const next = new URLSearchParams(params); next.set(key, value); setParams(next, { replace: true }); }; return <><PageTitle title="Тема за темой" subtitle="Выбери то, что хочешь разобрать сегодня."/><div className="filters"><div className="segmented"><button aria-pressed={mode === 'themes'} onClick={() => set('view', 'themes')}>По темам</button><button aria-pressed={mode === 'numbers'} onClick={() => set('view', 'numbers')}>По номерам</button></div><label className="search"><Search size={18}/><span className="sr-only">Поиск темы</span><input type="search" value={search} onChange={e => set('q', e.target.value)} placeholder="Найти тему или номер"/></label></div>{mode === 'themes' ? <div className="topics-grid">{topics.map(t => <TopicCard key={t.id} topic={t} state={state}/>)}</div> : <NumberCatalog state={state} topics={topics}/>}{!topics.length && <Empty title="Пока ничего не нашлось"><p>Попробуй другое название или номер задания.</p><button className="button secondary" onClick={() => set('q', '')}>Сбросить поиск</button></Empty>}</>; }
function Topic({ state, begin }: {
    state: State;
    begin: Begin;
}) { const { id, number } = useParams(); const topic = state.pack.topics.find(t => t.id === id); const tasks = state.pack.tasks.filter(t => number ? t.oge === Number(number) : t.topicIds.includes(id ?? '')); const theory = topic ? state.pack.theory.filter(t => topic.theoryIds.includes(t.id)) : state.pack.theory.filter(t => state.pack.topics.filter(x => x.oge === Number(number)).some(x => x.theoryIds.includes(t.id))); if (!topic && !number)
    return <Empty title="Тема не найдена"><ButtonLink to="/topics">К темам</ButtonLink></Empty>; return <div className="reading"><Link to={catalogPath} className="back"><ArrowLeft size={16}/> Все темы</Link><PageTitle title={topic?.title ?? `Задание № ${number}`} subtitle={topic?.description || 'Потренируйся и разберись с каждой задачей в своём темпе.'}/><div className="topic-summary"><span className="badge">ОГЭ № {topic?.oge ?? number}</span><span className="badge neutral">{taskCount(tasks.length)}</span><span className="badge neutral">{state.pack.demo ? 'Авторское демо' : 'Из учебного набора'}</span></div><div className="card"><h2>Небольшая серия — заметный шаг</h2><p className="muted" style={{ fontSize: 14 }}>Начнём с новых заданий. Ответы и разборы доступны сразу после проверки.</p><div className="series-options">{[...new Set([Math.min(5, tasks.length), Math.min(10, tasks.length)])].filter(Boolean).map(count => <button className="button" key={count} onClick={() => begin(tasks.map(t => t.id), 'practice', count)}>Тренироваться · {count} <ArrowRight size={16}/></button>)}</div></div><div className="section-heading"><h2>Сначала разобраться</h2><BookOpen size={21}/></div><div className="theory-list">{theory.map(t => <Link to={`/theory/${t.id}`} className="theory-row" key={t.id}><BookOpen size={18}/><span style={{ flex: 1 }}>{t.title}</span><ChevronRight size={17}/></Link>)}{!theory.length && <p className="muted">В этом наборе к теме пока не добавлено отдельное правило.</p>}</div>{state.pack.topics.filter(t => t.parentId === id).map(t => <TopicCard key={t.id} topic={t} state={state}/>)}{tasks[0] && <Source source={tasks[0].source}/>}</div>; }
function Theory({ state, begin }: {
    state: State;
    begin: Begin;
}) { const { id } = useParams(); const theory = state.pack.theory.find(t => t.id === id); const topic = state.pack.topics.find(t => t.theoryIds.includes(id ?? '')); if (!theory)
    return <Empty title="Правило не найдено"><ButtonLink to="/topics">К темам</ButtonLink></Empty>; return <div className="reading"><Link to={topic ? `/topics/${topic.id}` : '/topics'} className="back"><ArrowLeft size={16}/> К теме</Link><div className="eyebrow">Правило и примеры</div><h1>{theory.title}</h1><div className="card" style={{ marginTop: 24 }}><Blocks blocks={theory.blocks}/><Source source={theory.source}/></div>{topic && <div className="card" style={{ marginTop: 20 }}><h2>Закрепим на практике?</h2><p>Реши небольшую серию по теме «{topic.title}» и проверь себя.</p><button className="button" disabled={!state.pack.tasks.some(t => t.topicIds.includes(topic.id))} onClick={() => begin(state.pack.tasks.filter(t => t.topicIds.includes(topic.id)).map(t => t.id), 'practice', 5)}>Закрепить тему <ArrowRight size={16}/></button></div>}</div>; }
function Mini({ state, begin }: {
    state: State;
    begin: Begin;
}) { const tasks = state.pack.tasks.filter(t => t.timed && t.type !== 'self'); return <div className="reading"><PageTitle title="Мини-вариант" subtitle="Собери знания вместе. И проверь себя на время."/><div className="presets">{[[5, 10], [10, 20]].map(([count, minutes]) => { const selected = selectTasks(state.pack, state.attempts, tasks.map(t => t.id), count, true); const numbers = [...new Set(selected.map(id => tasks.find(t => t.id === id)?.oge))]; return <button key={count} className="preset" disabled={tasks.length < count} onClick={() => begin(selected, 'timed', count, minutes)}><div className="card-icon"><Timer size={23}/></div><strong>{taskCount(count)}</strong><span className="badge">{minutes} минут</span><p>{tasks.length < count ? `Доступно ${tasks.length}. Для этого варианта нужно ${count}.` : `Номера: ${numbers.join(', ')}.`}</p><span className="text-link">Начать <ArrowRight size={16}/></span></button>; })}</div><div className="card"><h2>Всё как на тренировке, но с таймером</h2><ul className="rules"><li>Отвечай в любом порядке и возвращайся к вопросам.</li><li>Проверка и разбор появятся после сдачи.</li><li>Таймер продолжает идти, даже если закрыть приложение.</li><li>Когда время закончится, сохраним твои ответы автоматически.</li></ul><p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>Результат — число верных ответов из заданий в сессии. Это учебный мини-вариант.</p></div></div>; }
function AnswerForm({ task, answer, setAnswer, disabled }: {
    task: Task;
    answer: Answer | undefined;
    setAnswer: (answer: Answer) => void;
    disabled: boolean;
}) {
    if (task.type === 'text' || task.type === 'self')
        return <><label className="field-label" htmlFor="answer">{task.type === 'self' ? 'Твой ответ или заметка' : 'Твой ответ'}</label>{task.type === 'self' ? <textarea id="answer" rows={4} className="answer-input" value={typeof answer === 'string' ? answer : ''} onChange={e => setAnswer(e.target.value)} disabled={disabled} placeholder="Запиши рассуждение…"/> : <input id="answer" className="answer-input" autoComplete="off" spellCheck={false} value={typeof answer === 'string' ? answer : ''} onChange={e => setAnswer(e.target.value)} disabled={disabled} placeholder="Слово или словосочетание"/>}<p className="answer-note">{task.type === 'self' ? 'Сравни ответ с образцом. Это задание не влияет на точность.' : task.policy.yo === 'strict' ? 'Сохраняй букву ё, дефисы и форму слова.' : 'Регистр букв не влияет на проверку.'}</p></>;
    if (task.type === 'matching') {
        const values = typeof answer === 'object' && !Array.isArray(answer) ? answer : {};
        return <div className="matching" style={{ marginTop: 24 }}>{task.pairs.map(pair => <label key={pair.id}><span>{pair.text}</span><select disabled={disabled} value={values[pair.id] ?? ''} onChange={e => setAnswer({ ...values, [pair.id]: e.target.value })}><option value="">Выбери соответствие</option>{task.options.map(option => <option key={option.id} value={option.id} disabled={!task.allowReuse && Object.entries(values).some(([key, value]) => key !== pair.id && value === option.id)}>{option.text}</option>)}</select></label>)}</div>;
    }
    const multi = task.type === 'multi' || task.type === 'positions';
    return <><p className="field-label">{task.type === 'positions' ? 'Выбери позиции в тексте или ниже' : multi ? 'Выбери все подходящие варианты' : 'Выбери один ответ'}</p><div className={task.type === 'positions' ? 'position-options' : 'answer-options'}>{task.options.map(o => { const selected = multi ? Array.isArray(answer) && answer.includes(o.id) : answer === o.id; if (!multi) return <label className="option radio-option" key={o.id}><input type="radio" name={`answer-${task.id}`} checked={selected} disabled={disabled} onChange={() => setAnswer(o.id)}/><span>{o.text}</span></label>; return <button key={o.id} className="option" aria-pressed={selected} disabled={disabled} onClick={() => setAnswer(multi ? toggle(answer, o.id) : o.id)}>{task.type !== 'positions' && <span className="option-index">{selected ? <Check size={16}/> : o.id}</span>}<span>{o.text}</span></button>; })}</div></>;
}
function Explanation({ task, answer, pack }: {
    task: Task;
    answer: Answer | undefined;
    pack: ContentPack;
}) { const topic = pack.topics.find(t => task.topicIds.includes(t.id)); return <div className="explanation"><div className="answer-summary"><span><strong>Твой ответ:</strong> {answerText(answer, task)}</span>{task.type !== 'self' && <span><strong>Верный ответ:</strong> {answerText(task.type === 'text' ? task.accepted.join(' / ') : task.key, task)}</span>}</div>{task.explanation.length ? <Blocks blocks={task.explanation}/> : <p>В пособии приведён ответ.</p>}{topic?.theoryIds[0] && <Link to={`/theory/${topic.theoryIds[0]}`} className="text-link"><BookOpen size={16}/> Посмотреть правило</Link>}<Source source={task.source}/></div>; }
function Question({ state, run, session, task }: {
    state: State;
    run: Run;
    session: Session;
    task: Task;
}) {
    const [answer, setAnswerLocal] = useState<Answer | undefined>(session.drafts[task.id]);
    const [expanded, setExpanded] = useState(false);
    useEffect(() => { if (expanded) window.requestAnimationFrame(() => document.querySelector('.explanation')?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})); }, [expanded]);
    const [busy, setBusy] = useState(false);
    const [confirm, setConfirm] = useState(false);
    const [saving, setSaving] = useState(0);
    const [saveFailed, setSaveFailed] = useState(false);
    useEffect(() => {
        if (!saving) return;
        const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [saving]);
    const navigate = useNavigate();
    const checked = session.results[task.id];
    const timed = session.mode === 'timed';
    const shared = state.pack.texts.find(t => t.id === task.textId);
    const topic = state.pack.topics.find(t => task.topicIds.includes(t.id));
    const titleRef = useRef<HTMLHeadingElement>(null);
    useEffect(() => { titleRef.current?.focus(); }, [task.id]);
    const setAnswer = (a: Answer) => { const previous = answer; setAnswerLocal(a); setSaving(n => n + 1); setSaveFailed(false); void run(store.saveDraft(task.id, a)).then(next => { if (!next) {
        setAnswerLocal(previous); setSaveFailed(true);
    } setSaving(n => n - 1); }); };
    const checkAnswer = async (skip = false) => { if (busy)
        return; setBusy(true); await run(store.checkCurrent(skip)); setBusy(false); };
    const finish = async () => { setBusy(true); const next = await run(store.finishSession()); setBusy(false); if (next)
        navigate(`/result/${session.id}`); };
    const next = async () => { if (session.position + 1 >= session.taskIds.length)
        await finish();
    else
        await run(store.setPosition(session.position + 1)); };
    return <><div className="card question-card"><div className="question-top"><span className="badge">ОГЭ № {task.oge}</span><small>{topic?.title}</small></div><h1 ref={titleRef} tabIndex={-1}>Задание {session.position + 1} из {session.taskIds.length}</h1>{shared && <section id="reading-text"><h2 style={{ fontSize: 17 }}>Прочитай текст</h2><Blocks blocks={shared.blocks}/><div className="divider"/></section>}<Blocks blocks={task.prompt} task={task} answer={answer} onChange={setAnswer} disabled={!!checked}/><AnswerForm task={task} answer={answer} setAnswer={setAnswer} disabled={!!checked}/>{shared && <a href="#reading-text" className="text-link" onClick={e => { e.preventDefault(); document.getElementById('reading-text')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }}>Вернуться к тексту ↑</a>}{checked && !timed && <div className={`feedback ${checked.result === 'correct' ? 'correct' : checked.result === 'wrong' ? '' : 'neutral'}`} role="status" aria-label="Результат ответа"><div className="feedback-title">{checked.result === 'correct' ? <CheckCircle2 size={21}/> : checked.result === 'wrong' ? <XCircle size={21}/> : <CircleHelp size={21}/>}{checked.result === 'correct' ? 'Верно! Так держать.' : checked.result === 'wrong' ? 'Пока неверно. Посмотри разбор.' : resultLabels[checked.result]}</div>{checked.incomplete && <p>Ответ не завершён.</p>}<button className="text-link" onClick={() => setExpanded(!expanded)}>{expanded ? 'Скрыть разбор' : task.type === 'self' ? 'Показать образец' : 'Показать разбор'} <ChevronRight size={16}/></button></div>}{checked && expanded && !timed && <Explanation task={task} answer={checked.answer} pack={state.pack}/>}</div>{timed && <div className="question-map" aria-label="Карта вопросов">{session.taskIds.map((id, i) => <button key={id} className={`map-button ${i === session.position ? 'current' : ''} ${!empty(session.drafts[id]) ? 'filled' : ''}`} aria-label={`Задание ${i + 1}${!empty(session.drafts[id]) ? ', заполнено' : ', пусто'}`} aria-current={i === session.position ? 'step' : undefined} onClick={() => void run(store.setPosition(i))}>{i + 1}</button>)}</div>}<div className="action-bar"><small aria-live="polite">{saving ? 'Сохраняем ответ…' : saveFailed ? 'Не удалось сохранить ответ' : answer !== undefined ? 'Ответ сохранён' : 'Выбери ответ'}</small>{timed ? <><button className="button secondary" onClick={() => setConfirm(true)} disabled={busy}>Сдать</button>{session.position + 1 < session.taskIds.length && <button className="button" onClick={() => void run(store.setPosition(session.position + 1))}>Дальше <ArrowRight size={16}/></button>}</> : checked ? <button className="button" disabled={busy} onClick={() => void next()}>{session.position + 1 === session.taskIds.length ? 'К результату' : 'Следующее'} <ArrowRight size={16}/></button> : <><button className="button ghost" disabled={busy} onClick={() => void checkAnswer(true)}>Пропустить</button><button className="button" disabled={busy || (task.type !== 'self' && empty(answer))} onClick={() => void checkAnswer()}>{task.type === 'self' ? 'Сверить с образцом' : 'Проверить'} <Check size={16}/></button></>}</div>{confirm && <Modal title="Сдать мини-вариант?" onClose={() => setConfirm(false)}><p>Без ответа: {session.taskIds.filter(id => empty(session.drafts[id])).length}. После сдачи изменить ответы уже нельзя.</p><div className="modal-actions"><button className="button" disabled={busy} onClick={() => void finish()}>Сдать и посмотреть результат</button><button className="button secondary" onClick={() => setConfirm(false)}>Ещё подумаю</button></div></Modal>}</>;
}
function SessionPage({ state, run }: {
    state: State;
    run: Run;
}) { const session = state.active; const [seconds, setSeconds] = useState(session?.endsAt ? remaining(session.endsAt) : 0); useEffect(() => { if (!session?.endsAt)
    return; const tick = () => setSeconds(remaining(session.endsAt!)); tick(); const timer = window.setInterval(tick, 1000); document.addEventListener('visibilitychange', tick); return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick); }; }, [session?.id, session?.endsAt]); if (!session)
    return <Empty title="Тренировка ждёт тебя"><p>Выбери тему и начни небольшую серию.</p><ButtonLink to="/topics">Выбрать тему</ButtonLink></Empty>; const task = state.pack.tasks.find(t => t.id === session.taskIds[session.position]); if (!task)
    return <Empty title="Задание недоступно"><ButtonLink to="/">На главную</ButtonLink></Empty>; return <div className="reading"><div className="session-header"><Link to="/" className="back"><ArrowLeft size={18}/> Выйти и сохранить</Link>{session.mode === 'timed' ? <span className="timer" aria-label={`Осталось ${Math.floor(seconds / 60)} минут ${seconds % 60} секунд`}><Clock3 size={18}/>{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</span> : <span className="badge neutral">{session.mode === 'review' ? 'Работа над ошибками' : 'Тренировка'}</span>}</div><div className="progress-line"><span style={{ width: `${(session.position + 1) / session.taskIds.length * 100}%` }}/></div><Question key={`${session.id}:${task.id}`} state={state} session={session} task={task} run={run}/></div>; }
function ResultPage({ state }: {
    state: State;
}) { const { id } = useParams(); const session = state.sessions.find(s => s.id === id); const [opened, setOpened] = useState<string | null>(null); if (!session || session.status !== 'completed')
    return <Empty title="Результат пока недоступен"><ButtonLink to="/">На главную</ButtonLink></Empty>; const attempts = Object.values(session.results); const correct = attempts.filter(a => a.result === 'correct').length; const wrong = attempts.filter(a => a.result === 'wrong').length; const skipped = attempts.filter(a => a.result === 'skipped').length; const self = attempts.filter(a => a.result === 'self').length; const total = session.taskIds.filter(id => state.pack.tasks.find(t => t.id === id)?.type !== 'self' && session.results[id]?.result !== 'self').length; const duration = Math.round(((session.finishedAt ?? session.startedAt) - session.startedAt) / 60000); return <div className="reading"><Link to="/" className="back"><ArrowLeft size={16}/> На главную</Link><div className="card results-hero"><div className="eyebrow">{session.mode === 'timed' ? 'Мини-вариант завершён' : 'Серия завершена'}</div><div className="score-circle"><strong>{total ? `${correct} / ${total}` : <CheckCircle2 size={40}/>}</strong><small>{total ? 'верных ответов' : 'самопроверка'}</small></div><h1>{wrong || skipped ? 'Ещё один шаг вперёд.' : 'Отличная работа!'}</h1><p className="muted">{wrong ? 'Разберись с ошибками — и попробуй ещё раз.' : 'Знания становятся увереннее с каждой тренировкой.'}</p><div className="topic-summary" style={{ justifyContent: 'center' }}><span className="badge neutral">Ошибки: {wrong}</span><span className="badge neutral">Пропуски: {skipped}</span>{self > 0 && <span className="badge neutral">Самопроверка: {self}</span>}<span className="badge neutral">{duration < 1 ? 'Меньше минуты' : `${duration} мин`}</span></div><div className="inline-actions" style={{ justifyContent: 'center' }}><ButtonLink to={wrong ? '/errors' : '/topics'}>{wrong ? 'Поработать над ошибками' : 'К темам'} <ArrowRight size={16}/></ButtonLink></div></div><div className="section-heading"><h2>Разбор по вопросам</h2></div><div className="card">{session.taskIds.map((taskId, i) => { const task = state.pack.tasks.find(t => t.id === taskId); const attempt = session.results[taskId]; return <div key={taskId}><button className="result-row" style={{ width: '100%', textAlign: 'left', border: 0, background: 'transparent', minHeight: 58 }} onClick={() => setOpened(opened === taskId ? null : taskId)}><span className="topic-number" style={{ margin: 0 }}>{i + 1}</span><span>№ {task?.oge ?? '—'} · {state.pack.topics.find(t => task?.topicIds.includes(t.id))?.title ?? 'Задание из прошлой редакции'}</span><span className={`result-state ${attempt?.result === 'correct' ? 'correct-text' : attempt?.result === 'wrong' ? 'wrong-text' : 'muted'}`}>{attempt ? resultLabels[attempt.result] : 'Пропущено'}{attempt?.incomplete && <><br />Ответ не завершён</>}</span><ChevronRight size={15}/></button>{opened === taskId && task && attempt && (task.version === attempt.taskVersion ? <>{task.textId && <Blocks blocks={state.pack.texts.find(t => t.id === task.textId)?.blocks ?? []}/>}<Blocks blocks={task.prompt}/><Explanation task={task} answer={attempt.answer} pack={state.pack}/></> : <p className="muted">Задание обновлено. Сохранённый результат относится к версии {attempt.taskVersion}.</p>)}</div>; })}</div></div>; }
function Errors({ state, begin }: {
    state: State;
    begin: Begin;
}) { const [filter, setFilter] = useState('all'); const ids = errorIds(state.pack, state.attempts); const tasks = state.pack.tasks.filter(t => ids.includes(t.id) && (filter === 'all' || t.oge === Number(filter))); return <><PageTitle title="Ошибки — это подсказки" subtitle="Вернись к сложному. После верного ответа задание уйдёт из очереди."/>{ids.length ? <><div className="filters"><label><span className="sr-only">Фильтр ошибок по номеру</span><select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Все номера · {ids.length}</option>{[...new Set(state.pack.tasks.filter(t => ids.includes(t.id)).map(t => t.oge))].map(n => <option key={n} value={n}>ОГЭ № {n}</option>)}</select></label><button className="button" disabled={!tasks.length} onClick={() => begin(tasks.map(t => t.id), 'review', tasks.length)}>Повторить {taskCount(tasks.length)} <ArrowRight size={16}/></button></div><div className="topics-grid">{state.pack.topics.filter(topic => tasks.some(t => t.topicIds.includes(topic.id))).map(topic => <div key={topic.id} className="topic-card"><span className="topic-number">№ {topic.oge}</span><h3>{topic.title}</h3><small>{tasks.filter(t => t.topicIds.includes(topic.id)).length} в очереди</small><button className="text-link" onClick={() => begin(tasks.filter(t => t.topicIds.includes(topic.id)).map(t => t.id), 'review', 10)}>Повторить <ArrowRight size={15}/></button></div>)}</div></> : <Empty title="Здесь пока чисто"><p>Когда появятся ошибки, соберём их здесь. Каждая новая попытка помогает разобраться.</p><ButtonLink to="/topics">К тренировке <ArrowRight size={16}/></ButtonLink></Empty>}</>; }
function Progress({ state }: {
    state: State;
}) { const attempts = currentAttempts(state.pack, state.attempts).filter(a => a.result === 'correct' || a.result === 'wrong'); const days = Array.from({ length: 7 }, (_, i) => { const date = new Date(); date.setDate(date.getDate() - 6 + i); const count = attempts.filter(a => new Date(a.checkedAt).toDateString() === date.toDateString()).length; return { date, count }; }); const max = Math.max(1, ...days.map(d => d.count)); const sessions = state.sessions.filter(s => s.mode === 'timed' && s.status === 'completed' && s.packId === state.pack.packId).slice().reverse(); return <><PageTitle title="Твой прогресс" subtitle="Каждая попытка имеет значение. Здесь только твои результаты."/><StatsCards state={state}/><p className="muted" style={{ fontSize: 12, marginTop: -15 }}>Решено верно — уникальные задания текущей редакции с хотя бы одним верным ответом. Точность — доля верных среди проверенных ответов, без пропусков и самопроверки.</p><div className="home-grid"><section className="card"><h2>Твоя неделя</h2><p className="muted" style={{ fontSize: 13 }}>Проверенные ответы за последние 7 дней</p><div className="chart" aria-label="Активность за неделю">{days.map(({ date, count }) => <div className="chart-day" key={date.toDateString()} aria-label={`${date.toLocaleDateString('ru-RU')}: ${count} ответов`}><span className="chart-value">{count}</span><div className="chart-bar" style={{ height: `${Math.max(3, count / max * 100)}px`, opacity: count ? 1 : .16 }}/><small>{date.toLocaleDateString('ru-RU', { weekday: 'short' })}</small></div>)}</div>{!attempts.length && <Link to="/topics" className="text-link">Начни с первого задания <ArrowRight size={15}/></Link>}</section><section className="card"><h2>По номерам ОГЭ</h2><div className="progress-by-number">{[...new Set(state.pack.tasks.map(t => t.oge))].map(n => { const tasks = state.pack.tasks.filter(t => t.oge === n && t.type !== 'self'); const solved = new Set(attempts.filter(a => a.result === 'correct' && tasks.some(t => t.id === a.taskId)).map(a => a.taskId)).size; return <div key={n}><span>№ {n}</span><div className="progress-line"><span style={{ width: `${tasks.length ? solved / tasks.length * 100 : 0}%` }}/></div><small>{solved} / {tasks.length}</small></div>; })}</div></section></div><div className="section-heading"><h2>История мини-вариантов</h2></div><div className="card">{sessions.length ? sessions.map(s => <Link to={`/result/${s.id}`} key={s.id} className="result-row"><Timer size={20}/><div><strong>{Object.values(s.results).filter(a => a.result === 'correct').length} из {s.taskIds.length}</strong><br /><small>{new Date(s.finishedAt ?? s.startedAt).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })}</small></div><ChevronRight size={18} style={{ marginLeft: 'auto' }}/></Link>) : <p className="muted" style={{ fontSize: 14, margin: 0 }}>Здесь появится первый завершённый мини-вариант. <Link to="/mini" className="text-link">Попробовать <ArrowRight size={15}/></Link></p>}</div></>; }
interface InstallEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{
        outcome: string;
    }>;
}
let pendingInstall: InstallEvent | null = null;
window.addEventListener('beforeinstallprompt', (event: Event) => { event.preventDefault(); pendingInstall = event as InstallEvent; window.dispatchEvent(new Event('install-ready')); });
window.addEventListener('appinstalled', () => { pendingInstall = null; });
function isStandalone() { return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & {
    standalone?: boolean;
}).standalone === true; }
function SettingsPage({ state, run, switchPack, returnToDemo }: {
    state: State;
    run: Run;
    switchPack: (pack: ContentPack) => void;
    returnToDemo: () => void;
}) { const [preview, setPreview] = useState<ContentPack | null>(null); const [error, setError] = useState(''); const [install, setInstall] = useState<InstallEvent | null>(pendingInstall); const [standalone, setStandalone] = useState(isStandalone()); useEffect(() => { const ready = () => setInstall(pendingInstall); const installed = () => { setStandalone(true); setInstall(null); }; window.addEventListener('install-ready', ready); window.addEventListener('appinstalled', installed); return () => { window.removeEventListener('install-ready', ready); window.removeEventListener('appinstalled', installed); }; }, []); const load = async (file?: File) => { setError(''); setPreview(null); if (!file)
    return; try {
    setPreview(await store.parsePackFile(file));
}
catch (e) {
    setError(e instanceof Error ? e.message : 'Не удалось прочитать файл');
} }; return <div className="reading"><PageTitle title="Настройки" subtitle="Пусть учиться будет удобно."/><div className="settings-grid"><section className="card"><h2>Оформление</h2><div className="theme-options">{([{ value: 'system', label: 'Как в системе', icon: Monitor }, { value: 'light', label: 'Светлая', icon: Sun }, { value: 'dark', label: 'Тёмная', icon: Moon }] as const).map(({ value, label, icon: Icon }) => <button key={value} className="button secondary" aria-pressed={state.theme === value} onClick={() => void run(store.setTheme(value))}><Icon size={17}/>{label}</button>)}</div></section><section className="card"><h2>Загрузить набор</h2><p>Выбери подготовленный файл <strong>pack.json</strong>. Он останется на твоём устройстве и будет доступен без интернета.</p><label className="field-label" htmlFor="pack-file">Файл учебного набора · до 20 МБ</label><input id="pack-file" className="file-input" type="file" accept="application/json,.json" onChange={e => void load(e.target.files?.[0])}/>{error && <div className="alert" role="alert">{error}</div>}{preview && <div className="file-preview"><h3>{preview.title}</h3><p>{taskCount(preview.tasks.length)} · {preview.topics.length} тем · версия {preview.packVersion}</p><button className="button" onClick={() => { switchPack(preview); setPreview(null); }}><Upload size={17}/> Загрузить этот набор</button></div>}<div className="divider"/><span className="badge">{state.pack.demo ? 'ДЕМОНАБОР' : 'ТЕКУЩИЙ НАБОР'}</span><h3 style={{ marginTop: 14 }}>{state.pack.title}</h3><p style={{ margin: 0 }}>{taskCount(state.pack.tasks.length)} · версия {state.pack.packVersion}</p><small>{state.pack.source.title}</small>{!state.pack.demo && <div><button className="text-link" onClick={returnToDemo}>Вернуться к демонабору</button></div>}</section>{!standalone && <section className="card"><div className="install-card"><div className="card-icon"><Smartphone size={23}/></div><div><h2 style={{ margin: 0 }}>Установить на телефон</h2><p>Тренируйся прямо с домашнего экрана.</p></div></div>{install && <button className="button" style={{ marginTop: 20 }} onClick={async () => { try {
    await install.prompt();
    await install.userChoice;
    pendingInstall = null;
    setInstall(null);
}
catch {
    setError('Установи приложение через меню браузера.');
} }}>Установить приложение <Download size={17}/></button>}<h3 style={{ marginTop: 22 }}>На iPhone</h3><p>Открой сайт в Safari → «Поделиться» → «На экран “Домой”». Если есть переключатель «Открыть как веб-приложение», включи его и нажми «Добавить».</p><h3>На Android и компьютере</h3><p style={{ margin: 0 }}>Открой меню браузера и выбери «Установить приложение» или «Добавить на главный экран». Сначала запусти приложение с интернетом, чтобы сохранить его для работы офлайн.</p></section>}<section className="card"><h2><ShieldCheck size={19} style={{ verticalAlign: '-3px', marginRight: 8 }}/> Всё остаётся у тебя</h2><p>Набор, ответы и прогресс хранятся в этом браузере. На другом устройстве будет отдельный профиль. Если очистить данные сайта, прогресс удалится.</p><p style={{ marginBottom: 0 }}>Демозадания созданы для этого проекта. Учебные наборы передаёт организатор, имеющий право делиться материалами.</p></section></div></div>; }
function Modal({ title, children, onClose }: {
    title: string;
    children: ReactNode;
    onClose: () => void;
}) { const ref = useRef<HTMLDivElement>(null); useEffect(() => { const previous = document.activeElement as HTMLElement | null; ref.current?.focus(); const keyboard = (event: KeyboardEvent) => { if (event.key === 'Escape')
    onClose(); if (event.key === 'Tab') {
    const items = ref.current?.querySelectorAll<HTMLElement>('button,a,input,select,textarea,[tabindex="0"]');
    if (!items?.length)
        return;
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
        event.preventDefault();
        last.focus();
    }
    else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
} }; document.addEventListener('keydown', keyboard); return () => { document.removeEventListener('keydown', keyboard); previous?.focus(); }; }, [onClose]); return <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabIndex={-1} ref={ref}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 15 }}><h2 id="modal-title">{title}</h2><button className="icon-button" aria-label="Закрыть" onClick={onClose}><X size={19}/></button></div>{children}</div></div>; }
function Shell() {
    const { needRefresh: [needRefresh], offlineReady: [offlineReady, setOfflineReady], updateServiceWorker } = useRegisterSW();
    const [state, setState] = useState<State | null>(null);
    const [error, setError] = useState('');
    const [pending, setPending] = useState<(() => Promise<State>) | null>(null);
    const [pendingTarget, setPendingTarget] = useState('/session');
    const navigate = useNavigate();
    const location = useLocation();
    const initial = useRef(false);
    useEffect(() => { if (initial.current)
        return; initial.current = true; void store.loadState().then(next => { setState(next); if (location.pathname === '/session' && !next.active) {
        const last = next.sessions.filter(s => s.status === 'completed').at(-1);
        if (last)
            navigate(`/result/${last.id}`);
    } }).catch(e => setError(e instanceof Error ? e.message : 'Не удалось открыть хранилище')); }, []);
    useEffect(() => { if (!state)
        return; const media = window.matchMedia('(prefers-color-scheme: dark)'); const apply = () => { document.documentElement.dataset.theme = state.theme === 'system' ? media.matches ? 'dark' : 'light' : state.theme; }; apply(); media.addEventListener('change', apply); return () => media.removeEventListener('change', apply); }, [state?.theme]);
    useEffect(() => { if (!location.pathname.startsWith('/session'))
        window.scrollTo(0, location.pathname === '/topics' ? catalogScroll : 0); }, [location.pathname]);
    const run: Run = useCallback(async (action) => { try {
        const next = await action;
        setState(next);
        setError('');
        return next;
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Не удалось сохранить изменения. Попробуй ещё раз.');
        return undefined;
    } }, []);
    useEffect(() => {
        if (!state?.active?.endsAt)
            return;
        const session = state.active;
        let finishing = false;
        const tick = () => {
            if (Date.now() < session.endsAt! || finishing)
                return;
            finishing = true;
            void run(store.finishSession()).then(next => {
                if (next) {
                    if (location.pathname === '/session')
                        navigate(`/result/${session.id}`);
                }
                else
                    finishing = false;
            });
        };
        tick();
        const interval = window.setInterval(tick, 1000);
        window.addEventListener('focus', tick);
        document.addEventListener('visibilitychange', tick);
        return () => { clearInterval(interval); window.removeEventListener('focus', tick); document.removeEventListener('visibilitychange', tick); };
    }, [state?.active?.id, state?.active?.endsAt, run, navigate, location.pathname]);
    const askOrRun = (action: () => Promise<State>, target: string) => { if (state?.active) {
        setPending(() => action);
        setPendingTarget(target);
    }
    else
        void run(action()).then(next => { if (next)
            navigate(target); }); };
    const begin: Begin = (ids, mode, count, minutes) => askOrRun(() => store.startSession(ids, mode, count, minutes), '/session');
    if (!state)
        return <main className="loading">{error ? <div className="card"><h1>Не удалось открыть приложение</h1><p role="alert">{error}</p><button className="button" onClick={() => window.location.reload()}>Попробовать снова</button></div> : <div><LoaderCircle size={24}/><p>Готовим задания…</p></div>}</main>;
    const errors = errorIds(state.pack, state.attempts).length;
    const inSession = location.pathname === '/session' && !!state.active;
    const heading = location.pathname.startsWith('/topics') ? 'Каталог тем' : location.pathname === '/settings' ? 'Настройки' : location.pathname === '/progress' ? 'Мой прогресс' : location.pathname === '/errors' ? 'Работа над ошибками' : location.pathname === '/mini' ? 'Мини-вариант' : 'Моя подготовка';
    return <div className={`app ${inSession ? 'session-active' : ''}`}><a className="sr-only" href="#main-content">Перейти к содержимому</a><aside className="sidebar"><Brand /><div className="sidebar-caption">Русский язык · ОГЭ</div><nav className="nav" aria-label="Основная навигация"><Navigation errors={errors}/></nav><div className="sidebar-bottom"><NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><SettingsIcon size={19}/>Настройки</NavLink><div className="local-note"><ShieldCheck size={15} style={{ verticalAlign: '-3px', marginRight: 6 }}/> Твой личный прогресс<br />на этом устройстве</div></div></aside><main className="main" id="main-content"><header className="topbar"><div className="breadcrumb">Подготовка к ОГЭ <ChevronRight size={13}/><span style={{ color: 'var(--text)' }}>{heading}</span></div><div className="mobile-logo"><Brand /></div><div className="top-actions"><span className="badge neutral"><span style={{ color: 'var(--green)' }}>●</span> {state.pack.demo ? 'Демонабор' : 'Локальный набор'}</span><Link to="/settings" className="icon-button" aria-label="Настройки"><SettingsIcon size={20}/></Link><div className="profile" aria-hidden="true">Я</div></div></header><div className="page">{needRefresh && !state.active && <div className="notice" role="status">Доступно обновление приложения. <button className="text-link" onClick={() => void updateServiceWorker(true)}>Обновить сейчас</button></div>}{offlineReady && <div className="notice" role="status">Приложение сохранено для работы без интернета. <button className="text-link" onClick={() => setOfflineReady(false)}>Понятно</button></div>}{error && <div className="alert" role="alert">{error}</div>}<Routes><Route path="/" element={<Home state={state}/>}/><Route path="/topics" element={<Topics state={state}/>}/><Route path="/topics/:id" element={<Topic state={state} begin={begin}/>}/><Route path="/number/:number" element={<Topic state={state} begin={begin}/>}/><Route path="/theory/:id" element={<Theory state={state} begin={begin}/>}/><Route path="/mini" element={<Mini state={state} begin={begin}/>}/><Route path="/session" element={<SessionPage state={state} run={run}/>}/><Route path="/result/:id" element={<ResultPage state={state}/>}/><Route path="/errors" element={<Errors state={state} begin={begin}/>}/><Route path="/progress" element={<Progress state={state}/>}/><Route path="/settings" element={<SettingsPage state={state} run={run} switchPack={pack => askOrRun(() => store.importPack(pack), '/')} returnToDemo={() => askOrRun(() => store.useDemo(), '/')}/>}/><Route path="*" element={<Empty title="Эта страница потерялась"><ButtonLink to="/">На главную</ButtonLink></Empty>}/></Routes></div></main>{!inSession && <nav className="mobile-nav" aria-label="Основные разделы"><Navigation errors={errors}/></nav>}{pending && <Modal title="У тебя есть незавершённая серия" onClose={() => setPending(null)}><p>Можно продолжить её или завершить и перейти дальше. Уже проверенные ответы сохранятся.</p><div className="modal-actions"><button className="button" onClick={() => { setPending(null); navigate('/session'); }}>Продолжить серию</button><button className="button secondary" onClick={async () => { const action = pending; const ended = await run(store.abandonSession()); if (!ended)
        return; const next = await run(action()); if (next) {
        setPending(null);
        navigate(pendingTarget);
    } }}>Завершить и перейти дальше</button><button className="button ghost" onClick={() => setPending(null)}>Отмена</button></div></Modal>}</div>;
}
export default function App() { return <Shell />; }
