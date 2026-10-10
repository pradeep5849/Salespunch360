import {describe,expect,it} from "vitest";
import {loginSchema,strongPasswordSchema} from "@/lib/auth/validation";
import {mobileLoginSchema,mobilePasswordSchema} from "./validation";
const deviceId="11111111-1111-4111-8111-111111111111";
describe("A001-F02 shared credential bounds",()=>{
 it.each([128,129,200,201])("uses consistent bounds for %i characters",length=>{
  const password="Aa1"+"x".repeat(length-3),expected=length<=200;
  expect(strongPasswordSchema.safeParse(password).success).toBe(expected);
  expect(loginSchema.safeParse({email:"a@example.com",password}).success).toBe(expected);
  expect(mobileLoginSchema.safeParse({identifier:"a@example.com",password,deviceId}).success).toBe(expected);
  expect(mobilePasswordSchema.safeParse({currentPassword:"old",newPassword:password,confirmPassword:password}).success).toBe(expected);
 });
 it("preserves credential whitespace and allows existing short passwords",()=>expect(mobileLoginSchema.parse({identifier:" a@example.com ",password:" p ",deviceId})).toMatchObject({identifier:"a@example.com",password:" p ",rememberMe:false}));
 it("rejects missing/empty/oversized credentials and forged roles",()=>{
  for(const password of [undefined,"","x".repeat(201)])expect(mobileLoginSchema.safeParse({identifier:"a@example.com",password,deviceId}).success).toBe(false);
  expect(mobileLoginSchema.safeParse({identifier:"a@example.com",password:"a",deviceId,role:"ACCOUNT_ADMIN"}).success).toBe(false);
 });
});
