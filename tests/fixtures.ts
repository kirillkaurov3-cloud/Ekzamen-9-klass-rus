import {ContentPackSchema, TaskSchema, type Attempt, type ContentPack, type Task} from '../src/domain/schema';
export function task(overrides: Partial<Task> = {}): Task {
 return TaskSchema.parse({id:'test.2.1',version:1,oge:2,topicIds:['topic.2'],type:'multi',prompt:[{type:'paragraph',text:'Выберите верные ответы.'}],options:[{id:'1',text:'Первый'},{id:'2',text:'Второй'},{id:'12',text:'Двенадцатый'}],key:['1','12'],source:{title:'Собственный тестовый пример',pages:[],answerPages:[]},verification:'manual',timed:true,...overrides});
}
export function pack(tasks: Task[] = [task()]): ContentPack {
 return ContentPackSchema.parse({schemaVersion:1,packId:'test-pack',packVersion:'1',title:'Тестовый набор',demo:false,source:{title:'Собственные тестовые примеры'},topics:[{id:'topic.2',title:'Тема',oge:2}],texts:[],theory:[],tasks});
}
export function attempt(overrides: Partial<Attempt> = {}): Attempt {
 return {id:'attempt.1',sessionId:'session.1',taskId:'test.2.1',taskVersion:1,answer:['1','12'],result:'correct',incomplete:false,checkedAt:1,mode:'practice',packId:'test-pack',packVersion:'1',...overrides};
}
