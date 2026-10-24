import {beforeEach,describe,expect,it,vi} from "vitest";
import sharp from "sharp";
const m=vi.hoisted(()=>({company:vi.fn(),signature:vi.fn(),settings:vi.fn(),get:vi.fn()}));
vi.mock("@/lib/db",()=>({db:{company:{findUnique:m.company},authorizedSignatureVersion:{findFirst:m.signature},accountSettings:{findUnique:m.settings}}}));
vi.mock("@/lib/storage",()=>({privateStorage:()=>({get:m.get})}));
import {quotationPrintAssets} from "./print-assets";
beforeEach(()=>{vi.clearAllMocks();m.company.mockResolvedValue({logoObjectKey:"private-logo"});m.signature.mockResolvedValue({objectKey:"private-signature"});m.settings.mockResolvedValue({printProfile:{authorizedSignatory:"Signer",accountNumber:"PRIVATE-BANK"}})});
describe("quotation print assets",()=>{
 it("loads only the authorized company brand and current signature and exposes normalized image bytes",async()=>{
  const png=await sharp({create:{width:2,height:2,channels:4,background:"#123456"}}).png().toBuffer();m.get.mockResolvedValue(png);
  const result=await quotationPrintAssets("company");
  expect(m.company).toHaveBeenCalledWith({where:{id:"company"},select:{logoObjectKey:true}});
  expect(m.signature).toHaveBeenCalledWith({where:{companyId:"company",isCurrent:true},orderBy:{createdAt:"desc"},select:{objectKey:true}});
  expect(m.settings).toHaveBeenCalledWith({where:{companyId:"company"},select:{transactionDefaults:true,printProfile:true}});
  expect(result).toMatchObject({logoDataUrl:expect.stringMatching(/^data:image\/png;base64,/),signatureDataUrl:expect.stringMatching(/^data:image\/png;base64,/),authorizedSignatory:"Signer"});
  expect(JSON.stringify(result)).not.toMatch(/private-logo|private-signature|PRIVATE-BANK|companyId|objectKey/);
 });
 it("honors hidden logo and signature preferences without reading private storage",async()=>{
  m.settings.mockResolvedValue({transactionDefaults:{invoicePrintSettings:{companyLogo:false,signatureText:false}}});
  expect(await quotationPrintAssets("company")).toEqual({});expect(m.get).not.toHaveBeenCalled();
 });
 it("does not invent missing images or a signatory",async()=>{
  m.company.mockResolvedValue({logoObjectKey:null});m.signature.mockResolvedValue(null);m.settings.mockResolvedValue(null);
  expect(await quotationPrintAssets("company")).toEqual({});expect(m.get).not.toHaveBeenCalled();
 });
 it("rejects oversized or corrupt private image data",async()=>{
  m.get.mockResolvedValue(Buffer.alloc(10*1024*1024+1));await expect(quotationPrintAssets("company")).rejects.toThrow("QUOTATION_PRINT_ASSET_TOO_LARGE");
  m.get.mockResolvedValue(Buffer.from("not an image"));await expect(quotationPrintAssets("company")).rejects.toThrow();
 });
});
