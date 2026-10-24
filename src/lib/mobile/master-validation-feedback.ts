import {z} from "zod";
/** Expected field validation stays recoverable; unexpected server/database errors are not hidden. */
export function masterValidationFeedback(error:unknown){
 if(error instanceof z.ZodError)return {error:"INVALID_INPUT",fields:error.flatten().fieldErrors};
 if(!(error instanceof Error))return null;
 if(error.message==="INVALID_INPUT")return {error:"INVALID_INPUT"};
 const custom=/^(CUSTOM_FIELDS_REQUIRED|INVALID_CUSTOM_FIELD):([^\r\n]+)$/.exec(error.message);
 if(!custom)return null;
 const message=custom[1]==="CUSTOM_FIELDS_REQUIRED"?"This custom field is required.":"Enter a valid value for this custom field.";
 return {error:"INVALID_INPUT",message,fields:{[`customFields.${custom[2]}`]:[message]}};
}
