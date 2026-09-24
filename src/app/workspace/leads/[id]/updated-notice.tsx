"use client";
import{useEffect}from"react";import{useRouter}from"next/navigation";
export function LeadUpdatedNotice({href}:{href:string}){const router=useRouter();useEffect(()=>{const timer=window.setTimeout(()=>router.replace(href),1800);return()=>window.clearTimeout(timer)},[href,router]);return <p className="lead-update-toast" role="status">Lead updated</p>}
