import type { EditableLine } from "@/app/workspace/account/transactions/new/commercial-editor";

/** Invoice snapshots used by the shared Add/Edit Sale form. */
export type SaleEditInitial = {
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
  customerPoNumber?: string;
  customerPoDate?: string;
  transactionTime?: string;
  ewayBillNumber?: string;
  notes?: string;
  dueDate?: string;
  projectId?: string;
  stateOfSupplyCode?: string;
  customValues?: Record<string, unknown>;
  lines: EditableLine[];
};
