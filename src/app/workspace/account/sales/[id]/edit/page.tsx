import { commercialEditorOptions, getCommercialDocument } from "@/lib/account/commercial";
import { SaleEditForm } from "./sale-edit-form";

export default async function Page({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const [sale,rawOptions]=await Promise.all([getCommercialDocument(id),commercialEditorOptions()]);
  if(sale.type!=="SALES_INVOICE"||sale.status!=="POSTED"||!sale.partyId)throw new Error("SALE_NOT_EDITABLE");
  const base=sale.payableAmount??sale.grandTotal;
  if(!sale.financial||!sale.financial.outstanding.eq(base)||sale.adjustments.length||sale.allocations.length||sale.advanceApplications.length)throw new Error("SALE_HAS_PAYMENTS_OR_ADJUSTMENTS");
  const options=JSON.parse(JSON.stringify(rawOptions));
  const initial={
    id:sale.id,
    branchId:sale.branchId,
    partyId:sale.partyId,
    issueDate:sale.issueDate.toISOString().slice(0,10),
    taxMode:sale.taxMode,
    stateOfSupplyCode:sale.stateOfSupplyCode??undefined,
    roundOffAmount:sale.roundOffAmount.toString(),
    lines:sale.lines.map(line=>({id:line.id,lineType:line.lineType,sourceId:line.productId??line.serviceId??line.workPackageId??undefined,itemName:line.itemName,description:line.description??undefined,unitName:line.unitName??undefined,unitSymbol:line.unitSymbol??undefined,quantity:line.quantity.toString(),rate:line.rate.toString(),discountType:line.discountType??undefined,discountValue:line.discountValue?.toString()??"0",taxRate:line.taxRate.toString(),cessRate:line.cessRate.toString(),warehouseId:line.warehouseId??undefined,batchId:line.batchId??undefined,serialNumberId:line.serialNumberId??undefined})),
  };
  return <SaleEditForm initial={initial} customers={options.customers} products={options.products} services={options.services} warehouses={options.warehouses}/>;
}
