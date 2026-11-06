import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const selectedHeaders=new Set(['server','via','content-type','location','x-hcdn-request-id','x-hcdn-cache-status','cf-ray','x-cache','x-served-by','x-proxy-error','x-denied-reason']);
export function summarizeNetwork(events) {
  const requests=new Map();const responses=[];const failures=[];
  for(const event of events){
    const p=event.params??{};
    if(event.method==='Network.requestWillBeSent')requests.set(p.requestId,{url:p.request?.url,method:p.request?.method,type:p.type,headers:p.request?.headers??{}});
    if(event.method==='Network.requestWillBeSentExtraInfo'){
      const old=requests.get(p.requestId)??{};requests.set(p.requestId,{...old,headers:{...old.headers,...p.headers}});
    }
    if(event.method==='Network.responseReceived'){
      const r=p.response??{};const req=requests.get(p.requestId)??{};
      if(p.type==='Document'||r.status>=400)responses.push({url:r.url??req.url,method:req.method,type:p.type,status:r.status,protocol:r.protocol,
        remoteAddress:r.remoteIPAddress,fromServiceWorker:r.fromServiceWorker??false,fromDiskCache:r.fromDiskCache??false,
        userAgent:Object.entries(req.headers??{}).find(([key])=>key.toLowerCase()==='user-agent')?.[1],
        headers:Object.fromEntries(Object.entries(r.headers??{}).filter(([key])=>selectedHeaders.has(key.toLowerCase())))});
    }
    if(event.method==='Network.loadingFailed')failures.push({url:requests.get(p.requestId)?.url,type:p.type,error:p.errorText,blockedReason:p.blockedReason});
  }
  return {documents:responses.filter(r=>r.type==='Document'),httpErrors:responses.filter(r=>r.status>=400),loadingFailures:failures.slice(0,25)};
}
export async function inspect(directory) {
  const files=await fs.readdir(directory);let found=false;
  for(const file of files.filter(file=>file.endsWith('.devtoolslog.json'))){
    found=true;const summary=summarizeNetwork(JSON.parse(await fs.readFile(path.join(directory,file),'utf8')));
    console.log('LIGHTHOUSE_NETWORK_DIAGNOSTIC '+JSON.stringify({file,...summary}));
  }
  if(!found)console.log('LIGHTHOUSE_NETWORK_DIAGNOSTIC '+JSON.stringify({error:'No DevTools network log produced; browser may have failed before navigation.'}));
  for(const file of files.filter(file=>file.endsWith('.report.json'))){
    const report=JSON.parse(await fs.readFile(path.join(directory,file),'utf8'));
    console.log('LIGHTHOUSE_REPORT_STATUS '+JSON.stringify({file,requestedUrl:report.requestedUrl,finalUrl:report.finalDisplayedUrl??report.finalUrl,fetchTime:report.fetchTime,runtimeError:report.runtimeError??null}));
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await inspect(process.argv[2]??'reports');
