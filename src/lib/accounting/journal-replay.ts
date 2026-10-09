import { Prisma } from "@prisma/client";
type Line = {
  ledgerAccountId: string;
  costCentreId?: string | null;
  debit: Prisma.Decimal | string;
  credit: Prisma.Decimal | string;
  description?: string | null;
};
type Values = {
  financialYearId: string;
  branchId: string;
  entryDate: Date;
  reference?: string | null;
  narration?: string | null;
  lines: Line[];
};
export function journalMatchesInput(saved: Values, input: Values) {
  if (
    saved.financialYearId !== input.financialYearId ||
    saved.branchId !== input.branchId ||
    saved.entryDate.toISOString().slice(0, 10) !==
      input.entryDate.toISOString().slice(0, 10) ||
    (saved.reference ?? "") !== (input.reference ?? "") ||
    (saved.narration ?? "") !== (input.narration ?? "") ||
    saved.lines.length !== input.lines.length
  )
    return false;
  return saved.lines.every((line, i) => {
    const other = input.lines[i];
    return (
      line.ledgerAccountId === other.ledgerAccountId &&
      (line.costCentreId ?? "") === (other.costCentreId ?? "") &&
      (line.description ?? "") === (other.description ?? "") &&
      new Prisma.Decimal(line.debit).equals(other.debit) &&
      new Prisma.Decimal(line.credit).equals(other.credit)
    );
  });
}
