import {it,expect} from 'vitest';
import {monthlyTargetCount} from './monthly-count';
it.each([-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])('rejects invalid count %s without changing it',value=>expect(()=>monthlyTargetCount(value)).toThrow('INVALID_TARGET'));
it.each([0,1,100])('preserves valid count %s',value=>expect(monthlyTargetCount(value)).toBe(value));
