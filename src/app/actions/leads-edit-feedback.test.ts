import {it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({edit:vi.fn(),revalidate:vi.fn()}));
vi.mock('@/lib/leads/service',()=>({createLead:vi.fn(),createLeadFromVisit:vi.fn(),editLead:m.edit}));
vi.mock('@/lib/leads/transition-with-project',()=>({transitionLeadWithProjectForActor:vi.fn()}));
vi.mock('@/lib/auth/authorization',()=>({requirePermissionForMutation:vi.fn()}));
vi.mock('next/cache',()=>({revalidatePath:m.revalidate}));
import {saveLead} from './leads';
import {LeadError} from '@/lib/leads/policy';
it('returns actionable stale-draft guidance without reporting success',async()=>{m.edit.mockRejectedValue(new LeadError('STALE'));const form=new FormData();form.set('leadId','lead');form.set('version','1');const result=await saveLead({},form);expect(result.stale).toBe(true);expect(result.error).toContain('Copy any unsaved changes');expect(result.success).toBeUndefined();expect(m.revalidate).not.toHaveBeenCalled()});
