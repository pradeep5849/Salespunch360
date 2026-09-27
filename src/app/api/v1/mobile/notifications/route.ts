import {NextRequest,NextResponse} from "next/server";
import {authenticateMobileSalesToken} from "@/lib/mobile/auth";
import {db} from "@/lib/db";
import {listSalesNotificationsForActor} from "@/lib/sales-notifications/service";
export async function GET(request:NextRequest){const actor=await authenticateMobileSalesToken(request.headers.get("authorization"));return NextResponse.json(await listSalesNotificationsForActor(actor));}
export async function POST(request:NextRequest){const actor=await authenticateMobileSalesToken(request.headers.get("authorization")),body=await request.json();if(body.action==="READ_ALL")await db.salesNotification.updateMany({where:{companyId:actor.companyId,recipientUserId:actor.id,readAt:null},data:{readAt:new Date()}});else await db.salesNotification.updateMany({where:{id:String(body.id??""),companyId:actor.companyId,recipientUserId:actor.id,readAt:null},data:{readAt:new Date()}});return NextResponse.json({ok:true});}
