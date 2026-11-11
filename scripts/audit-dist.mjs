import {readdir, readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const catalog=JSON.parse(await readFile('src/content/catalog.json','utf8'));
const publishedFile=catalog.url;
let publishedFound=false;
const root=path.resolve('dist');
const failures=[];
async function visit(directory){
 for(const entry of await readdir(directory,{withFileTypes:true})){
  const filename=path.join(directory,entry.name),relative=path.relative(root,filename);
  if(relative===publishedFile){
   const data=await readFile(filename);const pack=JSON.parse(data);publishedFound=true;
   if(data.length!==catalog.bytes||createHash('sha256').update(data).digest('hex')!==catalog.sha256||pack.packVersion!==catalog.packVersion||pack.tasks.length!==catalog.tasks)failures.push(relative+': версия или контрольная сумма не совпадают');
  }
  if(/(?:content-(?:private|source)|review-queue|coverage|report|\.pdf$|pack\.json$|pages\.json$)/iu.test(relative))failures.push(relative);
  if(entry.isDirectory())await visit(filename);
  else if(/\.(?:js|html|json|txt|css)$/iu.test(filename)){
   const text=await readFile(filename,'utf8');
   if(/Tematicheskiy_praktikum|content-private|content-source/iu.test(text)||relative!==publishedFile&&/РУСТЬЮТОРС/iu.test(text))failures.push(`${relative}: обнаружен маркер частных материалов`);
  }
 }
}
await visit(root);
if(!publishedFound)failures.push('Опубликованный банк отсутствует');
if(failures.length){console.error('Аудит dist не пройден:\n'+failures.join('\n'));process.exit(1);}
console.log('Аудит dist: опубликованный банк проверен по SHA-256; исходный PDF, частные каталоги и отчёты отсутствуют.');
