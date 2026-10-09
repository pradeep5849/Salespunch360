import {describe,expect,it,vi} from 'vitest';
import {retrySerializable} from './transaction-retry';
describe('serialization retry policy',()=>{
 it.each([{code:'P2034'},{code:'P2010',meta:{code:'40001'}},{code:'P2010',meta:{code:'40P01'}}])('retries only serialization/deadlock aborts %j',async metadata=>{const operation=vi.fn().mockRejectedValueOnce(Object.assign(new Error('retry'),metadata)).mockResolvedValue('committed');expect(await retrySerializable(operation)).toBe('committed');expect(operation).toHaveBeenCalledTimes(2)});
 it('does not retry business or other database errors',async()=>{const operation=vi.fn().mockRejectedValue(Object.assign(new Error('invalid'),{code:'P2002'}));await expect(retrySerializable(operation)).rejects.toThrow('invalid');expect(operation).toHaveBeenCalledOnce()});
 it('bounds retries',async()=>{const operation=vi.fn().mockRejectedValue(Object.assign(new Error('busy'),{code:'P2034'}));await expect(retrySerializable(operation)).rejects.toThrow('busy');expect(operation).toHaveBeenCalledTimes(3)});
});
