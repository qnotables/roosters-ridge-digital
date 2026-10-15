import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { splitSql, sqlBody, transactionStatements, prepare, parseOptions, pinnedMigrations, environmentChecks, productionBranch, productionCompute, releases, validateMembershipEvidence, validateTarget, sha256, verifyMigrationBytes } from './prepare.mjs'
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
  for(const release of ['current-production','private','newer','sandbox']){
    const manifest=pinnedMigrations(release)
    assert.equal(manifest.length,{'current-production':9,private:6,newer:9,sandbox:10}[release])
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
  const packet=prepare({...production,mode:'migrations',release:'current-production',baseline:'empty'})
  assert.equal(packet.requests.length,9)
  assert.equal(packet.source_commit,'d59e011106aade4ebf287aa9d714029f24614b58')
  assert.equal(packet.historical,false)
  assert.equal(packet.status,'PREPARED_NOT_EXECUTED')
  assert.equal(packet.approval,'SEPARATE_EXECUTION_APPROVAL_REQUIRED')
  assert.ok(packet.requests.every(r=>r.tool==='neon_run_sql_transaction'&&r.arguments.branch_id===productionBranch&&!r.path.includes('010_')))
  for(const release of ['private','newer','sandbox',undefined,'toString','__proto__']) assert.throws(()=>prepare({...production,mode:'migrations',release,baseline:'empty'}))
  assert.throws(()=>prepare({...production,mode:'migrations',release:'current-production',baseline:'006'}))
  assert.throws(()=>prepare({...production,branch:'br-solitary-grass-au781ekx',mode:'preflight'}))
  for(const release of ['private','newer','sandbox']) assert.equal(prepare({...staging,mode:'migrations',release,baseline:'empty'}).historical,true)
  assert.equal(prepare({...staging,mode:'migrations',release:'newer',baseline:'006'}).requests.length,3)
})
const configuration={...production,mode:'configuration',release:'current-production',host:'00000000-0000-4000-8000-000000000002',approval:'configuration-review-001'}
test('configuration requires a reviewed seeded host and never accepts membership inputs',()=>{
  for(const extra of [{role:'admin'},{user:'00000000-0000-4000-8000-000000000001'},{'identity-record':'unused'},{host:undefined},{host:"';DROP SCHEMA x;--"},{approval:undefined},{approval:'unapproved identity'},{release:'private'},{baseline:'empty'}]) assert.throws(()=>prepare({...configuration,...extra}))
  assert.throws(()=>prepare({...configuration,mode:'bootstrap'}))
  const packet=prepare(configuration)
  const statements=packet.requests[0].arguments.sql_statements
  assert.equal(statements.length,6)
  assert.match(statements[3],/rrd_activation_configuration\(uuid,text\).*\$1,\$2/)
  assert.equal(statements[5],'DEALLOCATE rrd_activation_configuration')
  assert.doesNotMatch(statements.join('\n'),/rrd_scheduling\.members|neon_auth|SET user_id|INSERT INTO rrd_scheduling\.hosts|platform_administrators/)
  assert.equal(packet.packet_sha256,sha256(readFileSync(new URL('./bootstrap.sql',import.meta.url))))
  assert.equal(packet.scope,'configuration')
  assert.equal(packet.source_commit,releases['current-production'].ref)
})
test('preflight statements are catalog SELECTs, never customer/session records',()=>{
  const packet=prepare({...staging,mode:'preflight'})
  assert.equal(packet.requests.length,11)
  for(const request of packet.requests) assert.match(sqlBody(request.arguments.sql),/^SELECT\b/)
  assert.ok(packet.requests.every(r=>!r.arguments.sql.includes('FROM neon_auth."session"')))
})
test('separate SQL static safety invariants are present, not a database execution claim',()=>{
  for(const file of ['bootstrap.sql','membership.sql']) {
    const source=readFileSync(new URL(`./${file}`,import.meta.url),'utf8')
    assert.equal(splitSql(source).length,1)
    for(const marker of ['pg_advisory_xact_lock','FOR UPDATE','ON CONFLICT','changes>0','Single reviewed migration-seeded host required','billing_settings','Verified migrations 001-009 required']) assert.ok(source.includes(marker),`${file}: ${marker}`)
    assert.doesNotMatch(source,/DROP\s+(?:SCHEMA|TABLE)|SET\s+(?:enabled|active|delivery_enabled)\s*=\s*true|INSERT INTO rrd_scheduling\.(?:hosts|platform_administrators|platform_accounts|domains)/i)
  }
  const member=readFileSync(new URL('./membership.sql',import.meta.url),'utf8')
  for(const marker of ['Existing member privilege/status conflict','permission_role IS DISTINCT FROM','status IS DISTINCT FROM','Existing host configuration/ownership mismatch','user_id IS NULL','banned IS NOT TRUE']) assert.ok(member.includes(marker))
  assert.doesNotMatch(member,/UPDATE rrd_scheduling\.members|INSERT INTO rrd_scheduling\.(?:tenants|configuration|appointment_types|public_links|notification_settings)/)
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
  const member=readFileSync(new URL('./membership.sql',import.meta.url),'utf8')
  assert.ok(member.indexOf('Existing member privilege/status conflict')>member.indexOf('ON CONFLICT(tenant_id,user_id)'))
  assert.ok(bootstrap.includes('c.policies<>expected_policies'))
  for(const statement of prepare(configuration).requests[0].arguments.sql_statements) assert.equal(splitSql(statement).length,1)
  assert.ok(runbook.includes(releases['current-production'].ref))
  assert.ok(runbook.includes('current-production'))
})
const membership={...configuration,mode:'membership',user:'00000000-0000-4000-8000-000000000001',role:'admin',approval:'membership-review-001'}
function evidenceFixture() {
  const identity={userId:membership.user,emailVerified:true,dashboardAuthorized:true,grantsPrivileges:false,sourceCommit:releases['current-production'].ref,deploymentId:'dpl_offlineTestOnly',applicationOrigin:'https://offline-test.invalid',authenticationOrigin:`https://${productionCompute}.neonauth.c-10.us-east-1.aws.neon.tech`,checkedAt:new Date().toISOString()}
  const raw=JSON.stringify(identity), hash=sha256(raw)
  const authorization={id:membership.approval,scope:'rrd-membership-and-host-binding',source_commit:identity.sourceCommit,tenant_slug:'roosters-ridge-digital',user_id:membership.user,host_id:membership.host,role:membership.role,identity_sha256:hash,application_origin:identity.applicationOrigin,deployment_id:identity.deploymentId,target:'production',database_target:validateTarget(production),fresh_session_verified:true,runtime_mapping_verified:true,operator:'offline-test-operator',reviewer:'offline-test-reviewer'}
  return {identity,raw,hash,authorization}
}
test('membership cannot be prepared from UUID or approval strings alone',()=>{
  assert.throws(()=>prepare(membership),/record files required/)
  assert.throws(()=>prepare({...membership,'identity-record':'/nonexistent/identity','authorization-record':'/nonexistent/authorization'}),/valid private/)
})
test('fresh verified identity and exact separately approved binding are mandatory',()=>{
  const {identity,hash,authorization}=evidenceFixture(), target=validateTarget(production), now=Date.now()
  const check=(i=identity,a=authorization,o=membership)=>validateMembershipEvidence(o,target,i,a,hash,now)
  assert.equal(check().evidence_scope,'OPERATOR_ATTESTED_NOT_CRYPTOGRAPHIC_SESSION_PROOF')
  for(const change of [{checkedAt:'invalid'},{checkedAt:new Date(now-300001).toISOString()},{checkedAt:new Date(now+30001).toISOString()},{userId:membership.host},{emailVerified:false},{dashboardAuthorized:false},{grantsPrivileges:true},{sourceCommit:releases.private.ref},{deploymentId:null},{authenticationOrigin:'https://wrong.invalid'},{applicationOrigin:'http://offline-test.invalid'},{applicationOrigin:'https://offline-test.invalid/path'}]) assert.throws(()=>check({...identity,...change}),JSON.stringify(change))
  for(const change of [{id:'different'},{scope:'configuration'},{user_id:membership.host},{host_id:membership.user},{role:'owner'},{identity_sha256:'0'.repeat(64)},{tenant_slug:'other'},{source_commit:releases.private.ref},{target:'staging'},{database_target:{...target,branch_id:'br-solitary-grass-au781ekx'}},{application_origin:'https://other.invalid'},{deployment_id:'dpl_other'},{runtime_mapping_verified:false},{fresh_session_verified:false},{operator:''},{reviewer:''}]) assert.throws(()=>check(identity,{...authorization,...change}),JSON.stringify(change))
  assert.throws(()=>check(identity,null))
  assert.throws(()=>check(null))
  assert.throws(()=>check(identity,authorization,{...membership,role:'platform_admin'}))
})
test('membership packet generation reads private records but emits no session or record contents',()=>{
  const directory=mkdtempSync(join(tmpdir(),'rrd-offline-evidence-'))
  try {
    const {raw,authorization}=evidenceFixture()
    const identityPath=join(directory,'identity.json'), authorizationPath=join(directory,'authorization.json')
    writeFileSync(identityPath,raw)
    writeFileSync(authorizationPath,JSON.stringify(authorization))
    const packet=prepare({...membership,'identity-record':identityPath,'authorization-record':authorizationPath})
    const sql=packet.requests[0].arguments.sql_statements
    assert.equal(sql.length,6)
    assert.equal(packet.identity_evidence_sha256,sha256(raw))
    assert.equal(packet.authorization_evidence_sha256,sha256(JSON.stringify(authorization)))
    assert.equal(packet.status,'PREPARED_NOT_EXECUTED')
    for(const statement of sql) assert.equal(splitSql(statement).length,1)
    assert.match(sql[3],/rrd_activation_membership\(text,uuid,text,text\).*\$1,\$2,\$3,\$4/)
    assert.doesNotMatch(JSON.stringify(packet),/offline-test-operator|offline-test-reviewer|offline-test.invalid|identity.json|authorization.json/)
    writeFileSync(identityPath,raw+' ')
    assert.throws(()=>prepare({...membership,'identity-record':identityPath,'authorization-record':authorizationPath}),/authorization record/)
    writeFileSync(identityPath,'not JSON')
    assert.throws(()=>prepare({...membership,'identity-record':identityPath,'authorization-record':authorizationPath}),/valid private/)
  } finally { rmSync(directory,{recursive:true,force:true}) }
})
test('both source-object and working-file checksum drift fail closed',()=>{
  const expected=sha256('reviewed')
  verifyMigrationBytes('test.sql',expected,'reviewed',Buffer.from('reviewed'))
  assert.throws(()=>verifyMigrationBytes('test.sql',expected,'tampered','reviewed'),/Checksum drift/)
  assert.throws(()=>verifyMigrationBytes('test.sql',expected,'reviewed','tampered'),/Checksum drift/)
  assert.throws(()=>pinnedMigrations('toString'))
  assert.throws(()=>pinnedMigrations('__proto__'))
})
test('unknown and duplicated CLI options fail closed',()=>{
  assert.throws(()=>parseOptions(['--execute','true']))
  assert.throws(()=>parseOptions(['--mode','preflight','--mode','bootstrap']))
  assert.throws(()=>parseOptions(['--target']))
})
