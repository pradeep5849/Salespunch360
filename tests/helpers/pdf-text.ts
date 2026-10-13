export async function extractPdfText(bytes:Uint8Array) {
  const {getDocument}=await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task=getDocument({data:new Uint8Array(bytes),disableFontFace:true,useSystemFonts:false});
  const document=await task.promise;
  try {
    const pages:string[]=[];
    for(let n=1;n<=document.numPages;n++) {
      const content=await (await document.getPage(n)).getTextContent();
      pages.push(content.items.map(item=>"str" in item?item.str:"").join(" "));
    }
    return {text:pages.join("\n"),pages:document.numPages};
  } finally {await task.destroy();}
}
