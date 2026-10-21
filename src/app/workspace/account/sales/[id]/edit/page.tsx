import {parseCommercialUnitSnapshot} from "@/lib/account/commercial-unit-snapshot";
import {retainedLineDiscountValue} from "@/lib/account/retained-line-discount";
import {saleDetail} from "@/lib/account/sale-detail";
import Link from "next/link";
import styles from "../sale-detail.module.css";
import { commercialEditorOptions } from "@/lib/account/commercial";
import { SaleEditForm } from "./sale-edit-form";
import {AuthorizationError,requirePermission} from "@/lib/auth/authorization";
import {listSaleAttachmentsForActor} from "@/lib/account/sale-attachments";

export default async function Page({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const [sale,rawOptions]=await Promise.all([saleDetail(id),commercialEditorOptions()]);
  if(sale.type!=="SALES_INVOICE"||sale.status!=="POSTED"||!sale.partyId)return <main className={styles.root}><section className={styles.body}><h1>Edit Sale</h1><p>This document cannot be edited as a posted sale.</p><Link href={`/workspace/account/sales/${id}`}>View Sale</Link></section></main>;
  if(!sale.paymentSummary.canChange)return <main className={styles.root}><section className={styles.body}><h1>Edit Sale</h1><p>This sale cannot be edited with your current permissions or its current correction history.</p><Link href={`/workspace/account/sales/${id}`}>View Sale</Link></section></main>;
  const options=JSON.parse(JSON.stringify(rawOptions));
  const actor=await requirePermission("ACCOUNT_LEDGER_VIEW");if(!actor.companyId)throw new AuthorizationError();
  const attachments=await listSaleAttachmentsForActor({...actor,companyId:actor.companyId},sale.id);
  const initial={
    attachments:attachments.map(({id,displayName,mimeType,sizeBytes})=>({id,displayName,mimeType,sizeBytes})),
    id:sale.id,documentNumber:sale.documentNumber,
    projectId:sale.projectId??undefined,
    freightAmount:sale.freightAmount.toString(),otherChargesAmount:sale.otherChargesAmount.toString(),
    tdsRate:sale.taxableTotal.isZero()?"0":sale.tdsAmount.mul(100).div(sale.taxableTotal).toString(),tcsRate:sale.taxableTotal.isZero()?"0":sale.tcsAmount.mul(100).div(sale.taxableTotal).toString(),
    customValues:sale.customValues,
    branchId:sale.branchId,
    partyId:sale.partyId,
    billingName:sale.billingName??undefined,shippingAddress:sale.shippingAddress??"",customerPoNumber:sale.customerPoNumber??undefined,customerPoDate:sale.customerPoDate?.toISOString().slice(0,10),transactionTime:sale.transactionTime??undefined,ewayBillNumber:sale.ewayBillNumber??undefined,notes:sale.notes??undefined,dueDate:sale.dueDate?.toISOString().slice(0,10),
    issueDate:sale.issueDate.toISOString().slice(0,10),
    taxMode:sale.taxMode,
    reverseCharge:sale.reverseCharge,
    stateOfSupplyCode:sale.stateOfSupplyCode??undefined,
    roundOffAmount:sale.roundOffAmount.toString(),
    lines:sale.lines.map(line=>({unitConversionSnapshot:line.unitConversionSnapshot?parseCommercialUnitSnapshot(line.unitConversionSnapshot):undefined,originalLineId:line.id,lineType:line.lineType,sourceId:line.productId??line.serviceId??line.workPackageId??"",itemName:line.itemName,itemCode:line.itemCode??undefined,description:line.description??"",specification:line.specification??"",unitName:line.unitName??"",unitSymbol:line.unitSymbol??"",quantity:line.quantity.toString(),rate:line.rate.toString(),discountType:line.discountType??"",discountValue:retainedLineDiscountValue(line)??"0",taxRate:line.taxRate.toString(),cessRate:line.cessRate.toString(),warehouseId:line.warehouseId??"",batchId:line.batchId??"",serialNumberId:line.serialNumberId??"",servicePeriodDays:line.servicePeriodDays===null?undefined:String(line.servicePeriodDays),stockReturnQuantity:"0",sourceCommercialLineId:"",purchaseAllocations:[]})),
  };
  return <SaleEditForm initial={initial} options={options}/>;
}
