import {describe,expect,it,vi} from "vitest";
import {z} from "zod";
import {logFieldCheckInFailure} from "./field-checkin-errors";
import {CHECK_IN_FAILURE_STAGES,attachCheckInFailureStage,getCheckInFailureStage} from "./field-checkin-stage";
import {VisitPolicyError} from "./policy";

describe("check-in failure stages",()=>{
  it.each(CHECK_IN_FAILURE_STAGES)("attaches and retrieves %s",stage=>{const error=new Error("private");expect(attachCheckInFailureStage(error,stage)).toBe(error);expect(getCheckInFailureStage(error)).toBe(stage);});

  it("maps invalid and untrusted stages to UNKNOWN",()=>{const error=new Error("private");attachCheckInFailureStage(error,"/private/photos/company/object.jpg");expect(getCheckInFailureStage(error)).toBe("UNKNOWN");expect(getCheckInFailureStage("CREATE_VISIT")).toBe("UNKNOWN");});

  it("preserves Prisma-like error identity, code, and metadata",()=>{const error=Object.assign(new Error("raw database message"),{name:"PrismaClientKnownRequestError",code:"P2010",meta:{database_error_code:"42804"}});expect(attachCheckInFailureStage(error,"CREATE_VISIT")).toBe(error);expect(error.code).toBe("P2010");expect(error.meta).toEqual({database_error_code:"42804"});});

  it("preserves VisitPolicyError behavior",()=>{const error=new VisitPolicyError("PHOTO_REQUIRED");attachCheckInFailureStage(error,"PHOTO_PROCESS");expect(error).toBeInstanceOf(VisitPolicyError);expect(error.message).toBe("PHOTO_REQUIRED");});

  it("preserves ZodError behavior and issues",()=>{const parsed=z.object({location:z.object({latitude:z.number()})}).safeParse({location:{latitude:"secret"}});expect(parsed.success).toBe(false);if(!parsed.success){const issues=parsed.error.issues;attachCheckInFailureStage(parsed.error,"READ_EMPLOYEE");expect(parsed.error).toBeInstanceOf(z.ZodError);expect(parsed.error.issues).toBe(issues);}});

  it("logs only safe diagnostics with the attached allowlisted stage",()=>{const error=Object.assign(new Error("database rejected Sensitive Person at /private/storage/company/object.jpg"),{name:"PrismaClientKnownRequestError",code:"P2010",meta:{database_error_code:"42804",message:"phone 9999999999, SQL SELECT secret"}});attachCheckInFailureStage(error,"PHOTO_MAIN_WRITE");const logged=vi.spyOn(console,"error").mockImplementation(()=>undefined);logFieldCheckInFailure(error,"NEW");expect(logged).toHaveBeenCalledWith({event:"FIELD_CHECKIN_FAILED",errorName:"PrismaClientKnownRequestError",errorCode:"UNEXPECTED_ERROR",prismaCode:"P2010",databaseCode:"42804",stage:"PHOTO_MAIN_WRITE",zodFieldPaths:[],visitType:"NEW"});const output=JSON.stringify(logged.mock.calls[0][0]);for(const secret of ["Sensitive Person","9999999999","/private/storage/company/object.jpg","SELECT secret","raw database message"])expect(output).not.toContain(secret);logged.mockRestore();});
});
