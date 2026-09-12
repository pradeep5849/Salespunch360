import Link from "next/link";

export function WorkspacePageHeader({title,backHref,backLabel}:{title:string;backHref:string;backLabel?:string}){
  return <header className="workspace-page-header">
    <Link className="workspace-back-button" href={backHref} aria-label={backLabel??`Back to ${backHref==="/workspace"?"workspace":"parent page"}`}>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
    </Link>
    <h1>{title}</h1>
  </header>;
}
