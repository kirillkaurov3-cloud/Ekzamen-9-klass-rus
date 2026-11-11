import {readFileSync} from 'node:fs';
import {afterEach,expect,it,vi} from 'vitest';
import {catalog,fetchPublishedPack} from '../src/content/publicPack';
const bytes=readFileSync('public/'+catalog.url);
afterEach(()=>vi.unstubAllGlobals());
it('downloads the exact published version and validates its schema',async()=>{
 const fetch=vi.fn().mockResolvedValue(new Response(bytes.toString('utf8')));vi.stubGlobal('fetch',fetch);
 const p=await fetchPublishedPack();expect(p.tasks).toHaveLength(catalog.tasks);expect(p.tasks.filter(t=>t.type==='self')).toHaveLength(catalog.self);expect(p.packVersion).toBe(catalog.packVersion);expect(fetch).toHaveBeenCalledWith(expect.stringContaining(catalog.url),expect.objectContaining({cache:'no-store'}));
});
it('rejects altered bytes even when their length matches',async()=>{
 const altered=new Uint8Array(bytes);altered[100]^=1;vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(altered.buffer)));
 await expect(fetchPublishedPack()).rejects.toThrow('целостности');
});
it('rejects incomplete downloads, HTTP failures and unavailable network',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{}')));await expect(fetchPublishedPack()).rejects.toThrow('Размер');
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(null,{status:404})));await expect(fetchPublishedPack()).rejects.toThrow('404');
 vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('network')));await expect(fetchPublishedPack()).rejects.toThrow('Проверь интернет');
});
