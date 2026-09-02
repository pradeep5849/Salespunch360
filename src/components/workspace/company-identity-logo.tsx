/* eslint-disable @next/next/no-img-element */
"use client";
import { useState } from "react";

export function CompanyIdentityLogo({name,hasLogo,className}:{name:string;hasLogo:boolean;className?:string}) {
  const [failed,setFailed]=useState(false);
  if(!hasLogo||failed)return <b className={className}>{name.charAt(0).toUpperCase()}</b>;
  return <span className={`company-identity-logo${className?` ${className}`:""}`}><img src="/api/company-logo" alt="" onError={()=>setFailed(true)}/></span>;
}
