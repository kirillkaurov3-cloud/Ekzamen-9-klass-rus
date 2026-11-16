import {readFileSync} from 'node:fs';
const metadata:{graded:number;tasks:number;self:number}=JSON.parse(readFileSync('src/content/catalog.json','utf8'));

export const published={...metadata,graded:Number(process.env.OGE_EXPECTED_GRADED??metadata.graded)};
