-- Optional transfer context; preserve all historical amounts and journals.
ALTER TABLE "money_transfers" ADD COLUMN "description" VARCHAR(2000);
