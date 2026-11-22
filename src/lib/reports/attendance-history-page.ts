import {REPORT_TIME_ZONE} from './config';
const dayMs=86400000;
const dateText=(date:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:REPORT_TIME_ZONE}).format(date);
/** Calendar windows keep every session from an India business day on the same page. */
export function attendanceHistoryPage(start:Date,endExclusive:Date,requestedPage:number){
 const totalPages=Math.max(1,Math.ceil((endExclusive.getTime()-start.getTime())/(7*dayMs)));
 const page=Math.max(1,Math.min(requestedPage,totalPages));
 const end=new Date(endExclusive.getTime()-(page-1)*7*dayMs),begin=new Date(Math.max(start.getTime(),end.getTime()-7*dayMs));
 return {page,totalPages,start:begin,endExclusive:end,startText:dateText(begin),endText:dateText(new Date(end.getTime()-1))};
}
