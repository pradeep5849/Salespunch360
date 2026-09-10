import { saveQuotation } from "@/app/actions/quotations";import { quotationEditorOptions } from "@/lib/quotations/service";import { QuotationEditor } from "../quotation-editor";
export default async function Page(){const options=await quotationEditorOptions();return <main><h1>New quotation document</h1><QuotationEditor action={saveQuotation} options={options}/></main>}
