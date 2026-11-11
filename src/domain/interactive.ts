import type {ContentPack} from './schema';

export interface LetterExercise {
 id:string;
 version:number;
 taskId:string;
 taskVersion:number;
 position:string;
 before:string;
 after:string;
 letter:'е'|'и';
 rule:string;
 choices:{id:string;text:string}[];
 hint:string;
 explanation:string;
}
/** hintUsed also records opening theory before grading. */
export interface LetterDraft {letter:string;rule:string;hintUsed:boolean}
export interface LearningAttempt {
 id:string;
 exerciseId:string;
 exerciseVersion:number;
 taskId:string;
 taskVersion:number;
 answer:LetterDraft;
 lettersCorrect:boolean;
 ruleCorrect:boolean;
 checkedAt:number;
 localDay:string;
}
export interface LearningSession {
 id:string;
 packId:string;
 mechanic:'letters';
 exerciseIds:string[];
 exerciseVersions:Record<string,number>;
 position:number;
 drafts:Record<string,LetterDraft>;
 results:Record<string,LearningAttempt>;
 status:'active'|'completed';
 startedAt:number;
 finishedAt?:number;
}

const TASK_ID='rustutors-2026-2027-oge7-topic1-q57';
const SOURCE_CHECKSUM='f6ed218ac5b38133e1042d34cabd6cc13ce63b837dd6f4696c5dac85267bf127';
// Five rows manually checked against task 57 (p.285) and its answer table (p.512).
// Explanations and hints are authored for the app; the original question stays intact.
export const LETTER_EXERCISES:LetterExercise[]=[
 {id:'letters.q57.1',version:1,taskId:TASK_ID,taskVersion:1,position:'1',before:'Дальн',after:'й',letter:'и',rule:'ending',choices:[
  {id:'root',text:'Гласная в корне проверяется ударением'},
  {id:'ending',text:'В окончании прилагательного мужского рода после мягкого согласного пишется -ий'},
  {id:'suffix',text:'В суффиксе наречия пишется -енн-'}
 ],hint:'Определи часть речи и форму слова: берег какой? Где заканчивается корень?',explanation:'Дальний — прилагательное мужского рода в именительном падеже единственного числа. Пропуск находится в окончании -ий, после мягкого [н\u2019]. Это не гласная корня.'},
 {id:'letters.q57.2',version:1,taskId:TASK_ID,taskVersion:1,position:'2',before:'бер',after:'г',letter:'е',rule:'root',choices:[
  {id:'dictionary',text:'Непроверяемая гласная корня: написание нужно запомнить'},
  {id:'ending',text:'Окончание существительного второго склонения в предложном падеже'},
  {id:'root',text:'Проверяемая гласная корня: побере́жье'}
 ],hint:'Найди однокоренное слово, в котором нужная гласная стоит под ударением.',explanation:'Берег: вторая гласная корня без ударения. Проверочное слово побере́жье: под ударением слышится Е. Поэтому пишем берег.'},
 {id:'letters.q57.3',version:1,taskId:TASK_ID,taskVersion:1,position:'3',before:'в туман',after:'',letter:'е',rule:'ending',choices:[
  {id:'ending',text:'У существительного второго склонения в предложном падеже окончание -е'},
  {id:'root',text:'Гласная в корне проверяется ударением'},
  {id:'dictionary',text:'Непроверяемая гласная в корне'}
 ],hint:'Задай вопрос от глагола: утонул в чём? Установи склонение слова «туман».',explanation:'В тумане: туман — существительное мужского рода второго склонения. В предложном падеже единственного числа у него окончание -е. Корень туман не меняется.'},
 {id:'letters.q57.4',version:1,taskId:TASK_ID,taskVersion:1,position:'4',before:'сум',after:'рках',letter:'е',rule:'dictionary',choices:[
  {id:'root',text:'Проверяемая гласная корня: её можно поставить под ударение'},
  {id:'dictionary',text:'Непроверяемая гласная корня: сумерки — словарное слово'},
  {id:'ending',text:'Окончание существительного второго склонения'}
 ],hint:'Определи морфему. Для некоторых безударных гласных проверочного слова нет.',explanation:'Сумерках: пропущенная Е находится в корне. Сумерки — словарное слово, эту гласную нельзя проверить ударением. Написание нужно запомнить.'},
 {id:'letters.q57.9',version:1,taskId:TASK_ID,taskVersion:1,position:'9',before:'прибл',after:'жаясь',letter:'и',rule:'root',choices:[
  {id:'prefix',text:'Приставка при- со значением приближения'},
  {id:'root',text:'Проверяемая гласная корня: бли́зко'},
  {id:'suffix',text:'Суффикс деепричастия -я-'}
 ],hint:'Приставка при- уже написана. Каким словом можно проверить гласную после «бл»?',explanation:'Приближаясь: пропуск находится в корне, а не в приставке при-. Проверочное слово бли́зко, поэтому пишется И. Буква Я в суффиксе здесь уже дана.'}
];

export function letterExercises(pack:ContentPack):LetterExercise[] {
 if(pack.source.checksum!==SOURCE_CHECKSUM)return [];
 return LETTER_EXERCISES.filter(ex=>pack.tasks.some(t=>t.id===ex.taskId&&t.version===ex.taskVersion&&t.verification==='manual'&&!t.reviewRequired&&t.type!=='self'));
}
export function checkLetter(exercise:LetterExercise,draft:LetterDraft) {
 return {lettersCorrect:draft.letter===exercise.letter,ruleCorrect:draft.rule===exercise.rule};
}
export function learningResults(pack:ContentPack,sessions:LearningSession[]) {
 const exercises=letterExercises(pack);
 return sessions.filter(s=>s.packId===pack.packId).flatMap(s=>Object.values(s.results))
  .filter(a=>exercises.some(e=>e.id===a.exerciseId&&e.version===a.exerciseVersion&&e.taskId===a.taskId&&e.taskVersion===a.taskVersion));
}
