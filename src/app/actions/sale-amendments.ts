"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createCommercialDocument, getCommercialDocument, postCommercialDocument } from "@/lib/account/commercial";
import { ensureOpenFinancialYearForDate } from "@/lib/account/financial-year";
import { db } from "@/lib/db";

function today(){return new Date().toISOString().slice(0,10)}
function sourceIdForLine(line:{productId:string|null;serviceId:string|null;workPackageId:string|null}){return line.productId??line.serviceId??line.workPackageId??undefined}

async function editableSale(id:string){
  const sale=await getCommercialDocument(id);
  if(sale.type!=="SALES_INVOICE"||sale.status!=="POSTED"||!sale.partyId||!sale.financial)throw new Error("SALE_NOT_EDITABLE");
  const base=sale.payableAmount??sale.grandTotal;
  if(!sale.financial.outstanding.eq(base)||sale.adjustments.length||sale.allocations.length||sale.advanceApplications.length)throw new Error("SALE_HAS_PAYMENTS_OR_ADJUSTMENTS");
  return sale;
}

function fullCreditPayload(sale:Awaited<ReturnType<typeof editableSale>>){
  return {
    type:"CREDIT_NOTE" as const,
    branchId:sale.branchId,
    partyId:sale.partyId!,
    sourceDocumentId:sale.id,
    issueDate:today(),
    taxMode:sale.taxMode,
    stateOfSupplyCode:sale.stateOfSupplyCode??undefined,
    roundOffAmount:sale.roundOffAmount.toString(),
    lines:sale.lines.map(line=>({
      lineType:line.lineType,
      sourceId:sourceIdForLine(line),
      itemName:line.itemName,
      itemCode:line.itemCode??undefined,
      description:line.description??undefined,
      specification:line.specification??undefined,
      unitName:line.unitName??undefined,
      unitSymbol:line.unitSymbol??undefined,
      quantity:line.quantity.toString(),
      rate:line.rate.toString(),
      discountType:line.discountType??undefined,
      discountValue:line.discountValue?.toString()??undefined,
      taxRate:line.taxRate.toString(),
      cessRate:line.cessRate.toString(),
      warehouseId:line.warehouseId??undefined,
      batchId:line.batchId??undefined,
      serialNumberId:line.serialNumberId??undefined,
      stockReturnQuantity:line.quantity.toString(),
      sourceCommercialLineId:line.id,
    })),
  };
}

async function reverseSale(id:string){
  const sale=await editableSale(id);
  const credit=await createCommercialDocument(fullCreditPayload(sale));
  try{
    await ensureOpenFinancialYearForDate(credit.companyId,new Date(today()));
    await postCommercialDocument({documentId:credit.id});
  }catch(error){
    await db.commercialDocument.deleteMany({where:{id:credit.id,status:"DRAFT"}}).catch(()=>undefined);
    throw error;
  }
  await db.commercialDocument.update({where:{id:sale.id},data:{status:"CANCELLED"}});
  return credit;
}

export async function deletePostedSaleAction(form:FormData){
  const id=String(form.get("id")||"");
  await reverseSale(id);
  revalidatePath("/workspace/account");
  revalidatePath("/workspace/account/transactions");
  redirect("/workspace/account");
}

export async function replacePostedSaleAction(sourceId:string,raw:unknown){
  await editableSale(sourceId);
  const replacement=await createCommercialDocument(raw);
  try{
    await ensureOpenFinancialYearForDate(replacement.companyId,replacement.issueDate);
    await postCommercialDocument({documentId:replacement.id});
  }catch(error){
    await db.commercialDocument.deleteMany({where:{id:replacement.id,status:"DRAFT"}}).catch(()=>undefined);
    throw error;
  }
  try{
    await reverseSale(sourceId);
  }catch(error){
    // Compensate: do not leave a second live sale if the original cannot be reversed.
    await reverseSale(replacement.id).catch(()=>undefined);
    throw error;
  }
  revalidatePath("/workspace/account");
  revalidatePath("/workspace/account/transactions");
  return {id:replacement.id,documentNumber:replacement.documentNumber};
}
