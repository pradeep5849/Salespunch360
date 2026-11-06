import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root='src/app/(marketing)';
const dates={};
const shared=['src/lib/public-site/content.ts','src/components/public/public-header.tsx','src/components/public/public-footer.tsx','src/app/(marketing)/layout.tsx'];
const trackedTime=file=>execFileSync('git',['log','-1','--format=%cI','--',':(literal)'+file],{encoding:'utf8'}).trim();
const changed=file=>execFileSync('git',['status','--porcelain','--',':(literal)'+file],{encoding:'utf8'}).trim()!=='';
const sharedDate=shared.map(file=>changed(file)?new Date().toISOString():trackedTime(file)).filter(Boolean).sort().at(-1);
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(entry.name==='page.tsx'&&!file.includes('[')){
  const route=path.relative(root,path.dirname(file)).split(path.sep).filter(Boolean).join('/');
  dates[route?'/'+route:'']=[sharedDate,changed(file)?new Date().toISOString():trackedTime(file)].filter(Boolean).sort().at(-1);
}}}
walk(root);
// Feature pages are generated from the shared, versioned content file.
const featureSource=fs.readFileSync('src/lib/public-site/content.ts','utf8');
for(const match of featureSource.matchAll(/slug:\s*"([a-z0-9-]+)"/g)) dates['/features/'+match[1]]=sharedDate;
fs.writeFileSync('src/lib/public-site/modified-dates.json',JSON.stringify(dates,null,2)+'\n');
console.log(`Recorded real source modification times for ${Object.keys(dates).length} public routes.`);
