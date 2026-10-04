import{describe,expect,it,vi}from"vitest";
import{executeSave,INITIAL_SAVE_FEEDBACK,SAVE_FEEDBACK_DISMISS_MS}from"./save-feedback";
describe("shared Account save feedback",()=>{
 it("starts without premature success",()=>expect(INITIAL_SAVE_FEEDBACK).toEqual({kind:"idle",message:"",id:0}));
 it("shows success only after the async action resolves",async()=>{let resolve!:()=>void;const action=vi.fn(()=>new Promise<void>(done=>{resolve=done})),pending=executeSave(action,new FormData(),1);expect(action).toHaveBeenCalledOnce();let settled=false;pending.then(()=>{settled=true});await Promise.resolve();expect(settled).toBe(false);resolve();await expect(pending).resolves.toMatchObject({kind:"success",message:"Saved successfully"})});
 it("maps failures to safe error feedback without success",async()=>{const result=await executeSave(async()=>{throw new Error("database secret")},new FormData(),2);expect(result).toEqual({kind:"error",message:"Unable to save. Check the details and try again.",id:2});expect(result.message).not.toContain("secret")});
 it("does not clear submitted data when a save fails",async()=>{const data=new FormData();data.set("name","Preserved customer");await executeSave(async()=>{throw new Error("failed")},data,3);expect(data.get("name")).toBe("Preserved customer")});
 it("supports one auto-dismiss window and unique replacement ids",async()=>{expect(SAVE_FEEDBACK_DISMISS_MS).toBeGreaterThanOrEqual(2000);expect(SAVE_FEEDBACK_DISMISS_MS).toBeLessThanOrEqual(3000);const first=await executeSave(async()=>{},new FormData(),3),second=await executeSave(async()=>{},new FormData(),4);expect(second.id).toBeGreaterThan(first.id)});
});
