/** Returns only an official HTTPS Google Play destination. */
export function validatedGooglePlayUrl(value:string|undefined):string|undefined{
  if(!value)return undefined;
  try{
    const url=new URL(value);
    return url.protocol==="https:"&&url.hostname==="play.google.com"?url.toString():undefined;
  }catch{return undefined}
}
