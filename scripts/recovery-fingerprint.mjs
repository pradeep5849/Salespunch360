export async function fingerprint(reader) {
  const tables =
    await reader.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`;
  const rows = [];
  for (const { tablename } of tables) {
    const identifier = '"' + tablename.replaceAll('"', '""') + '"';
    const [value] = await reader.$queryRawUnsafe(
      `SELECT count(*)::text AS count, md5(COALESCE(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) AS digest FROM public.${identifier} t`,
    );
    rows.push({ table: tablename, count: value.count, digest: value.digest });
  }
  const schema = await reader.$queryRaw`SELECT kind,name,definition FROM (
    SELECT CASE WHEN c.contype='c' THEN 'check' ELSE 'constraint' END AS kind,c.conrelid::regclass::text||':'||c.conname AS name,CASE WHEN c.contype='c' THEN c.convalidated::text ELSE pg_get_constraintdef(c.oid,true)||':'||c.convalidated::text END AS definition FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public'
    UNION ALL SELECT 'index',indexname,indexdef FROM pg_indexes WHERE schemaname='public'
    UNION ALL SELECT 'trigger',t.tgrelid::regclass::text||':'||t.tgname,pg_get_triggerdef(t.oid)||':'||t.tgenabled::text FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal
    UNION ALL SELECT 'function',p.oid::regprocedure::text,pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind IN ('f','p')
    -- Dropped physical columns leave ordinal gaps that pg_dump omits. Compare
    -- active column order, not those non-semantic internal position numbers.
    UNION ALL SELECT 'column',table_name||':'||column_name,jsonb_build_array(row_number() OVER (PARTITION BY table_schema,table_name ORDER BY ordinal_position),data_type,udt_schema,udt_name,is_nullable,column_default,character_maximum_length,numeric_precision,numeric_scale,datetime_precision,is_identity,identity_generation,is_generated,generation_expression,collation_schema,collation_name)::text FROM information_schema.columns WHERE table_schema='public'
    UNION ALL SELECT 'enum',t.typname||':'||e.enumsortorder::text,e.enumlabel FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public'
    UNION ALL SELECT 'policy',tablename||':'||policyname,jsonb_build_array(permissive,roles,cmd,qual,with_check)::text FROM pg_policies WHERE schemaname='public'
    UNION ALL SELECT 'table-security',c.relname,c.relrowsecurity::text||':'||c.relforcerowsecurity::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p')
    UNION ALL SELECT 'view',c.relname,pg_get_viewdef(c.oid,true) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('v','m')
    UNION ALL SELECT 'sequence',sequencename,jsonb_build_array(data_type,start_value,min_value,max_value,increment_by,cycle,cache_size)::text FROM pg_sequences WHERE schemaname='public'

  ) objects ORDER BY kind,name,definition`;
  // A dump/reparse can flatten ANDs and distribute an array's text cast.
  // Ask PostgreSQL's own planner to canonicalize each CHECK expression instead
  // of stripping parentheses/casts with an unsafe text approximation. EXPLAIN
  // without ANALYZE does not scan table rows or execute the SELECT.
  const checks =
    await reader.$queryRaw`SELECT c.conrelid::regclass::text||':'||c.conname AS name,t.relname AS tablename,pg_get_expr(c.conbin,c.conrelid,true) AS expression FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' AND c.contype='c'`;
  for (const check of checks) {
    const identifier = '"' + check.tablename.replaceAll('"', '""') + '"';
    const plan = await reader.$queryRawUnsafe(
      `EXPLAIN (VERBOSE, FORMAT JSON, COSTS FALSE) SELECT (${check.expression}) FROM public.${identifier} LIMIT 0`,
    );
    const output = plan[0]?.["QUERY PLAN"]?.[0]?.Plan?.Output;
    if (!Array.isArray(output) || output.length !== 1)
      throw new Error("CHECK expression canonicalization failed.");
    const object = schema.find(
      (row) => row.kind === "check" && row.name === check.name,
    );
    if (!object) throw new Error("CHECK object missing.");
    object.definition += ":" + JSON.stringify(output);
  }
  return { rows, schema };
}
export function assertRestoredState(expected, actual) {
  if (JSON.stringify(expected) !== JSON.stringify(actual))
    throw new Error("Restored data or integrity objects differ.");
}
