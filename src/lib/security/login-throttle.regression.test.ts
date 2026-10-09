import {beforeEach,describe,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({ip:"192.0.2.1",buckets:new Map<string,{count:number;resetsAt:Date}>()}));
vi.mock("next/headers",()=>({headers:async()=>new Headers({"x-real-ip":m.ip})}));
vi.mock("@/lib/env",()=>({env:{TRUST_PROXY:false}}));
vi.mock("@/lib/db",()=>{
 const tx={$executeRaw:vi.fn(),rateLimitBucket:{findUnique:async({where}:{where:{key:string}})=>m.buckets.get(where.key),upsert:async({where,create}:{where:{key:string};create:{count:number;resetsAt:Date}})=>m.buckets.set(where.key,create),update:async({where}:{where:{key:string}})=>{m.buckets.get(where.key)!.count++}}};
 return {db:{$transaction:async(fn:(client:typeof tx)=>Promise<boolean>)=>fn(tx)}};
});
import {consumeRateLimit,requestFingerprint} from "./request";
beforeEach(()=>{m.ip="192.0.2.1";m.buckets.clear()});
describe("A001-F01 canonical login throttle",()=>{
 it("counts padded/case variants together and denies the eleventh attempt",async()=>{
  const now=new Date("2026-10-09T00:00:00Z");
  for(let i=0;i<10;i++)expect(await consumeRateLimit(await requestFingerprint("sign-in",`${" ".repeat(i)}User@Example.com `),10,900000,now)).toBe(true);
  expect(await consumeRateLimit(await requestFingerprint("sign-in","user@example.com"),10,900000,now)).toBe(false);
  expect(m.buckets.size).toBe(1);
 });
 it("resets at expiry and separates identities/IPs",async()=>{
  const now=new Date("2026-10-09T00:00:00Z"),key=await requestFingerprint("sign-in","a@example.com");
  expect(await consumeRateLimit(key,1,900000,now)).toBe(true);expect(await consumeRateLimit(key,1,900000,now)).toBe(false);
  expect(await consumeRateLimit(key,1,900000,new Date(now.getTime()+900000))).toBe(true);
  expect(await requestFingerprint("sign-in","b@example.com")).not.toBe(key);m.ip="192.0.2.2";expect(await requestFingerprint("sign-in","a@example.com")).not.toBe(key);
 });
});
