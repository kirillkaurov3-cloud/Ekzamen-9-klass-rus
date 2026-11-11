import {readFileSync} from 'node:fs';
import {ContentPackSchema} from '../src/domain/schema';
const paths=process.argv[2]?[process.argv[2]]:['content-demo/pack.json','public/packs/praktikum-2027.json'];
for(const path of paths){
 const result=ContentPackSchema.safeParse(JSON.parse(readFileSync(path,'utf8')));
 if(!result.success){console.error(path,result.error.issues);process.exit(1);}
 console.log(`✓ ${result.data.title}: ${result.data.tasks.length} заданий, ${result.data.topics.length} тем. Схема и ссылки корректны.`);
}
