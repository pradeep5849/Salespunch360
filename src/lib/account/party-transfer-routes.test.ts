import {beforeEach,describe,it,expect,vi} from "vitest";
const mocks=vi.hoisted(()=>({auth:vi.fn(),mobile:vi.fn(),adapter:vi.fn(),guard:vi.fn(),save:vi.fn(),read:vi.fn(),photo:vi.fn(),form:vi.fn(),dto:vi.fn(),reverse:vi.fn(),readJson:vi.fn()}));
vi.mock("@/lib/auth/authorization",()=>({AuthorizationError:class extends Error{},requirePermissionForMutation:mocks.auth}));
vi.mock("@/lib/mobile/auth",()=>({authenticateMobileToken:mocks.mobile}));
vi.mock("@/lib/mobile/account-transactions",()=>({mobileAccountActor:mocks.adapter}));
vi.mock("@/lib/security/request",()=>({mutationGuard:mocks.guard}));
vi.mock("@/lib/account/party-transfers",()=>({reversePartyTransferForActor:mocks.reverse,savePartyTransferForActor:mocks.save,partyTransferForActor:mocks.read,partyTransferPhotoForActor:mocks.photo}));
vi.mock("@/lib/account/party-transfer-http",()=>({partyTransferForm:mocks.form,partyTransferDto:mocks.dto,partyTransferJson:(body:unknown,status=200)=>Response.json(body,{status}),partyTransferFailure:()=>Response.json({error:"denied"},{status:403}),partyTransferPhotoResponse:()=>new Response("photo")}));
vi.mock("@/lib/mobile/transfer-request",()=>({readTransferRequestJson:mocks.readJson}));
import {POST as webReverse} from "@/app/api/account/party-transfers/[id]/reverse/route";
import {POST as mobileReverse} from "@/app/api/v1/mobile/account/party-transfers/[id]/reverse/route";
import {POST as webPost} from "@/app/api/account/party-transfers/route";
import {POST as mobilePost} from "@/app/api/v1/mobile/account/party-transfers/route";
import {GET as webGet} from "@/app/api/account/party-transfers/[id]/route";
import {GET as mobileGet} from "@/app/api/v1/mobile/account/party-transfers/[id]/route";
import {GET as webPhoto} from "@/app/api/account/party-transfers/[id]/photo/route";
import {GET as mobilePhoto} from "@/app/api/v1/mobile/account/party-transfers/[id]/photo/route";
const actor={id:"user",companyId:"company"},input={requestKey:"stable-key"},saved={id:"stable-key"},context={params:Promise.resolve({id:"source-id"})};
const req=()=>new Request("http://localhost/api/account/party-transfers",{method:"POST",headers:{authorization:"Bearer example"}});
beforeEach(()=>{vi.resetAllMocks();mocks.readJson.mockResolvedValue(input);mocks.reverse.mockResolvedValue({id:"source-id",status:"REVERSED"});mocks.auth.mockResolvedValue(actor);mocks.mobile.mockResolvedValue(actor);mocks.adapter.mockReturnValue(actor);mocks.form.mockResolvedValue({input,file:undefined});mocks.save.mockResolvedValue(saved);mocks.read.mockResolvedValue(saved);mocks.dto.mockReturnValue(saved);mocks.photo.mockResolvedValue({bytes:Buffer.from("photo"),mimeType:"image/webp"});});
describe("party transfer route authorization and shared financial service",()=>{
 it.each([["web",webPost],["mobile",mobilePost]] as const)("%s creation authenticates and invokes exactly one atomic service",async(kind,post)=>{
  const response=await post(req());expect(response.status).toBe(201);expect(mocks.save).toHaveBeenCalledExactlyOnceWith(actor,input,undefined);
  if(kind==="web"){expect(mocks.auth).toHaveBeenCalledWith("ACCOUNT_MONEY_ENTRY");expect(mocks.guard).toHaveBeenCalledWith("party-transfer-create");}else{expect(mocks.mobile).toHaveBeenCalledWith("Bearer example");expect(mocks.adapter).toHaveBeenCalledWith(actor);}
 });
 it.each([["web",webPost],["mobile",mobilePost]] as const)("%s denies unauthenticated writes before reading uploads",async(kind,post)=>{
  (kind==="web"?mocks.auth:mocks.mobile).mockRejectedValue(new Error("denied"));expect((await post(req())).status).toBe(403);expect(mocks.form).not.toHaveBeenCalled();expect(mocks.save).not.toHaveBeenCalled();
 });
 it("denies untrusted Web origins before reading the upload",async()=>{mocks.guard.mockRejectedValue(new Error("UNTRUSTED_ORIGIN"));expect((await webPost(req())).status).toBe(403);expect(mocks.form).not.toHaveBeenCalled();expect(mocks.save).not.toHaveBeenCalled();});
 it.each([["web",webGet],["mobile",mobileGet]] as const)("%s reads use the authenticated actor and requested source",async(_,get)=>{expect((await get(req(),context)).status).toBe(200);expect(mocks.read).toHaveBeenCalledExactlyOnceWith(actor,"source-id");});
 it.each([["web",webPhoto],["mobile",mobilePhoto]] as const)("%s photo reads use the guarded source service",async(_,get)=>{expect((await get(req(),context)).status).toBe(200);expect(mocks.photo).toHaveBeenCalledExactlyOnceWith(actor,"source-id");});
 it.each([[webGet,mocks.auth],[mobileGet,mocks.mobile],[webPhoto,mocks.auth],[mobilePhoto,mocks.mobile]] as const)("denied reads never fetch private source or bytes",async(get,auth)=>{auth.mockRejectedValue(new Error("denied"));expect((await get(req(),context)).status).toBe(403);expect(mocks.read).not.toHaveBeenCalled();expect(mocks.photo).not.toHaveBeenCalled();});
 it.each([["web",webReverse],["mobile",mobileReverse]] as const)("%s reversal delegates one complete source operation",async(kind,post)=>{expect((await post(req(),context)).status).toBe(200);expect(mocks.reverse).toHaveBeenCalledExactlyOnceWith(actor,"source-id",input);if(kind==="web")expect(mocks.guard).toHaveBeenCalledWith("party-transfer-reverse");});
 it.each([[webReverse,mocks.auth],[mobileReverse,mocks.mobile]] as const)("denied reversal never reads the body or writes journals",async(post,auth)=>{auth.mockRejectedValue(new Error("denied"));expect((await post(req(),context)).status).toBe(403);expect(mocks.readJson).not.toHaveBeenCalled();expect(mocks.reverse).not.toHaveBeenCalled();});

});
