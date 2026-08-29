'use client';
export default function GlobalError({reset}:{error:Error&{digest?:string};reset:()=>void}){return <main className="safe-error"><h1>Something went wrong</h1><p>SalesPunch360 could not complete this request. No changes should be assumed.</p><button onClick={reset}>Try again</button><a href="/workspace">Return to workspace</a></main>}
