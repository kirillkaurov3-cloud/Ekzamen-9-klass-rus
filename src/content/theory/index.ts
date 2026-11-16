import type {ContentPack} from '../../domain/schema';
import {syntax} from './syntax';
import {punctuation} from './punctuation';
import {spelling} from './spelling';
import {meaning} from './meaning';
import {guide,node as n,rule as r,example as e,type TheoryGuide} from './model';
export type {TheoryGuide} from './model';
export const guides:Record<string,TheoryGuide>={...syntax,...punctuation,...spelling,...meaning};
guides['2.1'].mapKind='composition';
for(const key of ['3.6','4.6','4.11','4.13','5.overview','6.5','6.7','6.overview','7.1','8.1','11.2','11.3','11.4','11.5','12.1','12.2','12.4'])guides[key].mapKind='sequence';
const expressive=guide('Средство выразительности распознают по работе образа: сопоставление, перенос, образный признак или устойчивое значение.',[n('Сопоставление','сравнение'),n('Перенос','метафора · олицетворение'),n('Характеристика','эпитет')],[r('Сравнение и метафора','Сравнение сопоставляет, метафора переносит название по сходству.'),r('Эпитет и олицетворение','Эпитет — образное определение, олицетворение — признаки живого у неживого.')],[e('Снег, {a:словно серебро}.','Прямое образное сопоставление — сравнение.'),e('Ветер {a:шепчет}.','Человеческое речевое действие приписано ветру — олицетворение.')],['Установи буквальное и контекстное значение.','Объясни, как создаётся образ.','Назови средство по его функции.'],'Выбирать средство только по наличию прилагательного или союза.','Нужна конкретная образная функция.');
const lexical=guide('Лексический анализ проверяет значение слова и его отношения с другими словами в контексте.',[n('Значение','Что означает здесь?'),n('Отношения','Синоним ↔ антоним'),n('Устойчивость','Фразеологизм')],[r('Слово в контексте','Одно слово может иметь несколько значений. Выбирай то, которое реализовано в предложении.'),r('Лексические отношения','Синонимы близки по смыслу, антонимы противоположны по общему признаку; фразеологизм имеет целостное значение.')],[e('Краб был {a:страшно} большой.','«Страшно» здесь означает «очень», а не чувство страха.'),e('Он {a:взялся за ум}.','Целое устойчивое выражение означает, что герой стал разумнее вести себя.')],['Определи точное требование задания.','Прочитай слово или сочетание в контексте.','Проверь значение, форму и границы ответа.'],'Подобрать ответ только по сходству звучания.','Смысл и употребление должны совпадать.');
const demo:Record<string,TheoryGuide>={r2:guides['2.1'],r3:guides['3.4'],r4:guides['5.overview'],r5:guides['5.overview'],r6:guides['6.overview'],r7:guides['7.1'],r8:guides['8.1'],r9:guides['9.1'],r11:expressive,r12:lexical};
const SOURCE='f6ed218ac5b38133e1042d34cabd6cc13ce63b837dd6f4696c5dac85267bf127';
export function visualGuide(pack:ContentPack,theoryId:string):TheoryGuide|undefined {
 if(pack.packId==='zapyataya-demo'&&pack.demo)return demo[theoryId];
 if(pack.packId!=='rustutors-2026-2027'||pack.source.checksum!==SOURCE)return undefined;
 const match=/^rustutors-2026-2027-oge(\d+)-(?:topic(\d+)-theory|(overview))$/.exec(theoryId);
 return match?guides[`${match[1]}.${match[3]?'overview':match[2]}`]:undefined;
}
/** Literal text and emphasis stay separate; content never becomes HTML. */
export function exampleParts(value:string){
 const parts:{text:string;role:'s'|'p'|'a'|null}[]=[];let end=0;
 for(const match of value.matchAll(/\{([spa]):([^{}]+)\}/g)){if(match.index>end)parts.push({text:value.slice(end,match.index),role:null});parts.push({text:match[2],role:match[1] as 's'|'p'|'a'});end=match.index+match[0].length;}
 if(end<value.length)parts.push({text:value.slice(end),role:null});return parts;
}
