import {describe,expect,it} from 'vitest';
import {MobileEmployeeError} from './employees';
import {mobileTravelApprovalMode} from './employee-admin';

describe('mobile employee travel settings',()=>{
 it.each(['AUTO','MANUAL'] as const)('accepts the supported %s approval mode',mode=>{
  expect(mobileTravelApprovalMode(mode)).toBe(mode);
 });

 it.each([undefined,null,'','automatic','manual',1])('rejects an unexpected approval mode: %j',value=>{
  expect(()=>mobileTravelApprovalMode(value)).toThrowError(new MobileEmployeeError('INVALID_INPUT'));
 });
});
