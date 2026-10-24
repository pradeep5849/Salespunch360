-- An immutable financial source snapshot, keyed by the client request UUID.
CREATE UNIQUE INDEX "party_transfer_posted_request_key"
ON "account_operational_audits" ("companyId", "entityId")
WHERE "entityType"='PARTY_TRANSFER' AND "eventType"='PARTY_TRANSFER_POSTED';

ALTER TABLE "account_operational_audits" ADD CONSTRAINT "party_transfer_snapshot_amounts"
CHECK (CASE WHEN "entityType"='PARTY_TRANSFER' AND "eventType"='PARTY_TRANSFER_POSTED' THEN COALESCE(
 jsonb_typeof(metadata)='object'
 AND metadata->>'commissionHead'='OTHER_INCOME'
 AND metadata->>'expenseAmount'='0.00'
 AND metadata->>'receivedAmount' ~ '^[0-9]{1,16}\.[0-9]{2}$'
 AND metadata->>'paidAmount' ~ '^[0-9]{1,16}\.[0-9]{2}$'
 AND metadata->>'commissionAmount' ~ '^[0-9]{1,16}\.[0-9]{2}$'
 AND metadata->>'passThroughAmount' ~ '^[0-9]{1,16}\.[0-9]{2}$'
 AND (metadata->>'passThroughAmount')::numeric=(metadata->>'paidAmount')::numeric
 AND (metadata->>'receivedAmount')::numeric>0
 AND (metadata->>'paidAmount')::numeric>=0
 AND (metadata->>'receivedAmount')::numeric>=(metadata->>'paidAmount')::numeric
 AND (metadata->>'commissionAmount')::numeric=(metadata->>'receivedAmount')::numeric-(metadata->>'paidAmount')::numeric
 ,false) ELSE true END);

CREATE FUNCTION protect_party_transfer_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD."entityType"='PARTY_TRANSFER' AND OLD."eventType" IN ('PARTY_TRANSFER_POSTED','PARTY_TRANSFER_REVERSED') THEN
  IF TG_OP='DELETE' AND current_setting('app.account_cleanup_company_id',true)=OLD."companyId"::text THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'PARTY_TRANSFER_HISTORY_IMMUTABLE';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "party_transfer_history_immutable" BEFORE UPDATE OR DELETE
ON "account_operational_audits" FOR EACH ROW EXECUTE FUNCTION protect_party_transfer_history();
