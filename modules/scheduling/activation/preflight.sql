SELECT current_database() AS database, current_user AS inspection_role, current_setting('server_version') AS postgres_version, now() AS checked_at, pg_current_wal_lsn() AS current_lsn, to_regnamespace('rrd_scheduling') IS NOT NULL AS scheduling_schema_exists;

SELECT extname,extversion FROM pg_extension ORDER BY extname;

SELECT name,version,installed,superuser,trusted FROM pg_available_extension_versions WHERE name='btree_gist' ORDER BY version;

SELECT has_database_privilege(current_user,current_database(),'CREATE') AS can_create_schema, has_schema_privilege(current_user,'public','USAGE') AS can_use_public, has_table_privilege(current_user,'public.leads','SELECT,REFERENCES') AS lead_privileges, has_table_privilege(current_user,'public.email_suppressions','SELECT') AS suppression_privileges;

SELECT table_schema,table_name,column_name,data_type,udt_name,is_nullable,column_default,is_generated,generation_expression FROM information_schema.columns WHERE table_schema='rrd_scheduling' OR (table_schema='public' AND table_name IN ('leads','email_suppressions')) OR (table_schema='neon_auth' AND table_name='user' AND column_name IN ('id','emailVerified')) ORDER BY table_schema,table_name,ordinal_position;

SELECT n.nspname AS schema,c.relname AS relation,x.conname,x.contype,x.convalidated,pg_get_constraintdef(x.oid) AS definition FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rrd_scheduling' OR (n.nspname='public' AND c.relname IN ('leads','email_suppressions')) ORDER BY n.nspname,c.relname,x.conname;

SELECT n.nspname,c.relname AS relation,i.relname AS index_name,x.indisvalid,x.indisready,pg_get_indexdef(i.oid) AS definition FROM pg_index x JOIN pg_class c ON c.oid=x.indrelid JOIN pg_class i ON i.oid=x.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rrd_scheduling' OR (n.nspname='public' AND c.relname='leads') ORDER BY n.nspname,c.relname,i.relname;

SELECT c.relname AS relation,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rrd_scheduling' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname;

SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='rrd_scheduling' ORDER BY p.proname;

SELECT table_schema,table_name FROM information_schema.tables WHERE table_schema='rrd_scheduling' OR table_name ILIKE '%migration%' ORDER BY table_schema,table_name;

SELECT rolname,rolsuper,rolcreaterole,rolcreatedb FROM pg_roles WHERE rolname=current_user;
