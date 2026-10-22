import {createAccountBackup} from "@/lib/account/utilities";
export async function GET(request:Request){
 try{
  const output=await createAccountBackup(new URL(request.url).searchParams.get("includeFiles")==="true");
  return new Response(output.bytes,{headers:{"content-type":"application/json; charset=utf-8","content-disposition":`attachment; filename="${output.fileName}"`,"x-content-sha256":output.checksum,"cache-control":"private, no-store"}});
 }catch(error){
  const code=error instanceof Error?error.message:"";
  const errors:Record<string,[number,string]>={BACKUP_FILE_UNAVAILABLE:[503,"A required private file is unavailable. No file-inclusive backup was recorded. Check storage availability and retry."],BACKUP_FILES_TOO_LARGE:[413,"Private files exceed the application bundle limit. Use the record-only export together with your provider storage backup."],BACKUP_FILE_SCOPE_INVALID:[409,"A private-file reference failed company validation. No file-inclusive backup was recorded."]};
  if(errors[code]){const [status,message]=errors[code];return new Response(message,{status,headers:{"cache-control":"private, no-store"}})}
  throw error;
 }
}
