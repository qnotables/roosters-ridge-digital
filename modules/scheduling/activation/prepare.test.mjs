import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { splitSql, sqlBody, transactionStatements, prepare, parseOptions, pinnedMigrations, environmentChecks, productionBranch, productionCompute } from './prepare.mjs'
const staging={target:'staging',branch:'br-approved-rehearsal',compute:'ep-approved-rehearsal',database:'neondb'}
const production={target:'production',branch:productionBranch,compute:productionCompute,database:'neondb'}

test('SQL framing respects comments, quoted identifiers, strings and nested dollar bodies',()=>{
  const source="-- header;\nBEGIN; /* x; /* nested; */ */ SELECT 'it''s; fine', \"a;b\"; DO $outer$ BEGIN PERFORM ';'; EXECUTE $inner$select 1;$inner$; END; $outer$; COMMIT; -- tail;"
  assert.equal(splitSql(source).length,4)
  const body=transactionStatements(source)
  assert.equal(body.length,4)
  assert.match(body[3],/END; \$outer\$/)
  assert.equal(sqlBody('/* a /* b */ c */ -- line\nBEGIN;'),'BEGIN;')
})
test('unterminated or unreviewed SQL and transaction boundaries fail closed',()=>{
  for(const sql of ["SELECT 'x",'DO $x$ BEGIN;','/* broken']) assert.throws(()=>splitSql(sql))
  assert.throws(()=>splitSql("SELECT E'\\n'"))
  assert.throws(()=>transactionStatements('BEGIN; SELECT 1;'))
  assert.throws(()=>transactionStatements('ROLLBACK;'))
})
test('every pinned migration has matching working tree and source checksum',()=>{
  for(const release of ['private','newer','sandbox']){
    const manifest=pinnedMigrations(release)
    assert.equal(manifest.length,{private:6,newer:9,sandbox:10}[release])
    for(const migration of manifest) assert.ok(migration.sql_statements.length>2)
  }
})
test('function bodies remain a single tool statement',()=>{
  const migration=pinnedMigrations('newer')
  assert.equal(migration[6].sql_statements.length,3)
  assert.equal(migration[8].sql_statements.length,3)
  assert.equal(migration[3].sql_statements.filter(s=>sqlBody(s).startsWith('CREATE FUNCTION')).length,1)
  assert.match(migration[3].sql_statements.find(s=>sqlBody(s).startsWith('CREATE FUNCTION')),/RETURN NEW;/)
})
test('targets cannot be inferred or mislabeled as isolated',()=>{
  assert.throws(()=>prepare({mode:'preflight'}))
  assert.throws(()=>prepare({...production,target:'staging',mode:'preflight'}))
  assert.throws(()=>prepare({...staging,target:'production',mode:'preflight'}))
  assert.throws(()=>prepare({...staging,database:'other',mode:'preflight'}))
})
test('production packets are unexecuted and exclude isolated migration 010',()=>{
  const packet=prepare({...production,mode:'migrations',release:'private',baseline:'empty'})
  assert.equal(packet.requests.length,6)
  assert.equal(packet.status,'PREPARED_NOT_EXECUTED')
  assert.ok(packet.requests.every(r=>r.tool==='neon_run_sql_transaction'&&r.arguments.branch_id===productionBranch))
  assert.throws(()=>prepare({...production,mode:'migrations',release:'sandbox',baseline:'empty'}))
  assert.throws(()=>prepare({...production,mode:'migrations',release:'private',baseline:'006'}))
  assert.equal(prepare({...staging,mode:'migrations',release:'newer',baseline:'006'}).requests.length,3)
})
test('bootstrap inputs are bounded, approved and prepared as PostgreSQL parameters',()=>{
  const input={...staging,mode:'bootstrap',user:'00000000-0000-4000-8000-000000000001',host:'00000000-0000-4000-8000-000000000002',role:'admin',approval:'isolated-review-001'}
  assert.throws(()=>prepare({...input,role:'platform_admin'}))
  assert.throws(()=>prepare({...input,user:"';DROP SCHEMA x;--"}))
  assert.throws(()=>prepare({...input,approval:'unapproved identity'}))
  const statements=prepare(input).requests[0].arguments.sql_statements
  assert.equal(statements.length,6)
  assert.match(statements[3],/\$1,\$2,\$3,\$4/)
  assert.equal(statements[5],'DEALLOCATE rrd_activation_bootstrap')
})
test('preflight statements are catalog SELECTs, never customer/session records',()=>{
  const packet=prepare({...staging,mode:'preflight'})
  assert.equal(packet.requests.length,11)
  for(const request of packet.requests) assert.match(sqlBody(request.arguments.sql),/^SELECT\b/)
  assert.ok(packet.requests.every(r=>!r.arguments.sql.includes('FROM neon_auth."session"')))
})
test('bootstrap static safety invariants are present, not a database execution claim',()=>{
  const source=readFileSync(new URL('./bootstrap.sql',import.meta.url),'utf8')
  assert.equal(splitSql(source).length,1)
  for(const marker of ['pg_advisory_xact_lock','FOR UPDATE','ON CONFLICT','changes>0','Existing member privilege/status conflict','Existing host configuration/ownership mismatch','Platform enrollment is outside bootstrap scope']) assert.ok(source.includes(marker))
  assert.doesNotMatch(source,/DROP\s+(?:SCHEMA|TABLE)|SET\s+enabled\s*=\s*true/i)
})
test('environment evidence exposes booleans only and rejects short keys and wrong mappings',()=>{
  const checks=environmentChecks({DATABASE_URL:'postgresql://user:private@wrong.invalid/neondb',NEON_AUTH_COOKIE_SECRET:'short',ADMIN_DASHBOARD_KEY:'short'},productionCompute)
  assert.ok(checks.every(c=>!c.valid))
  assert.ok(!JSON.stringify(checks).includes('private'))
  const good=environmentChecks({DATABASE_URL:`postgresql://user:private@${productionCompute}-pooler.c-10.us-east-1.aws.neon.tech/neondb`,NEON_AUTH_COOKIE_SECRET:'a'.repeat(32),ADMIN_DASHBOARD_KEY:'b'.repeat(32)},productionCompute)
  assert.ok(good.filter(c=>c.present).every(c=>c.valid))
})
test('runbook manifest and generated single-statement packets remain consistent',()=>{
  const runbook=readFileSync(new URL('../ACTIVATION_RUNBOOK.md',import.meta.url),'utf8')
  for(const migration of pinnedMigrations('sandbox')) {
    assert.ok(runbook.includes(migration.sha256))
    assert.ok(runbook.includes(migration.path.split('/').at(-1)))
    for(const statement of migration.sql_statements) assert.equal(splitSql(statement).length,1)
  }
  const source=readFileSync(new URL('./prepare.mjs',import.meta.url),'utf8')
  assert.doesNotMatch(source,/from ['"](?:pg|@neondatabase|node:https|node:http|node:net)|fetch\(/)
  const bootstrap=readFileSync(new URL('./bootstrap.sql',import.meta.url),'utf8')
  assert.match(bootstrap,/CREATE OR REPLACE FUNCTION pg_temp/)
  assert.ok(bootstrap.indexOf('Existing member privilege/status conflict')>bootstrap.indexOf('ON CONFLICT(tenant_id,user_id)'))
  assert.ok(bootstrap.includes('c.policies<>expected_policies'))
})
test('unknown and duplicated CLI options fail closed',()=>{
  assert.throws(()=>parseOptions(['--execute','true']))
  assert.throws(()=>parseOptions(['--mode','preflight','--mode','bootstrap']))
  assert.throws(()=>parseOptions(['--target']))
})
