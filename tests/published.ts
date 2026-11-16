import {readFileSync} from 'node:fs';
export const published:{graded:number;tasks:number;self:number}=JSON.parse(readFileSync('src/content/catalog.json','utf8'));
