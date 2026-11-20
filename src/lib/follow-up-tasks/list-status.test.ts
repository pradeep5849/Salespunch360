import {expect,it} from 'vitest';
import {followUpStatusWhere} from './list-status';
it('uses the India business day before and after local midnight',()=>{
 expect(followUpStatusWhere('OVERDUE',new Date('2026-11-19T18:29:59Z'))).toEqual({status:'PENDING',dueDate:{lt:new Date('2026-11-19')}});
 expect(followUpStatusWhere('OVERDUE',new Date('2026-11-19T18:30:00Z'))).toEqual({status:'PENDING',dueDate:{lt:new Date('2026-11-20')}});
});
it('Pending includes every unfinished task, while Upcoming only contains future dates',()=>{
 const now=new Date('2026-11-19T10:00Z');expect(followUpStatusWhere('PENDING',now)).toEqual({status:'PENDING'});
 expect(followUpStatusWhere('UPCOMING',now)).toEqual({status:'PENDING',dueDate:{gte:new Date('2026-11-20')}});
 expect(followUpStatusWhere('TODAY',now)).toEqual({status:'PENDING',dueDate:{gte:new Date('2026-11-19'),lt:new Date('2026-11-20')}});
});
it('closed aliases stored completion and cancellation stays separate',()=>{expect(followUpStatusWhere('CLOSED')).toEqual({status:'COMPLETED'});expect(followUpStatusWhere('COMPLETED')).toEqual({status:'COMPLETED'});expect(followUpStatusWhere('CANCELLED')).toEqual({status:'CANCELLED'});expect(followUpStatusWhere('ALL')).toEqual({});expect(followUpStatusWhere('invalid')).toEqual({status:'PENDING'})});
