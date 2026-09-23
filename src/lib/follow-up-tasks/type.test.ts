import {describe,expect,it} from "vitest";
import {decodeFollowUpNotes,encodeFollowUpNotes,parseFollowUpType} from "./type";

describe("follow-up type metadata",()=>{
 it("round trips Visit and Call while keeping notes clean",()=>{
  expect(decodeFollowUpNotes(encodeFollowUpNotes("VISIT","Meet at site"))).toEqual({type:"VISIT",notes:"Meet at site"});
  expect(decodeFollowUpNotes(encodeFollowUpNotes("CALL","Discuss quotation"))).toEqual({type:"CALL",notes:"Discuss quotation"});
 });
 it("treats historical untyped tasks as Visit",()=>{
  expect(decodeFollowUpNotes("Old follow-up note")).toEqual({type:"VISIT",notes:"Old follow-up note"});
  expect(decodeFollowUpNotes(null)).toEqual({type:"VISIT",notes:null});
 });
 it("rejects unsupported types",()=>{
  expect(parseFollowUpType("CALL")).toBe("CALL");
  expect(parseFollowUpType("VISIT")).toBe("VISIT");
  expect(()=>parseFollowUpType("EMAIL")).toThrow("INVALID_FOLLOW_UP_TYPE");
 });
});
