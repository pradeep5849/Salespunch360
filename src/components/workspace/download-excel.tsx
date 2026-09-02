import Link from "next/link";
import type { SearchParams } from "@/lib/reports/validation";

export function DownloadExcel({report,params,ready=true}:{report:string;params:SearchParams;ready?:boolean}){
  if(!ready)return null;
  const query=new URLSearchParams();
  for(const[key,value]of Object.entries(params)){if(key==="page"||value===undefined)continue;query.set(key,Array.isArray(value)?value[0]:value)}
  return <Link className="download-excel" href={`/api/reports/${report}/excel?${query}`}>Download Excel</Link>;
}
