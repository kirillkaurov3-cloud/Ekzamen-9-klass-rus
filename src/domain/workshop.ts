import type {State} from './schema';
import {studySessionTitle} from './study';
export function workshopResume(state:State) {
 const options:{path:string;title:string;position:number;total:number;last:number}[]=[];
 if(state.activeLearning){const s=state.activeLearning;options.push({path:'/workshop/letters',title:'Буква и правило',position:s.position,total:s.exerciseIds.length,last:s.lastOpenedAt??s.startedAt});}
 if(state.activePunctuation){const s=state.activePunctuation;options.push({path:'/workshop/punctuation',title:'Знаки препинания',position:s.position,total:s.exerciseIds.length,last:s.lastOpenedAt});}
 if(state.activeStudy){const s=state.activeStudy;options.push({path:`/workshop/${s.mode}`,title:studySessionTitle(s),position:s.position,total:s.plan.length,last:s.lastOpenedAt});}
 return options.sort((a,b)=>b.last-a.last)[0]??null;
}
