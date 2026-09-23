import {Prisma} from "@prisma/client";
import {db} from "@/lib/db";
import {allocateDocumentNumberInTx} from "@/lib/account/numbering";

export type WonLeadProjectActor={id:string;companyId:string};

export async function ensureWonLeadProjectInTx(tx:Prisma.TransactionClient,actor:WonLeadProjectActor,leadId:string,now=new Date()){
 await tx.$queryRaw`SELECT "id" FROM "leads" WHERE "id"=${leadId}::uuid AND "companyId"=${actor.companyId}::uuid FOR UPDATE`;
 const existing=await tx.project.findFirst({where:{companyId:actor.companyId,sourceLeadId:leadId},select:{id:true,projectNumber:true}});
 if(existing)return existing;
 const company=await tx.company.findUnique({where:{id:actor.companyId},select:{productEdition:true,accountSettings:{select:{enabledModules:true}}}});
 if(!company||company.productEdition!=="SALESPUNCH360_PLUS"||!company.accountSettings?.enabledModules.includes("PROJECTS"))return null;
 const lead=await tx.lead.findFirst({where:{id:leadId,companyId:actor.companyId,stage:"WON"},select:{id:true,branchId:true,title:true,companyName:true,contactName:true,phone:true,email:true,estimatedValue:true,customerId:true,assignedUserId:true,assignedUser:{select:{managerId:true}},customer:{select:{id:true,name:true,isAccountCustomer:true}}}});
 if(!lead)return null;
 let customerId=lead.customerId;
 if(customerId){
  await tx.customer.update({where:{id:customerId},data:{isAccountCustomer:true}});
 }else{
  const customer=await tx.customer.create({data:{companyId:actor.companyId,branchId:lead.branchId,assignedUserId:lead.assignedUserId,name:(lead.companyName||lead.contactName||lead.title).trim(),contactPerson:lead.contactName,phone:lead.phone,email:lead.email,isAccountCustomer:true}});
  customerId=customer.id;
  await tx.lead.update({where:{id:lead.id},data:{customerId}});
 }
 const projectNumber=await allocateDocumentNumberInTx(tx,{companyId:actor.companyId,branchId:lead.branchId,seriesKey:"PROJECT",defaults:{prefix:"PRJ-",padding:6}});
 const project=await tx.project.create({data:{companyId:actor.companyId,branchId:lead.branchId,projectNumber,name:(lead.customer?.name||lead.companyName||lead.title).trim(),customerId,createdById:actor.id,status:"PLANNING",projectValue:lead.estimatedValue??new Prisma.Decimal(0),sourceLeadId:lead.id,sourceSalesUserId:lead.assignedUserId,sourceSalesManagerId:lead.assignedUser.managerId,handoverDate:now,siteName:lead.companyName??undefined,siteContactName:lead.contactName??undefined,siteContactPhone:lead.phone??undefined}});
 await tx.projectAuditEvent.create({data:{companyId:actor.companyId,projectId:project.id,actorUserId:actor.id,eventType:"PROJECT_CREATED",metadata:{source:"WON_LEAD",sourceLeadId:lead.id}}});
 return{id:project.id,projectNumber:project.projectNumber};
}

export async function ensureWonLeadProjectForActor(actor:WonLeadProjectActor,leadId:string){return db.$transaction(tx=>ensureWonLeadProjectInTx(tx,actor,leadId),{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});}
