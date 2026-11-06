import fs from 'node:fs/promises';
const report=JSON.parse(await fs.readFile(process.argv[2],'utf8'));
if(report.runtimeError)throw new Error(report.runtimeError.message);
const metrics=['first-contentful-paint','largest-contentful-paint','speed-index','total-blocking-time','cumulative-layout-shift','server-response-time'];
const summary={url:report.finalDisplayedUrl??report.finalUrl,fetchedAt:report.fetchTime,device:report.configSettings.formFactor,
  scores:Object.fromEntries(Object.entries(report.categories).map(([key,value])=>[key,Math.round(value.score*100)])),
  metrics:Object.fromEntries(metrics.filter(key=>report.audits[key]).map(key=>[key,{value:report.audits[key].numericValue,display:report.audits[key].displayValue}])),
  opportunities:Object.entries(report.audits).filter(([,audit])=>audit.score!==null&&audit.score<1&&(audit.details?.overallSavingsMs||audit.metricSavings?.LCP||audit.metricSavings?.FCP||audit.numericValue))
    .map(([id,audit])=>({id,title:audit.title,display:audit.displayValue,savingsMs:audit.details?.overallSavingsMs??audit.metricSavings?.LCP??audit.metricSavings?.FCP??0,details:audit.details?.items?.slice(0,5)}))
    .sort((a,b)=>b.savingsMs-a.savingsMs).slice(0,12)};
await fs.writeFile(process.argv[3],JSON.stringify(summary,null,2)+'\n');
console.log('PUBLIC_AUDIT_SUMMARY '+JSON.stringify(summary));
