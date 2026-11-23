import {it,expect} from 'vitest';
import {splitCallbackQueue,type CallbackQueueItem} from './service';
const now=new Date('2026-11-21T06:00:00Z');
const item=(id:string,due:string,followUpTaskId?:string)=>({id,nextCallbackAt:new Date(due),followUpTaskId}) as CallbackQueueItem;
it('keeps a date-only Call due today in Today while timestamp callbacks remain time-sensitive',()=>{const [overdue,today,upcoming]=splitCallbackQueue([item('task','2026-11-20T18:30:00Z','task-id'),item('callback','2026-11-21T05:00:00Z'),item('later','2026-11-21T07:00:00Z'),item('tomorrow','2026-11-21T18:30:00Z','tomorrow-id')],now);expect(overdue[1].map(row=>row.id)).toEqual(['callback']);expect(today[1].map(row=>row.id)).toEqual(['task','later']);expect(upcoming[1].map(row=>row.id)).toEqual(['tomorrow'])});
it('moves an unattended date-only task to overdue on the next India day',()=>{const [overdue]=splitCallbackQueue([item('task','2026-11-20T18:30:00Z','task-id')],new Date('2026-11-21T18:30:01Z'));expect(overdue[1]).toHaveLength(1)});

it('keeps linked timestamp callbacks time-sensitive after task conversion',()=>{const callback={...item('linked','2026-11-21T05:00:00Z','task-id'),callbackCallId:'source-call'};expect(splitCallbackQueue([callback],now)[0][1]).toHaveLength(1)});
