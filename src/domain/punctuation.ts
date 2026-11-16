import type {ContentPack,Task} from './schema';

export type PunctuationSign=','|'—'|'none';
export interface PunctuationPosition {id:string;sign:PunctuationSign;reason:string}
export interface PunctuationExercise {
 id:string;version:number;taskId:string;taskVersion:number;title:string;hint:string;positions:PunctuationPosition[];
}
export interface PunctuationDraft {signs:Record<string,PunctuationSign>;hintUsed:boolean;selected:string}
export interface PunctuationAttempt {
 id:string;exerciseId:string;exerciseVersion:number;taskId:string;taskVersion:number;
 answer:PunctuationDraft;correctPositions:number;totalPositions:number;checkedAt:number;localDay:string;
}
export interface PunctuationSession {
 id:string;packId:string;exerciseIds:string[];exerciseVersions:Record<string,number>;position:number;
 drafts:Record<string,PunctuationDraft>;results:Record<string,PunctuationAttempt>;
 status:'active'|'completed';startedAt:number;lastOpenedAt:number;finishedAt?:number;
}
const position=(n:number,sign:PunctuationSign,reason:string):PunctuationPosition=>({id:String(n),sign,reason});
const exercise=(n:number,title:string,hint:string,positions:PunctuationPosition[]):PunctuationExercise=>({id:`punctuation.q${n}`,version:1,taskId:`rustutors-2026-2027-oge5-topic1-q${n}`,taskVersion:1,title,hint,positions});
/** Manually matched to conditions p.172–173 and every position in keys p.440–441. */
export const PUNCTUATION_EXERCISES:PunctuationExercise[]=[
 exercise(1,'Колокольня Ивана Великого','Сначала найди основу каждого предложения. Затем отдели обороты с зависимыми словами.',[
  position(1,'—','«Колокольня Ивана Великого — это церковь»: между подлежащим и именной частью сказуемого перед «это» ставится тире.'),
  position(2,',','«Расположенная на Соборной площади…» — причастный оборот после определяемого слова «церковь», поэтому он обособляется.'),
  position(3,'—','«Время её возведения — 1500–1508 годы»: тире разделяет подлежащее и именное сказуемое.'),
  position(4,',','Перед союзом «а» разделяем части сложносочинённого предложения: «время — годы», «архитектор занимался».'),
  position(5,'none','«Проектом её создания занимался архитектор»: дополнение «проектом» связано со сказуемым, разделять их знаком не нужно.'),
  position(6,',','Причастный оборот «спроектировавший столп колокольни…» стоит после определяемого имени «Бон Фрязин» и обособляется.'),
  position(7,',','Перед присоединительным союзом «а также» ставится запятая между однородными дополнениями.'),
  position(8,'none','«Успенскую звонницу и Филаретову пристройку» — два однородных дополнения с одиночным союзом «и», запятой нет.')
 ]),
 exercise(2,'Долина гейзеров','После перечисления найди слово, которое объединяет все названные предметы.',[
  position(1,'—','«Долина гейзеров — природная достопримечательность»: подлежащее и именное сказуемое выражены существительными.'),
  position(2,',','Причастный оборот «расположенная в Кроноцком биосферном заповеднике» стоит после слова «достопримечательность» и обособляется.'),
  position(3,',','«Термальные источники, грязевые котлы…» — однородные члены перечисления без союза.'),
  position(4,',','«Грязевые котлы, водопады и озёра» — продолжается перечисление однородных членов.'),
  position(5,'—','После перечисления перед обобщающим «всё это» ставится тире.'),
  position(6,',','Слово «где» присоединяет придаточную часть «где наблюдаются…»; перед ней нужна запятая.'),
  position(7,',','Оборот «вмещающие в себя ландшафты…» относится к слову «условия» и стоит после него, поэтому обособляется.'),
  position(8,'—','«Основа … панорам — пышущие гейзеры»: тире между подлежащим и именным сказуемым.'),
  position(9,',','После слова «гейзеры» обособляется причастный оборот «бурлящие и взрывающиеся…».')
 ]),
 exercise(3,'Изделия из берёсты','Отличи значение «в качестве» от сравнения. Найди перечисление и обобщающее слово после него.',[
  position(1,'—','«Художественные изделия из берёсты — оригинальный вид народного творчества»: между подлежащим и именным сказуемым ставится тире.'),
  position(2,',','Союз «что» открывает придаточную часть: «тем, что … она сохраняла…». Нужна запятая между частями СПП.'),
  position(3,'none','«Как материал» имеет значение «в качестве материала», а не сравнения. Обособление здесь не требуется.'),
  position(4,',','«Кузовки, короба…» — перечисление однородных членов без союза.'),
  position(5,',','«Короба для муки и мёда, лукошки…» — разделяем соседние группы однородных членов.'),
  position(6,',','«Лукошки и пастушечьи рожки, канаты…» — граница между группами перечисления; внутри первой группы одиночное «и».'),
  position(7,'—','После перечисления перед обобщающим сочетанием «всё это» ставится тире.'),
  position(8,'none','«Использовали в качестве изолятора»: сочетание входит в состав сообщения о назначении материала, знак здесь не нужен.'),
  position(9,'none','Подлежащее «берёста» и сказуемое «предохраняла» не разделяются запятой или тире.')
 ]),
 exercise(4,'Домик Петра I','В части с «которая» проверь, не соединяет ли «и» два сказуемых одного подлежащего.',[
  position(1,'—','«Домик Петра I — единственная постройка»: между подлежащим и именным сказуемым нужно тире.'),
  position(2,',','После слова «постройка» обособляется причастный оборот «сохранившаяся с первых дней…».'),
  position(3,',','«Которая была сооружена…» — придаточная определительная часть, перед ней нужна запятая.'),
  position(4,'none','«Которая была сооружена … и служила»: союз «и» соединяет однородные сказуемые одной придаточной части, запятая не нужна.'),
  position(5,',','«Табакерка, самшитовая курительная трубка…» — однородные члены перечисляются без союза.'),
  position(6,',','«Трубка, чертежи и деловые бумаги» — продолжается перечисление.'),
  position(7,'—','После перечисления перед обобщающим словом «вещи» ставится тире.'),
  position(8,',','«Принадлежавшие Петру I» — причастный оборот после определяемого слова «вещи», его нужно обособить.')
 ]),
 exercise(5,'Ботанический сад','Проверь перечисления, обобщающее «всё это» и союз «не только … но и».',[
  position(1,'—','«Ботанический сад — один из … уголков»: тире между подлежащим и именным сказуемым.'),
  position(2,'none','«Один из … уголков и крупнейший … сад» — однородные именные части сказуемого с одиночным «и», запятой нет.'),
  position(3,',','«Лес, парк…» — однородные члены перечисляются без союза.'),
  position(4,',','«Парк, коллекции…» — продолжается перечисление однородных членов.'),
  position(5,'—','После перечисления перед обобщающим «всё это и многое другое» нужно тире.'),
  position(6,',','«Среди которых…» присоединяет придаточную часть к слову «людей», перед ней нужна запятая.'),
  position(7,',','В двойном союзе «не только … но и» запятая ставится перед второй частью «но и».'),
  position(8,',','«Манит …, летом привлекает…» — однородные сказуемые без союза разделяются запятой.'),
  position(9,',','Перед противительным союзом «а» между однородными сказуемыми нужна запятая.')
 ])
];
export function punctuationText(task:Task) {
 return task.prompt.slice(1).flatMap(b=>'text' in b?[b.text]:[]).join('\n');
}
export function splitPunctuationText(text:string) {
 const parts:{text:string;position?:string}[]=[];let start=0;
 for(const match of text.matchAll(/\((\d+)\)/g)){
  parts.push({text:text.slice(start,match.index),position:match[1]});start=match.index+match[0].length;
 }
 parts.push({text:text.slice(start)});return parts;
}
export function punctuationExercises(pack:ContentPack) {
 if(pack.source.checksum!=='f6ed218ac5b38133e1042d34cabd6cc13ce63b837dd6f4696c5dac85267bf127')return [];
 return PUNCTUATION_EXERCISES.filter(e=>{
  const t=pack.tasks.find(t=>t.id===e.taskId&&t.version===e.taskVersion&&t.verification==='manual'&&!t.reviewRequired&&t.type==='positions');
  if(!t)return false;
  const ids=splitPunctuationText(punctuationText(t)).flatMap(p=>p.position?[p.position]:[]);
  return ids.length===e.positions.length&&new Set(ids).size===ids.length&&ids.every(id=>e.positions.some(p=>p.id===id))&&Array.isArray(t.key)&&e.positions.filter(p=>p.sign==='—').map(p=>p.id).join(',')===[...t.key].sort((a,b)=>Number(a)-Number(b)).join(',');
 });
}
export function checkPunctuation(exercise:PunctuationExercise,draft:PunctuationDraft) {
 const rows=exercise.positions.map(p=>({...p,chosen:draft.signs[p.id],correct:draft.signs[p.id]===p.sign}));
 return {rows,complete:rows.every(p=>p.chosen!==undefined),correctPositions:rows.filter(p=>p.correct).length,totalPositions:rows.length};
}
export function punctuationResults(pack:ContentPack,sessions:PunctuationSession[]) {
 const exercises=punctuationExercises(pack);
 return sessions.filter(s=>s.packId===pack.packId).flatMap(s=>Object.values(s.results)).filter(a=>exercises.some(e=>e.id===a.exerciseId&&e.version===a.exerciseVersion&&e.taskId===a.taskId&&e.taskVersion===a.taskVersion));
}
export const signLabel=(sign:PunctuationSign|undefined)=>sign===undefined?'не заполнено':sign==='none'?'без знака':sign===','?'запятая':'тире';
