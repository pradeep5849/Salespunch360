export type FollowUpType="VISIT"|"CALL";

const VISIT_MARKER="[[SP360_FOLLOW_UP:VISIT]]";
const CALL_MARKER="[[SP360_FOLLOW_UP:CALL]]";

export function parseFollowUpType(raw:unknown):FollowUpType{
 const value=String(raw??"VISIT").trim().toUpperCase();
 if(value!=="VISIT"&&value!=="CALL")throw new Error("INVALID_FOLLOW_UP_TYPE");
 return value;
}

export function encodeFollowUpNotes(type:FollowUpType,raw:unknown):string{
 const marker=type==="CALL"?CALL_MARKER:VISIT_MARKER;
 const notes=typeof raw==="string"?raw.trim():"";
 const maxNotes=Math.max(0,2000-marker.length-1);
 return notes?`${marker}\n${notes.slice(0,maxNotes)}`:marker;
}

export function decodeFollowUpNotes(raw:string|null|undefined):{type:FollowUpType;notes:string|null}{
 const value=raw??"";
 if(value.startsWith(CALL_MARKER))return{type:"CALL",notes:value.slice(CALL_MARKER.length).replace(/^\n/,"").trim()||null};
 if(value.startsWith(VISIT_MARKER))return{type:"VISIT",notes:value.slice(VISIT_MARKER.length).replace(/^\n/,"").trim()||null};
 return{type:"VISIT",notes:value.trim()||null};
}
