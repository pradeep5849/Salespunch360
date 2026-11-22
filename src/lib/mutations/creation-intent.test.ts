import {it,expect} from 'vitest';
import {creationIntentHash,assertCreationIntent,publicCreationResult} from './creation-intent';
it('binds retries to actor and normalized intent without imposing phone uniqueness',()=>{const first={actorId:'admin',name:'Lead',phone:'9000000000'};const hash=creationIntentHash(first);expect(creationIntentHash({...first,actorId:'other'})).not.toBe(hash);expect(()=>assertCreationIntent(hash,creationIntentHash({...first,name:'Different'}))).toThrow('CREATION_REQUEST_CONFLICT');expect(()=>assertCreationIntent(hash,creationIntentHash(first))).not.toThrow()});
it('does not expose persisted request metadata in creation responses',()=>{expect(publicCreationResult({id:'record',creationRequestKey:'key',creationRequestHash:'hash'})).toEqual({id:'record'})});
