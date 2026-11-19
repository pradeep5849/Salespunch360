import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({authorized:vi.fn(),generate:vi.fn()}));
vi.mock('@/lib/field-jobs/service',()=>({authorizedJobRunner:m.authorized}));
vi.mock('@/lib/sales-notifications/service',()=>({generateFollowUpReminders:m.generate}));
import {POST} from './route';
beforeEach(()=>{vi.clearAllMocks();m.generate.mockResolvedValue({processed:3,created:2})});
it('unauthenticated job cannot create notifications',async()=>{m.authorized.mockReturnValue(false);expect((await POST(new Request('https://test/api',{method:'POST'}))).status).toBe(401);expect(m.generate).not.toHaveBeenCalled()});
it('authorized runner executes only reminder sweep and prevents caching',async()=>{m.authorized.mockReturnValue(true);const response=await POST(new Request('https://test/api',{method:'POST',headers:{Authorization:'Bearer synthetic'}}));expect(await response.json()).toEqual({processed:3,created:2});expect(response.headers.get('Cache-Control')).toBe('no-store');expect(m.authorized).toHaveBeenCalledWith('Bearer synthetic')});
