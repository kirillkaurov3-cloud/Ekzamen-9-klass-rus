import type {State} from './schema';

export function workshopResume(state:State) {
 const letters=state.activeLearning,punctuation=state.activePunctuation;
 if(punctuation&&(!letters||punctuation.lastOpenedAt>=(letters.lastOpenedAt??letters.startedAt)))return {path:'/workshop/punctuation',title:'Знаки препинания',position:punctuation.position,total:punctuation.exerciseIds.length};
 if(letters)return {path:'/workshop/letters',title:'Буква и правило',position:letters.position,total:letters.exerciseIds.length};
 return null;
}
