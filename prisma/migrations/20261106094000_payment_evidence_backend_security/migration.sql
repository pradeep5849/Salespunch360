-- Evidence is backend-only. Browser-facing Supabase roles receive no policies.
-- The Prisma owner/service role retains the existing application authorization path.
ALTER TABLE public.payment_attachments ENABLE ROW LEVEL SECURITY;
ALTER FUNCTION public.guard_payment_attachment_history() SET search_path = '';
ALTER FUNCTION public.guard_payment_billing_history() SET search_path = '';
REVOKE ALL ON FUNCTION public.guard_payment_attachment_history() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_payment_billing_history() FROM PUBLIC;
DO $$ DECLARE r text; BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=r) THEN
   EXECUTE format('REVOKE ALL ON TABLE public.payment_attachments FROM %I',r);
   EXECUTE format('REVOKE ALL ON FUNCTION public.guard_payment_attachment_history() FROM %I',r);
   EXECUTE format('REVOKE ALL ON FUNCTION public.guard_payment_billing_history() FROM %I',r);
  END IF;
 END LOOP;
END $$;
