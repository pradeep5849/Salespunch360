import {excelResponse} from '@/app/api/reports/[report]/excel/route';
import {authenticateMobileSalesToken} from '@/lib/mobile/auth';
import {mobileReportActor} from '@/lib/mobile/report-actor';
import {mobileAuthorizationFailure,mobileBranchFailure,mobileJson,mobileUnauthorized,mobileUnexpected} from '@/lib/mobile/http';

export async function GET(request:Request,{params}:{params:Promise<{report:string}>}){try{const user=await authenticateMobileSalesToken(request.headers.get('authorization')),actor=mobileReportActor(user),{report}=await params,raw=Object.fromEntries(new URL(request.url).searchParams);return await excelResponse(report,raw,actor)}catch(error){const expected=mobileUnauthorized(error)??mobileAuthorizationFailure(error)??mobileBranchFailure(error);if(expected)return expected;const limited=error instanceof Error&&error.message==='ROW_LIMIT';if(limited)return mobileJson({error:'More than 10,000 rows match. Narrow your filters and try again.'},422);return mobileUnexpected('MOBILE_REPORT_EXPORT',error)}}
