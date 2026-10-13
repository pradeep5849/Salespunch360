import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({getDocument:vi.fn(),destroy:vi.fn(),cleanup:vi.fn(),render:vi.fn(),getPage:vi.fn()}));
vi.mock("pdfjs-dist",()=>({getDocument:m.getDocument,GlobalWorkerOptions:{workerSrc:""}}));
import {printPdfPageImages} from "./print-page-images";
const input=()=>new File(["%PDF"],"INV-1.pdf",{type:"application/pdf"});
beforeEach(()=>{vi.resetAllMocks();m.destroy.mockResolvedValue(undefined);m.render.mockReturnValue({promise:Promise.resolve()});m.getPage.mockResolvedValue({getViewport:()=>({width:100,height:200}),render:m.render,cleanup:m.cleanup});m.getDocument.mockReturnValue({promise:Promise.resolve({numPages:2,getPage:m.getPage}),destroy:m.destroy});vi.stubGlobal("document",{createElement:()=>({width:0,height:0,getContext:()=>({}),toBlob:(callback:(blob:Blob)=>void)=>callback(new Blob(["png"],{type:"image/png"}))})});});
afterEach(()=>vi.unstubAllGlobals());
describe("all-page invoice image export",()=>{
 it("retains all pages with distinct names and cleans up PDF resources",async()=>{const files=await printPdfPageImages(input());expect(files.map(file=>file.name)).toEqual(["INV-1-page-1.png","INV-1-page-2.png"]);expect(files.every(file=>file.type==="image/png")).toBe(true);expect(m.cleanup).toHaveBeenCalledTimes(2);expect(m.destroy).toHaveBeenCalledOnce();});
 it("destroys a failed PDF loading task",async()=>{m.getDocument.mockReturnValue({promise:Promise.reject(new Error("Invalid PDF")),destroy:m.destroy});await expect(printPdfPageImages(input())).rejects.toThrow("Invalid PDF");expect(m.destroy).toHaveBeenCalledOnce();});
 it("returns no partial files if a page fails to render",async()=>{m.render.mockReturnValueOnce({promise:Promise.resolve()}).mockReturnValueOnce({promise:Promise.reject(new Error("Render failed"))});await expect(printPdfPageImages(input())).rejects.toThrow("Render failed");expect(m.cleanup).toHaveBeenCalledTimes(2);expect(m.destroy).toHaveBeenCalledOnce();});
 it("offers PDF for documents above the resource bound instead of omitting pages",async()=>{m.getDocument.mockReturnValue({promise:Promise.resolve({numPages:51,getPage:m.getPage}),destroy:m.destroy});await expect(printPdfPageImages(input())).rejects.toThrow("Share it as PDF");expect(m.getPage).not.toHaveBeenCalled();expect(m.destroy).toHaveBeenCalledOnce();});
});
