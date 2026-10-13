import "regenerator-runtime/runtime";
import {PDFDocument,type PDFFont} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {readFile} from "node:fs/promises";
import {join} from "node:path";
const fontFiles = ["NotoSans-Regular.ttf", "NotoSansDevanagari-Regular.ttf", "NotoSansKannada-Regular.ttf"];
let fontBytes:Promise<Buffer[]>|undefined;
const fontData=()=>fontBytes??=Promise.all(fontFiles.map(file=>readFile(join(process.cwd(),"assets/fonts",file)))).catch(error=>{fontBytes=undefined;throw error;});
type FontChoice={font:PDFFont;characters:Set<number>};
const segmenter=new Intl.Segmenter("en",{granularity:"grapheme"});
function runs(text:string,fonts:FontChoice[],unsupportedError:string) {
  const result:Array<{text:string;font:PDFFont}>=[];
  for(const {segment} of segmenter.segment(text)) {
    const points=Array.from(segment).map(char=>char.codePointAt(0)!);
    const choice=fonts.find(font=>points.every(point=>font.characters.has(point)||point===0x200c||point===0x200d));
    if(!choice)throw new Error(unsupportedError);
    const last=result[result.length-1];
    if(last?.font===choice.font)last.text+=segment;
    else result.push({text:segment,font:choice.font});
  }
  return result;
}
const widthCaches=new WeakMap<FontChoice[],Map<string,number>>();
function width(text:string,fonts:FontChoice[],size:number,unsupportedError:string) {
  let cache=widthCaches.get(fonts);
  if(!cache){cache=new Map();widthCaches.set(fonts,cache);}
  const key=`${size}:${text}`,cached=cache.get(key);
  if(cached!==undefined)return cached;
  const measured=runs(text,fonts,unsupportedError).reduce((total,run)=>total+run.font.widthOfTextAtSize(run.text,size),0);
  cache.set(key,measured);
  return measured;
}
function wrappedLines(text:string,fonts:FontChoice[],size:number,maxWidth:number,unsupportedError:string) {
  const result:string[]=[];
  for(const paragraph of text.replace(/\r\n?/g,"\n").split("\n")) {
    let line="";
    for(const word of paragraph.replace(/[\t\f\v]/g," ").split(/( +)/u)) {
      if(!word)continue;
      if(width(line+word,fonts,size,unsupportedError)<=maxWidth){line+=word;continue;}
      if(line.trim()){result.push(line.trimEnd());line="";}
      const token=word.trimStart();
      if(width(token,fonts,size,unsupportedError)<=maxWidth){line=token;continue;}
      for(const {segment} of segmenter.segment(token)) {
        if(line&&width(line+segment,fonts,size,unsupportedError)>maxWidth){result.push(line);line="";}
        line+=segment;
      }
    }
    result.push(line.trimEnd());
  }
  return result;
}
export async function createPdfTextLayout(pdf:PDFDocument,unsupportedError:string,standard?:{regular:PDFFont;bold:PDFFont}) {
 pdf.registerFontkit(fontkit);
 const fallback=await Promise.all((await fontData()).map(async bytes=>{const font=await pdf.embedFont(bytes,{subset:true});return {font,characters:new Set(font.getCharacterSet())};}));
 const choices=(font?:PDFFont)=>font?[{font,characters:new Set(font.getCharacterSet())},...fallback]:fallback;
 const regular=choices(standard?.regular),bold=choices(standard?.bold);
 return {runs:(text:string,strong=false)=>runs(text,strong?bold:regular,unsupportedError),lines:(text:string,size:number,maxWidth:number,strong=false)=>wrappedLines(text,strong?bold:regular,size,maxWidth,unsupportedError)};
}
