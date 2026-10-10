/** Display metadata must not contain path components or control characters. */
export function attachmentDisplayName(name:string){
 const basename=name.replace(/\\/g,"/").split("/").pop()?.replace(/[\u0000-\u001f\u007f]/g,"").trim();
 return basename&&basename!=="."&&basename!==".."?basename.slice(0,240):"attachment";
}
