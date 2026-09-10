import {commercialEditorOptions} from "@/lib/account/commercial";import {CommercialEditor} from "./commercial-editor";
export default async function Page(){const raw=await commercialEditorOptions(),options=JSON.parse(JSON.stringify(raw));return <main><h1>New sales / purchase document</h1><CommercialEditor options={options}/></main>}
