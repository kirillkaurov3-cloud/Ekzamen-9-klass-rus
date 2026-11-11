import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {ContentPackSchema} from '../src/domain/schema';
const input=process.argv[2];if(!input)throw new Error('Укажите локальный pack.json. Команда готовит публичный файл, но не выполняет push или деплой.');
const pack=ContentPackSchema.parse(JSON.parse(readFileSync(input,'utf8')));if(!pack.source.checksum)throw new Error('В наборе отсутствует контрольная сумма источника');
const url='packs/praktikum-2027.json';const data=Buffer.from(JSON.stringify(pack)+'\n');
const catalog={title:pack.title,url,sha256:createHash('sha256').update(data).digest('hex'),bytes:data.length,packVersion:pack.packVersion,sourceChecksum:pack.source.checksum,tasks:pack.tasks.length,graded:pack.tasks.filter(t=>t.type!=='self').length,self:pack.tasks.filter(t=>t.type==='self').length,theory:pack.theory.length,topics:pack.topics.length};
mkdirSync('public/packs',{recursive:true});mkdirSync('src/content',{recursive:true});writeFileSync('public/'+url,data);writeFileSync('src/content/catalog.json',JSON.stringify(catalog,null,2)+'\n');console.log(`Подготовлен публичный банк: ${catalog.tasks} записей, ${(data.length/1024/1024).toFixed(1)} МБ. PDF и отчёты не копировались.`);
