CREATE OR REPLACE FUNCTION public.prevent_lead_activity_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND current_setting('app.tenant_cleanup_company_id', true) = OLD."companyId"::text
  THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'lead activity is append-only';
END;
$$;

-- These existing append-only event/audit triggers would otherwise be the next
-- guaranteed tenant-purge blockers. They use the same row-scoped local gate.
CREATE OR REPLACE FUNCTION public.prevent_geofence_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND current_setting('app.tenant_cleanup_company_id', true) = OLD."companyId"::text
  THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'geofence events are append-only';
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_billing_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND current_setting('app.tenant_cleanup_company_id', true) = OLD."companyId"::text
  THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'billing audit is append-only';
END;
$$;
