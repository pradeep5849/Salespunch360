import {beforeAll,beforeEach,afterAll,it,expect,vi} from 'vitest';
import {PrismaClient} from '@prisma/client';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
vi.mock('@/lib/db',()=>({db:new Proxy({},{get:(_,key)=>client[key as keyof PrismaClient]})}));
vi.mock('@/lib/email/mailer',()=>({sendVerificationEmail:vi.fn()}));
import {issueEmailVerification,verifyEmailToken} from './email-verification';
const databaseUrl=process.env.SECURITY_REGRESSION_DATABASE_URL;
const url=new URL(databaseUrl??'postgresql://unused:unused@127.0.0.1:55433/unused_ci');
if(!['127.0.0.1','localhost'].includes(url.hostname)||!url.pathname.endsWith('_ci'))throw new Error('Isolated local security fixture required');
const client=new PrismaClient({datasources:{db:{url:url.href}}});
const companyId=randomUUID(),userId=randomUUID(),email=`${userId}@example.invalid`;
beforeAll(async()=>{if(!databaseUrl)return;await client.company.create({data:{id:companyId,name:'Disposable security fixture',slug:`security-${companyId}`,productEdition:'SALESPUNCH360_PLUS'}});await client.user.create({data:{id:userId,companyId,name:'Fixture owner',email,passwordHash:'fixture-only',role:'COMPANY_ADMIN',salesRole:'PRIMARY_ADMIN',salesAccessActive:true}})},30000);
beforeEach(async()=>{if(!databaseUrl)return;await client.emailVerificationToken.deleteMany({where:{userId}});await client.user.update({where:{id:userId},data:{email,emailVerifiedAt:null}})});
afterAll(async()=>client.$disconnect());
async function issue(){let token='';await issueEmailVerification(userId,email,async(_,value)=>{token=value});return token}
it.skipIf(!databaseUrl)('binds delivery destination and consumes a matching link once',async()=>{const token=await issue();const stored=await client.emailVerificationToken.findFirstOrThrow({where:{userId}});expect(stored.destinationEmail).toBe(email);expect(await verifyEmailToken(token)).toBe(true);expect(await verifyEmailToken(token)).toBe(false);expect((await client.user.findUniqueOrThrow({where:{id:userId}})).emailVerifiedAt).not.toBeNull()});
it.skipIf(!databaseUrl)('rejects a delivered old-address link after address replacement without consuming it',async()=>{const token=await issue();await client.user.update({where:{id:userId},data:{email:`new-${email}`}});expect(await verifyEmailToken(token)).toBe(false);expect((await client.user.findUniqueOrThrow({where:{id:userId}})).emailVerifiedAt).toBeNull();expect((await client.emailVerificationToken.findFirstOrThrow({where:{userId}})).usedAt).toBeNull()});
it.skipIf(!databaseUrl)('requires resend for a legacy token lacking destination proof',async()=>{const token=randomBytes(32).toString('base64url');await client.emailVerificationToken.create({data:{userId,tokenHash:createHash('sha256').update(token).digest('hex'),expiresAt:new Date(Date.now()+3600000)}});expect(await verifyEmailToken(token)).toBe(false);expect((await client.user.findUniqueOrThrow({where:{id:userId}})).emailVerifiedAt).toBeNull()});
it.skipIf(!databaseUrl)('allows exactly one concurrent consumption of the same link',async()=>{const token=await issue();const results=await Promise.all([verifyEmailToken(token),verifyEmailToken(token)]);expect(results.filter(Boolean)).toHaveLength(1);expect(await client.emailVerificationToken.count({where:{userId,usedAt:{not:null}}})).toBe(1)});
