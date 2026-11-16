import Dexie,{type Table} from 'dexie';
export const MAX_LOCAL_PDF_BYTES=20*1024*1024;
export interface LocalSource {id:string;file:Blob;name:string;size:number}
class LocalSources extends Dexie {
 files!:Table<LocalSource,string>;
 constructor(){super('zapyataya-local-source');this.version(1).stores({files:'id'});}
}
export const localSources=new LocalSources();
export async function saveLocalSource(file:File,expected:string):Promise<LocalSource> {
 if(!/^[a-f0-9]{64}$/.test(expected))throw new Error('У набора нет контрольной суммы исходника.');
 if(file.size>MAX_LOCAL_PDF_BYTES)throw new Error('Выбери PDF размером до 20 МБ.');
 const bytes=await file.arrayBuffer();
 if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw new Error('Выбранный файл не является PDF.');
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
 if(hash!==expected)throw new Error('Это другая редакция PDF. Выбери исходник, из которого подготовлен текущий набор.');
 const source={id:hash,file:new Blob([bytes],{type:'application/pdf'}),name:file.name,size:file.size};await localSources.files.put(source);return source;
}
