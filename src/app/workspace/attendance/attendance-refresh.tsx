"use client";
import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
export function AttendanceRefresh() {
  const router=useRouter(); const [pending,start]=useTransition();
  useEffect(()=>{const timer=setInterval(()=>{if(document.visibilityState==="visible")router.refresh()},60000);return()=>clearInterval(timer)},[router]);
  return <button disabled={pending} onClick={()=>start(()=>router.refresh())}>{pending?"Refreshing…":"Refresh attendance"}</button>;
}
