import 'fake-indexeddb/auto';
import {afterAll,beforeEach,expect,it} from 'vitest';
import {localSources,saveLocalSource,MAX_LOCAL_PDF_BYTES} from '../src/storage/localSource';
const bytes='%PDF-1.4\nOwn local source\n%%EOF',hash=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
beforeEach(async()=>{await localSources.delete();await localSources.open();});afterAll(async()=>{await localSources.delete();});
it('accepts only the requested source fingerprint and retains the previous file after rejection',async()=>{
 const expected=await hash(bytes),file=new File([bytes],'own-source.pdf',{type:'application/pdf'});await saveLocalSource(file,expected);expect(await localSources.files.count()).toBe(1);expect(await (await localSources.files.get(expected))?.file.text()).toBe(bytes);
 await expect(saveLocalSource(new File(['%PDF-1.4\nother'],'other.pdf'),expected)).rejects.toThrow('другая редакция');await expect(saveLocalSource(new File(['hello'],'bad.pdf'),expected)).rejects.toThrow('не является PDF');expect(await localSources.files.count()).toBe(1);
});
it('rejects unknown fingerprints and oversized local files before retaining content',async()=>{
 await expect(saveLocalSource(new File([bytes],'source.pdf'),'')).rejects.toThrow('контрольной суммы');await expect(saveLocalSource(new File([new Uint8Array(MAX_LOCAL_PDF_BYTES+1)],'big.pdf'),'a'.repeat(64))).rejects.toThrow('до 20 МБ');expect(await localSources.files.count()).toBe(0);
});
