export interface GuideRule {title:string;text:string;example?:string}
export interface GuideExample {text:string;explanation:string}
export interface TheoryGuide {
 lead:string;mapKind?:'compare'|'sequence'|'composition';map:{label:string;detail:string}[];rules:GuideRule[];examples:GuideExample[];steps:string[];trap:{wrong:string;right:string};
 reference?:{title:string;rows:{name:string;rule:string;example:string}[]}[];
}
export const guide=(lead:string,map:TheoryGuide['map'],rules:GuideRule[],examples:GuideExample[],steps:string[],wrong:string,right:string):TheoryGuide=>({lead,map,rules,examples,steps,trap:{wrong,right}});
export const node=(label:string,detail:string)=>({label,detail});
export const rule=(title:string,text:string,example?:string):GuideRule=>({title,text,...(example?{example}:{})});
export const example=(text:string,explanation:string):GuideExample=>({text,explanation});
