import Link from "next/link";
import {CompanyIdentityLogo} from "./company-identity-logo";
export function CompanyIdentity({href,name,address,hasLogo=false,version,className="workspace-identity"}:{href:string;name:string;address?:string;hasLogo?:boolean;version?:string|number;className?:string}){return <Link className={className} href={href}><CompanyIdentityLogo name={name} hasLogo={hasLogo} version={version}/><span><strong>{name}</strong>{address&&<small>{address}</small>}</span></Link>}
