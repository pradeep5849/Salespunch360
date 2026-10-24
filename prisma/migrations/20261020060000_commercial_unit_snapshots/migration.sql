-- Additive only. Historical rows are deliberately not backfilled or reinterpreted.
ALTER TABLE "commercial_document_lines" ADD COLUMN "baseQuantity" DECIMAL(18,4), ADD COLUMN "unitConversionSnapshot" JSONB;
ALTER TABLE "purchase_line_allocations" ADD COLUMN "baseQuantity" DECIMAL(18,4);

CREATE FUNCTION valid_commercial_unit_snapshot(snapshot JSONB, entered NUMERIC, base NUMERIC)
RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE ratio NUMERIC;
BEGIN
 IF snapshot IS NULL THEN RETURN base IS NULL OR base=entered; END IF;
 IF base IS NULL OR base<=0 OR jsonb_typeof(snapshot)<>'object' THEN RETURN FALSE; END IF;
 IF NOT snapshot ?& ARRAY['version','selection','primaryUnitId','secondaryUnitId','secondaryUnitsPerBase','unitName','unitSymbol'] THEN RETURN FALSE; END IF;
 IF jsonb_typeof(snapshot->'version')<>'number' OR snapshot->>'version'<>'1'
  OR jsonb_typeof(snapshot->'selection')<>'string' OR snapshot->>'selection' NOT IN ('PRIMARY','SECONDARY')
  OR jsonb_typeof(snapshot->'primaryUnitId')<>'string' OR jsonb_typeof(snapshot->'secondaryUnitId')<>'string'
  OR jsonb_typeof(snapshot->'secondaryUnitsPerBase')<>'string'
  OR jsonb_typeof(snapshot->'unitName')<>'string' OR length(snapshot->>'unitName')>80
  OR jsonb_typeof(snapshot->'unitSymbol')<>'string' OR length(snapshot->>'unitSymbol')>20
  OR (snapshot->>'secondaryUnitsPerBase') !~ '^[0-9]{1,14}(\.[0-9]{1,4})?$'
 THEN RETURN FALSE; END IF;
 IF (snapshot->>'primaryUnitId')::uuid=(snapshot->>'secondaryUnitId')::uuid THEN RETURN FALSE; END IF;
 ratio=(snapshot->>'secondaryUnitsPerBase')::numeric;
 IF ratio<=0 THEN RETURN FALSE; END IF;
 RETURN COALESCE(CASE WHEN snapshot->>'selection'='PRIMARY' THEN base=entered ELSE base*ratio=entered END,FALSE);
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN FALSE;
END $$;

ALTER TABLE "commercial_document_lines" ADD CONSTRAINT "commercial_line_unit_snapshot_valid"
 CHECK (valid_commercial_unit_snapshot("unitConversionSnapshot","quantity","baseQuantity"));
ALTER TABLE "purchase_line_allocations" ADD CONSTRAINT "purchase_allocation_base_quantity_positive"
 CHECK ("baseQuantity" IS NULL OR "baseQuantity">0);
-- Existing financial-history guards cover the new columns automatically.
