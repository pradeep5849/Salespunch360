import {expect,it} from 'vitest';
import {branchUiEnabled} from './presentation';
it('hides branch presentation until an additional persisted branch exists',()=>{expect(branchUiEnabled(0)).toBe(false);expect(branchUiEnabled(1)).toBe(false);expect(branchUiEnabled(2)).toBe(true)});
it('keeps multi-location mode when additional branches are inactive or outside user authority',()=>{const totalIncludingInactive=3;expect(branchUiEnabled(totalIncludingInactive)).toBe(true)});
it('preserves presentation for older clients without the new projection',()=>{expect(branchUiEnabled(undefined)).toBe(true)});
