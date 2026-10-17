import {expect,it} from "vitest";
import {itemPhotoForm} from "./item-photo-upload";
it("reads a bounded multipart photo without trusting a content-length header",async()=>{const form=new FormData();form.set("photo",new File(["image"],"photo.png",{type:"image/png"}));const parsed=await itemPhotoForm(new Request("https://local.invalid",{method:"POST",body:form}));expect(parsed.get("photo")).toBeInstanceOf(File)});
it("rejects oversized declared and chunked bodies before parsing",async()=>{
 await expect(itemPhotoForm(new Request("https://local.invalid",{method:"POST",headers:{"content-length":"99999999"},body:"small"}))).rejects.toThrow("INVALID_ITEM_PHOTO");
 let cancelled=false;const stream=new ReadableStream<Uint8Array>({pull(controller){controller.enqueue(new Uint8Array(1024*1024))},cancel(){cancelled=true}});
 const request=new Request("https://local.invalid",{method:"POST",body:stream,duplex:"half"} as RequestInit);await expect(itemPhotoForm(request)).rejects.toThrow("INVALID_ITEM_PHOTO");expect(cancelled).toBe(true);
});
it("rejects malformed multipart bodies",async()=>{await expect(itemPhotoForm(new Request("https://local.invalid",{method:"POST",headers:{"content-type":"multipart/form-data; boundary=missing"},body:"not multipart"}))).rejects.toThrow("INVALID_ITEM_PHOTO")});
