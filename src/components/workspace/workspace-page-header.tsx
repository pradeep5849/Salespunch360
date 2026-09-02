import Link from "next/link";

export function WorkspacePageHeader({title,backHref,backLabel}:{title:string;backHref:string;backLabel?:string}){
  return <header className="workspace-page-header"><Link href={backHref} aria-label={backLabel??`Back to ${backHref==="/workspace"?"workspace":"parent page"}`}>← {title}</Link></header>;
}
