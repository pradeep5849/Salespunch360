-- Application objects are backend-only: Web uses Prisma; Android uses the authenticated application API.
-- Forward-only hardening. No RLS, user, credential, business row, provider auth/storage, or service_role changes.
-- Review the actual deployment connection role and Data API consumers before approving production execution.
SET lock_timeout = '5s';
SET statement_timeout = '60s';
DO $hardening$
DECLARE obj record; api_role text;
BEGIN
  IF current_user IN ('anon','authenticated','service_role','authenticator') THEN
    RAISE EXCEPTION 'Backend migration owner connection required';
  END IF;
  FOR obj IN SELECT c.oid::regclass AS identity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname=ANY(ARRAY['_prisma_migrations', 'account_backup_records', 'account_categories', 'account_import_jobs', 'account_operational_audits', 'account_products', 'account_recycle_records', 'account_report_favourites', 'account_services', 'account_settings', 'account_settlements', 'account_terms_templates', 'account_units', 'accounting_audit_events', 'accounting_period_locks', 'advance_applications', 'asset_assignment_history', 'asset_funding_confirmations', 'asset_owner_funding_cancellations', 'asset_owner_fundings', 'assets', 'attendances', 'authorized_signature_versions', 'billing_audit_events', 'billing_orders', 'billing_prices', 'branches', 'cheques', 'commercial_attachments', 'commercial_audit_events', 'commercial_document_lines', 'commercial_documents', 'companies', 'company_subscriptions', 'cost_centres', 'custom_field_definitions', 'custom_field_values', 'customer_visits', 'customers', 'daily_travel_approvals', 'email_verification_tokens', 'employee_advances', 'employee_compensation_profiles', 'employee_reimbursements', 'expense_attachments', 'expense_categories', 'expense_items', 'expense_transactions', 'field_jobs', 'financial_years', 'follow_up_tasks', 'geofence_events', 'inventory_batches', 'inventory_serial_numbers', 'journal_entries', 'journal_lines', 'lead_activities', 'lead_calls', 'lead_deletion_audits', 'lead_sales_actions', 'leads', 'ledger_accounts', 'loan_operations', 'loan_payments', 'loans', 'location_points', 'mobile_device_bindings', 'mobile_sessions', 'money_accounts', 'money_transfer_images', 'money_transfers', 'numbering_series', 'opening_balance_allocations', 'owner_asset_funding_returns', 'owner_financial_accounts', 'owner_transactions', 'party_opening_balances', 'payment_reminders', 'payment_transactions', 'pending_storage_deletions', 'print_templates', 'product_prices', 'project_audit_events', 'project_budget_lines', 'project_change_orders', 'project_documents', 'project_material_movements', 'project_members', 'project_milestones', 'project_tasks', 'projects', 'public_blog_posts', 'public_site_settings', 'public_testimonials', 'public_video_tutorials', 'purchase_line_allocations', 'push_devices', 'quotation_adjustments', 'quotation_attachments', 'quotation_audit_events', 'quotation_documents', 'quotation_lines', 'quotation_payment_schedules', 'quotation_revisions', 'quotation_shares', 'rate_limit_buckets', 'recurring_expense_templates', 'salary_history_links', 'sale_lifecycle_snapshots', 'sale_return_revisions', 'sale_revision_credit_lines', 'sale_revision_credits', 'sales_notifications', 'sales_targets', 'service_reminder_completions', 'sessions', 'settlement_allocations', 'stock_movements', 'telecaller_billing_orders', 'telecaller_subscriptions', 'user_branch_accesses', 'users', 'vendors', 'visit_photos', 'warehouses', 'work_categories', 'work_packages']::text[])
  LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE %s FROM PUBLIC',obj.identity);
    FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=api_role) THEN
        EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE %s FROM %I',obj.identity,api_role);
      END IF;
    END LOOP;
  END LOOP;
  -- The reviewed application uses UUID identities and has no public owned sequences.
  -- Do not revoke privileges on unknown/provider sequences.
  FOR obj IN SELECT p.oid::regprocedure AS identity FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname=ANY(ARRAY['check_project_material_insert_scope', 'check_sale_attachment_append_complete', 'enforce_paid_telecaller_seat', 'guard_commercial_attachment_history', 'guard_commercial_line_history', 'guard_loan_operation_history', 'guard_posted_loan_origin', 'guard_receipt_credit_journal_reversal', 'guard_retained_return_journal_reversal', 'guard_sale_lifecycle_audit', 'guard_sale_lifecycle_journal', 'guard_sale_return_revision_history', 'guard_sale_revision_advance_source', 'guard_settlement_allocation_insert', 'guard_settlement_update', 'prevent_billing_audit_mutation', 'prevent_branch_company_id_change', 'prevent_company_id_change', 'prevent_financial_history_mutation', 'prevent_geofence_event_mutation', 'prevent_lead_activity_mutation', 'prevent_paid_order_snapshot_mutation', 'prevent_project_material_mutation', 'prevent_quotation_audit_mutation', 'protect_accounting_audit', 'protect_commercial_quotation_source', 'protect_journal_lifecycle', 'protect_journal_lines', 'protect_order_line_source', 'protect_order_source_identity', 'protect_party_transfer_history', 'protect_posted_journal_delete', 'protect_quotation_child', 'protect_quotation_conversion_closure', 'protect_quotation_document_lifecycle', 'protect_quotation_revision', 'protect_sale_attachment_append_audit', 'require_posted_quotation_closure', 'valid_commercial_unit_snapshot', 'validate_advance_application_credit', 'validate_attendance_tenant', 'validate_customer_visit_tenant', 'validate_existing_user_branch_access_on_user_change', 'validate_follow_up_task_completed_visit', 'validate_location_tenant', 'validate_receipt_advance_credit', 'validate_receipt_credit_date', 'validate_sale_lifecycle_snapshot', 'validate_sale_return_revision', 'validate_sale_revision_credit', 'validate_sale_revision_credit_line', 'validate_user_branch_access', 'validate_user_manager']::text[]) AND NOT EXISTS
      (SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
  LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON FUNCTION %s FROM PUBLIC',obj.identity);
    FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=api_role) THEN
        EXECUTE format('REVOKE ALL PRIVILEGES ON FUNCTION %s FROM %I',obj.identity,api_role);
      END IF;
    END LOOP;
  END LOOP;
  -- Change only reviewed functions with mutable search_path; preserve bodies, signatures and invoker security.
  FOR obj IN SELECT p.oid::regprocedure AS identity FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname=ANY(ARRAY['check_project_material_insert_scope', 'check_sale_attachment_append_complete', 'enforce_paid_telecaller_seat', 'guard_commercial_attachment_history', 'guard_commercial_line_history', 'guard_loan_operation_history', 'guard_posted_loan_origin', 'guard_receipt_credit_journal_reversal', 'guard_retained_return_journal_reversal', 'guard_sale_lifecycle_audit', 'guard_sale_lifecycle_journal', 'guard_sale_return_revision_history', 'guard_sale_revision_advance_source', 'guard_settlement_allocation_insert', 'guard_settlement_update', 'prevent_branch_company_id_change', 'prevent_company_id_change', 'prevent_financial_history_mutation', 'prevent_paid_order_snapshot_mutation', 'prevent_project_material_mutation', 'prevent_quotation_audit_mutation', 'protect_accounting_audit', 'protect_commercial_quotation_source', 'protect_journal_lifecycle', 'protect_journal_lines', 'protect_order_line_source', 'protect_order_source_identity', 'protect_party_transfer_history', 'protect_posted_journal_delete', 'protect_quotation_child', 'protect_quotation_conversion_closure', 'protect_quotation_document_lifecycle', 'protect_quotation_revision', 'protect_sale_attachment_append_audit', 'require_posted_quotation_closure', 'valid_commercial_unit_snapshot', 'validate_advance_application_credit', 'validate_attendance_tenant', 'validate_customer_visit_tenant', 'validate_existing_user_branch_access_on_user_change', 'validate_location_tenant', 'validate_receipt_advance_credit', 'validate_receipt_credit_date', 'validate_sale_lifecycle_snapshot', 'validate_sale_return_revision', 'validate_sale_revision_credit', 'validate_sale_revision_credit_line', 'validate_user_branch_access', 'validate_user_manager']::text[]) AND NOT p.prosecdef
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path TO pg_catalog, public, pg_temp',obj.identity);
  END LOOP;
  -- Defaults for objects created by this application's migration owner only. Preserve provider/service grants.
  EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC';
  -- PostgreSQL adds PUBLIC EXECUTE globally; per-schema REVOKE cannot subtract that default.
  -- Change only the migration owner's global default for FUTURE functions, not any existing provider function.
  EXECUTE 'ALTER DEFAULT PRIVILEGES REVOKE ALL ON FUNCTIONS FROM PUBLIC';
  EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC';
  FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=api_role) THEN
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I',api_role);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I',api_role);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I',api_role);
    END IF;
  END LOOP;
END
$hardening$;
RESET lock_timeout;
RESET statement_timeout;
