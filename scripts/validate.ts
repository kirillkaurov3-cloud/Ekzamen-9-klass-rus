import {readFileSync} from 'node:fs';
import {ContentPackSchema} from '../src/domain/schema';
const path=process.argv[2]||'content-demo/pack.json';
const result=ContentPackSchema.safeParse(JSON.parse(readFileSync(path,'utf8')));
if(!result.success){console.error(result.error.issues);process.exit(1);}
console.log(`✓ ${result.data.title}: ${result.data.tasks.length} заданий, ${result.data.topics.length} тем. Схема и ссылки корректны.`);
