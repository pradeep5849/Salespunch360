-- Do not reconstruct old supply context from mutable customer addresses.
-- Existing full-row quotation revision immutability protects this field.
ALTER TABLE "quotation_revisions" ADD COLUMN "stateOfSupplyCode" VARCHAR(2);
