import catalog from './catalog.json';
import {ContentPackSchema} from '../domain/schema';
import {config} from '../config';
export {catalog};
export async function fetchPublishedPack(signal?:AbortSignal){
 let response:Response;
 try{response=await fetch(`${import.meta.env.BASE_URL}${catalog.url}`,{cache:'no-store',signal});}catch{throw new Error('Не удалось загрузить набор. Проверь интернет и попробуй ещё раз.');}
 if(!response.ok)throw new Error(`Не удалось загрузить набор (${response.status}). Попробуй ещё раз с интернетом.`);
 const bytes=await response.arrayBuffer();
 if(bytes.byteLength>config.maxPackBytes||bytes.byteLength!==catalog.bytes)throw new Error('Размер набора не совпадает с опубликованной версией. Обнови приложение и попробуй снова.');
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
 if(hash!==catalog.sha256)throw new Error('Набор не прошёл проверку целостности. Обнови приложение и попробуй снова.');
 const pack=ContentPackSchema.parse(JSON.parse(new TextDecoder().decode(bytes)));
 if(pack.packVersion!==catalog.packVersion||pack.tasks.length!==catalog.tasks)throw new Error('Версия набора не совпадает с каталогом.');
 return pack;
}
