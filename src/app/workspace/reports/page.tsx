import {redirect} from "next/navigation";
import {reportActor} from "@/lib/reports/service";

export default async function ReportsPage(){
 await reportActor();
 redirect("/workspace/reports/check-ins");
}
