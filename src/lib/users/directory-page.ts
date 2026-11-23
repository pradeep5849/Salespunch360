import {Prisma} from '@prisma/client';
import {db} from '@/lib/db';
import {AuthorizationError} from '@/lib/auth/authorization';
import {canUsePermission} from '@/lib/auth/permissions';
export type DirectoryDomain='sales'|'account'|'account-access';
export const DIRECTORY_PAGE_SIZE=50;
const telecaller=Prisma.sql`(u."salesRole"='SALES' AND lower(btrim(coalesce(u.designation,'')))='telecaller')`;
const userSelect={id:true,name:true,email:true,phone:true,isActive:true,salesRole:true,accountRole:true,managerType:true,managerId:true,designation:true,salesAccessActive:true,accountAccessActive:true,branchAccessScope:true,branchAccesses:{select:{branchId:true}}} as const;
export async function directoryPageForActor(actor:Parameters<typeof canUsePermission>[0]&{companyId:string|null},domain:DirectoryDomain,raw:{q?:string;page?:string|number;filter?:string}={}){
 if(!actor.companyId||actor.role==='SUPER_ADMIN')throw new AuthorizationError();
 const company=await db.company.findUnique({where:{id:actor.companyId},select:{productEdition:true}});
 if(!company||!canUsePermission(actor,company.productEdition,domain==='sales'?'SALES_USER_ADMIN':'ACCOUNT_USER_ADMIN'))throw new AuthorizationError();
 const q=(raw.q??'').trim().slice(0,100),requested=Number(raw.page??1),requestedPage=Number.isFinite(requested)?Math.min(10000,Math.max(1,Math.floor(requested))):1,filter=(raw.filter??'all').toUpperCase();
 const base=Prisma.sql`u."companyId"=${actor.companyId}::uuid AND u.role<>'SUPER_ADMIN' AND u."salesRole" IS DISTINCT FROM 'PRIMARY_ADMIN' ${domain==='sales'?Prisma.sql`AND u."salesRole" IS NOT NULL`:domain==='account'?Prisma.sql`AND u."accountRole" IS NOT NULL`:Prisma.empty}`;
 const inactive=domain==='sales'?Prisma.sql`(NOT u."isActive" OR (NOT u."salesAccessActive" AND NOT ${telecaller}))`:Prisma.sql`(NOT u."isActive" OR NOT u."accountAccessActive")`;
 let role=Prisma.sql`TRUE`;
 if(filter==='INACTIVE')role=inactive;
 else if(domain==='sales'){
  if(filter==='ADMINISTRATORS')role=Prisma.sql`u."salesRole"='ADMIN'`;
  if(filter==='MANAGERS')role=Prisma.sql`u."salesRole"='MANAGER'`;
  if(filter==='SALES')role=Prisma.sql`u."salesRole"='SALES' AND NOT ${telecaller}`;
  if(filter==='TELECALLERS')role=telecaller;
 }else if(['ACCOUNT_ADMIN','ACCOUNTANT','PROJECT_MANAGER','DATA_ENTRY'].includes(filter))role=Prisma.sql`u."accountRole"::text=${filter}`;
 const terms=q.split(/\s+/).filter(Boolean).map(term=>{const pattern='%'+term.replace(/[\\%_]/g,'\\$&')+'%';return Prisma.sql`(u.name ILIKE ${pattern} OR u.email ILIKE ${pattern} OR u.phone ILIKE ${pattern} OR replace(u."salesRole"::text,'_',' ') ILIKE ${pattern} OR replace(u."accountRole"::text,'_',' ') ILIKE ${pattern})`});
 const search=terms.length?Prisma.join(terms,' AND '):Prisma.sql`TRUE`;
 const counts=await db.$queryRaw<{total:number;inactive:number;matches:number}[]>(Prisma.sql`SELECT count(*)::int AS total,count(*) FILTER(WHERE ${inactive})::int AS inactive,count(*) FILTER(WHERE ${role} AND ${search})::int AS matches FROM users u WHERE ${base}`);
 const total=counts[0]?.matches??0,totalPages=Math.max(1,Math.ceil(total/DIRECTORY_PAGE_SIZE)),page=Math.min(requestedPage,totalPages);
 const ids=total?await db.$queryRaw<{id:string}[]>(Prisma.sql`SELECT u.id FROM users u WHERE ${base} AND ${role} AND ${search} ORDER BY u."isActive" DESC,u.name ASC,u.id ASC LIMIT ${DIRECTORY_PAGE_SIZE} OFFSET ${(page-1)*DIRECTORY_PAGE_SIZE}`):[];
 const users=ids.length?await db.user.findMany({where:{companyId:actor.companyId,id:{in:ids.map(x=>x.id)}},select:userSelect,orderBy:[{isActive:'desc'},{name:'asc'},{id:'asc'}]}):[];
 return {users,page,pageSize:DIRECTORY_PAGE_SIZE,total,totalPages,hasMore:page<totalPages,q,statistics:{total:counts[0]?.total??0,inactive:counts[0]?.inactive??0}};
}
