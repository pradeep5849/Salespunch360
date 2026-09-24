import {redirect} from "next/navigation";
import {reportActor} from "@/lib/reports/scope";

export default async function ReportsPage(){
 await reportActor();
 redirect("/workspace/reports/check-ins");
}
