/** Rasterize only the PDF already authorized by the print endpoint. All pages
 * are retained as separate images; pages are never cropped or silently omitted. */
export async function printPdfPageImages(file:File):Promise<File[]> {
 const pdfjs=await import("pdfjs-dist");
 pdfjs.GlobalWorkerOptions.workerSrc=new URL("pdfjs-dist/build/pdf.worker.min.mjs",import.meta.url).toString();
 const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),useSystemFonts:true});
 try{
  const pdf=await task.promise;
  if(pdf.numPages>50)throw new Error("This document has more than 50 pages. Share it as PDF instead.");
  const files:File[]=[];
  for(let index=1;index<=pdf.numPages;index++){
   const page=await pdf.getPage(index),viewport=page.getViewport({scale:1.5}),canvas=document.createElement("canvas");
   canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
   try{
    const context=canvas.getContext("2d");if(!context)throw new Error("Image export is not supported in this browser. Share as PDF instead.");
    await page.render({canvas,canvasContext:context,viewport}).promise;
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error("Could not prepare the image. Please try sharing as PDF.")),"image/png"));
    files.push(new File([blob],`${file.name.replace(/\.pdf$/i,"")}${pdf.numPages>1?`-page-${index}`:""}.png`,{type:"image/png"}));
   }finally{page.cleanup();canvas.width=0;canvas.height=0;}
  }
  return files;
 }finally{await task.destroy();}
}
