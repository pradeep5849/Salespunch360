import {Prisma} from "@prisma/client";

export function logBillingFailure(operation:string,stage:string,error:unknown){
 const prismaCode=error instanceof Prisma.PrismaClientKnownRequestError?error.code:undefined;
 const errorCode=error instanceof Error&&/^[A-Z][A-Z0-9_]{2,100}$/.test(error.message)?error.message:"UNEXPECTED_ERROR";
 console.error("BILLING_OPERATION_FAILED",{operation,stage,errorCode,...(prismaCode?{prismaCode}:{})});
}
