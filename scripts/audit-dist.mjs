import {readdir, readFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('dist');
const failures=[];
async function visit(directory){
 for(const entry of await readdir(directory,{withFileTypes:true})){
  const filename=path.join(directory,entry.name),relative=path.relative(root,filename);
  if(/(?:content-(?:private|source)|review-queue|coverage|report|\.pdf$|pack\.json$|pages\.json$)/iu.test(relative))failures.push(relative);
  if(entry.isDirectory())await visit(filename);
  else if(/\.(?:js|html|json|txt|css)$/iu.test(filename)){
   const text=await readFile(filename,'utf8');
   if(/РУСТЬЮТОРС|rustutors|Tematicheskiy_praktikum|content-private|content-source/iu.test(text))failures.push(`${relative}: обнаружен маркер частных материалов`);
  }
 }
}
await visit(root);
if(failures.length){console.error('Аудит dist не пройден:\n'+failures.join('\n'));process.exit(1);}
console.log('Аудит dist: PDF, частные пакеты, отчёты и исходные материалы отсутствуют.');
