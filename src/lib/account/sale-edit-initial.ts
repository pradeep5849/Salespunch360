import type { EditableLine } from "@/app/workspace/account/transactions/new/commercial-editor";

/** Invoice snapshots used by the shared Add/Edit Sale form. */
export type SaleEditInitial = {
  canDelete?:boolean;
  recordedPayments?: {
    credits?:string;originalReturnCredits?:string;returnCreditsTransferred?:string;
    received:string; paymentDiscount:string; advanceApplied:string; outstanding:string;
    receipts:Array<{id:string;amount:string;date:string;mode:string;reference:string|null}>;
  };
  id: string;
  documentNumber: string;
  branchId: string;
  partyId: string;
  issueDate: string;
  taxMode: string;
  reverseCharge: boolean;
  roundOffAmount: string;
  freightAmount: string;
  otherChargesAmount: string;
  tdsRate: string;
  tcsRate: string;
  billingName?: string;
  shippingAddress?: string;
  customerPoNumber?: string;
  customerPoDate?: string;
  transactionTime?: string;
  ewayBillNumber?: string;
  invoiceDescription?: string;
  notes?: string;
  dueDate?: string;
  projectId?: string;
  stateOfSupplyCode?: string;
  customValues?: Record<string, unknown>;
  lines: EditableLine[];
  attachments?: Array<{id:string;displayName:string;mimeType:string;sizeBytes:number}>;
};
