BEGIN;
-- Recovery uses an administrator-confirmed, company-scoped transaction.
-- Normal writes retain all trigger checks and immediate referential checking.
-- RESTRICT is changed to equivalent immediate NO ACTION so ONLY a restore
-- transaction can explicitly defer checks while replacing cyclic history.
DO $restore_constraints$
DECLARE c record; definition text; selected_tables text[] := ARRAY['project_material_movements','branches','attendances','customers','customer_visits','leads','follow_up_tasks','visit_photos','lead_deletion_audits','lead_activities','location_points','sales_notifications','geofence_events','sales_targets','daily_travel_approvals','employee_compensation_profiles','employee_advances','employee_reimbursements','salary_history_links','account_settings','authorized_signature_versions','financial_years','numbering_series','vendors','account_units','account_categories','account_products','account_services','work_categories','work_packages','custom_field_definitions','custom_field_values','account_import_jobs','account_recycle_records','print_templates','account_terms_templates','ledger_accounts','cost_centres','journal_entries','journal_lines','accounting_period_locks','accounting_audit_events','quotation_documents','quotation_revisions','quotation_lines','quotation_adjustments','quotation_payment_schedules','quotation_shares','quotation_audit_events','commercial_documents','commercial_attachments','service_reminder_completions','commercial_document_lines','purchase_line_allocations','account_settlements','settlement_allocations','party_opening_balances','opening_balance_allocations','advance_applications','payment_reminders','commercial_audit_events','projects','project_members','project_budget_lines','project_milestones','project_tasks','project_documents','project_audit_events','project_change_orders','expense_categories','expense_transactions','recurring_expense_templates','expense_attachments','money_accounts','money_transfers','money_transfer_images','cheques','owner_financial_accounts','loans','loan_operations','loan_payments','account_operational_audits','asset_funding_confirmations','asset_owner_fundings','asset_owner_funding_cancellations','owner_asset_funding_returns','owner_transactions','warehouses','inventory_batches','inventory_serial_numbers','stock_movements','product_prices','assets','asset_assignment_history','field_jobs','expense_items','account_report_favourites','quotation_attachments','sale_return_revisions','sale_revision_credits','sale_revision_credit_lines','sale_lifecycle_snapshots']::text[];
BEGIN
 FOR c IN SELECT con.oid, con.conname, con.condeferred, child.relname AS child_name
  FROM pg_constraint con JOIN pg_class child ON child.oid=con.conrelid
  JOIN pg_class parent ON parent.oid=con.confrelid
  JOIN pg_namespace ns ON ns.oid=child.relnamespace
  WHERE con.contype='f' AND ns.nspname='public'
    AND (child.relname=ANY(selected_tables) OR parent.relname=ANY(selected_tables))
 LOOP
  definition:=pg_get_constraintdef(c.oid);
  definition:=replace(replace(definition,'ON DELETE RESTRICT','ON DELETE NO ACTION'),'ON UPDATE RESTRICT','ON UPDATE NO ACTION');
  definition:=regexp_replace(definition,' DEFERRABLE( INITIALLY (DEFERRED|IMMEDIATE))?','', 'g');
  definition:=replace(definition,' NOT DEFERRABLE','');
  EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I',c.child_name,c.conname);
  EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I %s DEFERRABLE INITIALLY %s',c.child_name,c.conname,definition, CASE WHEN c.condeferred THEN 'DEFERRED' ELSE 'IMMEDIATE' END);
 END LOOP;
END $restore_constraints$;

DO $restore_guards$
DECLARE f record; body text; definition text; selected_tables text[] := ARRAY['project_material_movements','branches','attendances','customers','customer_visits','leads','follow_up_tasks','visit_photos','lead_deletion_audits','lead_activities','location_points','sales_notifications','geofence_events','sales_targets','daily_travel_approvals','employee_compensation_profiles','employee_advances','employee_reimbursements','salary_history_links','account_settings','authorized_signature_versions','financial_years','numbering_series','vendors','account_units','account_categories','account_products','account_services','work_categories','work_packages','custom_field_definitions','custom_field_values','account_import_jobs','account_recycle_records','print_templates','account_terms_templates','ledger_accounts','cost_centres','journal_entries','journal_lines','accounting_period_locks','accounting_audit_events','quotation_documents','quotation_revisions','quotation_lines','quotation_adjustments','quotation_payment_schedules','quotation_shares','quotation_audit_events','commercial_documents','commercial_attachments','service_reminder_completions','commercial_document_lines','purchase_line_allocations','account_settlements','settlement_allocations','party_opening_balances','opening_balance_allocations','advance_applications','payment_reminders','commercial_audit_events','projects','project_members','project_budget_lines','project_milestones','project_tasks','project_documents','project_audit_events','project_change_orders','expense_categories','expense_transactions','recurring_expense_templates','expense_attachments','money_accounts','money_transfers','money_transfer_images','cheques','owner_financial_accounts','loans','loan_operations','loan_payments','account_operational_audits','asset_funding_confirmations','asset_owner_fundings','asset_owner_funding_cancellations','owner_asset_funding_returns','owner_transactions','warehouses','inventory_batches','inventory_serial_numbers','stock_movements','product_prices','assets','asset_assignment_history','field_jobs','expense_items','account_report_favourites','quotation_attachments','sale_return_revisions','sale_revision_credits','sale_revision_credit_lines','sale_lifecycle_snapshots']::text[];
BEGIN
 FOR f IN SELECT DISTINCT p.oid,p.prosrc FROM pg_trigger t
  JOIN pg_class tab ON tab.oid=t.tgrelid
  JOIN pg_namespace ns ON ns.oid=tab.relnamespace
  JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_language l ON l.oid=p.prolang
  WHERE NOT t.tgisinternal AND ns.nspname='public'
    AND tab.relname=ANY(selected_tables) AND l.lanname='plpgsql'
 LOOP
  IF position('app.company_restore_company_id' in f.prosrc)>0 THEN CONTINUE; END IF;
  body:=regexp_replace(f.prosrc,'\mBEGIN\M', $guard$BEGIN
  IF current_setting('app.company_restore_company_id',true) IS NOT NULL
     AND current_setting('app.company_restore_company_id',true) <> ''
     AND current_setting('app.company_restore_company_id',true) =
       (CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD)->>'companyId' ELSE to_jsonb(NEW)->>'companyId' END)
  THEN
    IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
$guard$,'i');
  IF body=f.prosrc THEN RAISE EXCEPTION 'RESTORE_GUARD_UNSUPPORTED_FUNCTION'; END IF;
  definition:=replace(pg_get_functiondef(f.oid),f.prosrc,body);
  EXECUTE definition;
 END LOOP;
END $restore_guards$;

COMMIT;
