/* eslint-disable @next/next/no-img-element */
"use client";
import { useState } from "react";

export function CompanyIdentityLogo({name,hasLogo,version,className}:{name:string;hasLogo:boolean;version?:string|number;className?:string}) {
  const currentVersion=String(version??"current"),[failedVersion,setFailedVersion]=useState<string>();
  if(!hasLogo||failedVersion===currentVersion)return <b className={className}>{name.charAt(0).toUpperCase()}</b>;
  return <span className={`company-identity-logo${className?` ${className}`:""}`}><img src={`/api/company-logo?v=${encodeURIComponent(currentVersion)}`} alt="" onError={()=>setFailedVersion(currentVersion)}/></span>;
}
