import fs from 'node:fs/promises';
const headers=await fs.readFile(process.argv[2],'utf8');
const body=await fs.readFile(process.argv[3],'utf8');
const selected=headers.split(/\r?\n/).filter(line=>/^(HTTP\/|server:|platform:|panel:|content-type:|location:|x-hcdn-upstream-rt:)/i.test(line));
console.log('PUBLIC_RESPONSE '+JSON.stringify({headers:selected,title:body.match(/<title[^>]*>(.*?)<\/title>/is)?.[1],blockedExcerpt:headers.includes('403')?body.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0,600):undefined}));
