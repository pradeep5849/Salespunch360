import {describe,expect,it} from 'vitest';
import {environmentSchema} from '@/lib/env';
import {isTrustedOrigin} from './request';

const production={DATABASE_URL:'postgresql://db.example/salespunch360',AUTH_SECRET:'a-production-secret-that-is-deliberately-longer-than-forty-eight-characters',NODE_ENV:'production' as const,APP_URL:'https://salespunch360.com',TRUST_PROXY:'true',PAYMENT_PROVIDER:'UNCONFIGURED' as const};

describe('production safety',()=>{
  it('accepts a complete HTTPS production configuration',()=>expect(environmentSchema.safeParse(production).success).toBe(true));
  it('rejects an HTTP production origin',()=>expect(environmentSchema.safeParse({...production,APP_URL:'http://salespunch360.com'}).success).toBe(false));
  it('rejects short production signing secrets',()=>expect(environmentSchema.safeParse({...production,AUTH_SECRET:'short'}).success).toBe(false));
  it('rejects non-PostgreSQL databases',()=>expect(environmentSchema.safeParse({...production,DATABASE_URL:'mysql://db.example/app'}).success).toBe(false));
  it('cannot enable a test payment provider',()=>expect(environmentSchema.safeParse({...production,PAYMENT_PROVIDER:'TEST'}).success).toBe(false));
});

describe('browser mutation origins',()=>{
  it('accepts the configured origin',()=>expect(isTrustedOrigin('https://salespunch360.com','https://salespunch360.com/path')).toBe(true));
  it('rejects a hostile origin',()=>expect(isTrustedOrigin('https://attacker.example','https://salespunch360.com')).toBe(false));
  it('rejects misleading subdomains and malformed origins',()=>{expect(isTrustedOrigin('https://salespunch360.com.attacker.example','https://salespunch360.com')).toBe(false);expect(isTrustedOrigin('not-a-url','https://salespunch360.com')).toBe(false)});
});
