import {createHash} from 'node:crypto';
import {z} from 'zod';
export const creationRequestKeySchema=z.string().guid();
export const optionalCreationRequestKeySchema=z.preprocess(value=>value===""||value===null?undefined:value,creationRequestKeySchema.optional());
export function creationIntentHash(payload:unknown){return createHash('sha256').update(JSON.stringify(payload)).digest('hex')}
export function assertCreationIntent(actual:string|null,expected:string){if(actual!==expected)throw new Error('CREATION_REQUEST_CONFLICT')}
export function publicCreationResult<T extends {creationRequestKey?:string|null;creationRequestHash?:string|null}>(row:T){const{creationRequestKey,creationRequestHash,...result}=row;void creationRequestKey;void creationRequestHash;return result}
