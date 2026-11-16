import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {ContentPackSchema} from '../src/domain/schema';
import {exampleParts,guides,visualGuide} from '../src/content/theory';
const book=ContentPackSchema.parse(JSON.parse(readFileSync('public/packs/praktikum-2027.json','utf8'))),demo=ContentPackSchema.parse(JSON.parse(readFileSync('content-demo/pack.json','utf8')));
it('covers every existing book and demo theory with specific rules, examples and a usable solution path',()=>{
 expect(book.theory).toHaveLength(47);expect(Object.keys(guides)).toHaveLength(47);
 for(const pack of [book,demo])for(const theory of pack.theory){const guide=visualGuide(pack,theory.id);expect(guide,theory.id).toBeDefined();expect(guide!.map.length).toBeGreaterThanOrEqual(2);expect(guide!.rules.length).toBeGreaterThanOrEqual(2);expect(guide!.examples).toHaveLength(2);expect(guide!.steps).toHaveLength(3);expect(guide!.trap.wrong).not.toBe(guide!.trap.right);for(const item of guide!.examples){expect(exampleParts(item.text).map(p=>p.text).join('')).not.toMatch(/[{}]/);expect(item.explanation.length).toBeGreaterThan(35);}}
});
it('keeps clear grammatical roles, multiword predicates and the place circumstance in the main worked example',()=>{
 const example=guides['2.1'].examples[0],parts=exampleParts(example.text);expect(parts.map(p=>p.text).join('')).toBe('Над рекой поднимался туман.');expect(parts.find(p=>p.role==='s')?.text).toBe('туман');expect(parts.find(p=>p.role==='p')?.text).toBe('поднимался');expect(parts[0].role).toBeNull();expect(example.explanation).toContain('обстоятельство места');expect(exampleParts(guides['2.1'].examples[1].text).find(p=>p.role==='p')?.text).toBe('стало прозрачным');
});
it('does not replace unrelated imported theory and does not mutate the pack or tasks',()=>{
 const before=JSON.stringify(book);for(const t of book.theory)visualGuide(book,t.id);expect(JSON.stringify(book)).toBe(before);expect(visualGuide({...book,packId:'my-own-pack'},book.theory[0].id)).toBeUndefined();expect(visualGuide({...book,source:{...book.source,checksum:'other'}},book.theory[0].id)).toBeUndefined();expect(visualGuide(book,'unknown-rule')).toBeUndefined();
});
