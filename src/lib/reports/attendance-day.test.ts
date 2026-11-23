import {it,expect} from 'vitest';
import {latestAttendanceDayEnd} from './attendance-day';
it('keeps an earlier open session visible even if a later session ended',()=>expect(latestAttendanceDayEnd([{endedAt:null},{endedAt:new Date('2026-11-21T10:00Z')}])).toBeNull());
it('keeps a later open session visible too',()=>expect(latestAttendanceDayEnd([{endedAt:new Date('2026-11-21T10:00Z')},{endedAt:null}])).toBeNull());
it('returns the latest confirmed end when every session ended',()=>expect(latestAttendanceDayEnd([{endedAt:new Date('2026-11-21T11:00Z')},{endedAt:new Date('2026-11-21T10:00Z')}])).toEqual(new Date('2026-11-21T11:00Z')));
