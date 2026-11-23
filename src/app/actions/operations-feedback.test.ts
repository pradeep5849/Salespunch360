import {beforeEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({update:vi.fn(),revalidate:vi.fn()}));
vi.mock('@/lib/attendance/service',()=>({updateCompanyOperations:m.update,endAttendance:vi.fn(),startAttendance:vi.fn(),uploadLocationPoint:vi.fn()}));
vi.mock('next/cache',()=>({revalidatePath:m.revalidate}));
import {updateOperationsAction} from './attendance';
beforeEach(()=>vi.clearAllMocks());
it('reports persistence failure without success or refreshing saved state',async()=>{m.update.mockRejectedValue(new Error('DB_DOWN'));expect(await updateOperationsAction(new FormData())).toEqual({saveError:'OPERATIONS_SAVE_FAILED'});expect(m.revalidate).not.toHaveBeenCalled()});
it('does not turn denied access into reported success',async()=>{m.update.mockRejectedValue(new Error('FORBIDDEN'));expect(await updateOperationsAction(new FormData())).toEqual({saveError:'OPERATIONS_SAVE_FAILED'})});
it('acknowledges save only after the authorized service succeeds',async()=>{m.update.mockResolvedValue({});const form=new FormData();form.set('attendanceEnabled','on');expect(await updateOperationsAction(form)).toEqual({saved:true});expect(m.update).toHaveBeenCalledWith({attendanceEnabled:true,gpsTrackingEnabled:false,checkoutRequiredBeforeNextCheckIn:false});expect(m.revalidate).toHaveBeenCalledWith('/workspace/settings')});
