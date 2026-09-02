export const CHECK_IN_FAILURE_STAGES=["TX_BEGIN","LOCK_USER","READ_EMPLOYEE","READ_COMPANY","READ_ATTENDANCE","CHECK_OPEN_VISIT","LOCK_PHONE","PHONE_DEDUP","LOCK_CUSTOMER","READ_CUSTOMER","LOCK_LEAD","READ_LEAD","CREATE_VISIT","PHOTO_PROCESS","PHOTO_MAIN_WRITE","PHOTO_THUMB_WRITE","CREATE_PHOTO_METADATA","CREATE_LEAD","CREATE_ACTIVITY","LINK_VISIT","UPDATE_REFERENCE","TX_COMMIT","UNKNOWN"] as const;

export type CheckInFailureStage=(typeof CHECK_IN_FAILURE_STAGES)[number];

const allowedStages=new Set<string>(CHECK_IN_FAILURE_STAGES);
const failureStages=new WeakMap<object,CheckInFailureStage>();

export function attachCheckInFailureStage(error:unknown,stage:unknown):unknown{
  if(error!==null&&(typeof error==="object"||typeof error==="function"))failureStages.set(error,typeof stage==="string"&&allowedStages.has(stage)?stage as CheckInFailureStage:"UNKNOWN");
  return error;
}

export function getCheckInFailureStage(error:unknown):CheckInFailureStage{
  return error!==null&&(typeof error==="object"||typeof error==="function")?failureStages.get(error)??"UNKNOWN":"UNKNOWN";
}
