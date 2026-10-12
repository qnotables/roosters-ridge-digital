import { beforeEach,afterEach,describe,it,expect,vi } from 'vitest'
const mocks=vi.hoisted(()=>({process:vi.fn()}))
vi.mock('@/lib/email-workspace-db',()=>({emailDb:{}}))
vi.mock('@/modules/scheduling/notification-worker',()=>({processSchedulingNotifications:mocks.process}))
import {GET} from '@/app/api/cron/scheduling/route'
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('CRON_SECRET','a-dedicated-test-secret');mocks.process.mockResolvedValue({state:'dry-run',processed:0})})
afterEach(()=>vi.unstubAllEnvs())
describe('scheduling cron boundary',()=>{
  it.each([undefined,'Bearer wrong','Bearer'])('rejects unauthorized requests before processing',async authorization=>{const response=await GET(new Request('https://example.com/api/cron/scheduling',{headers:authorization?{authorization}:{}}));expect(response.status).toBe(401);expect(mocks.process).not.toHaveBeenCalled()})
  it('fails closed when the dedicated secret is absent',async()=>{vi.stubEnv('CRON_SECRET','');expect((await GET(new Request('https://example.com/api/cron/scheduling',{headers:{authorization:'Bearer '}}))).status).toBe(401);expect(mocks.process).not.toHaveBeenCalled()})
  it('allows authenticated processing and never exposes customers or secrets',async()=>{const r=await GET(new Request('https://example.com/api/cron/scheduling',{headers:{authorization:'Bearer a-dedicated-test-secret'}}));expect(r.status).toBe(200);expect(await r.json()).toEqual({state:'dry-run',processed:0});expect(r.headers.get('cache-control')).toBe('no-store')})
  it('keeps database failures private and requests retry',async()=>{mocks.process.mockRejectedValue(new Error('private database connection'));const r=await GET(new Request('https://example.com/api/cron/scheduling',{headers:{authorization:'Bearer a-dedicated-test-secret'}}));expect(r.status).toBe(503);expect(JSON.stringify(await r.json())).not.toContain('private database')})
})
