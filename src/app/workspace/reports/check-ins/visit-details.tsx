import {dateTime,distance,duration} from '../report-ui';
type Visit={contactName:string|null;contactPhone:string|null;visitType:string;checkedInAt:Date;checkedOutAt:Date|null;checkInLatitude:number;checkInLongitude:number;checkInAccuracyMeters:number;checkInAddress:string|null;checkOutLatitude:number|null;checkOutLongitude:number|null;checkOutAccuracyMeters:number|null;checkoutSentiment:string|null;checkoutRemarks:string|null;visitNotes:string|null;durationMs:number|null;referenceDistanceMeters:number|null;user:{name:string;salesRole:string|null}};
const coordinates=(lat:number|null,lng:number|null)=>lat===null||lng===null?'Not recorded':`${lat.toFixed(5)}, ${lng.toFixed(5)}`;
export function ReportVisitDetails({row}:{row:Visit}){return <details><summary>Details</summary><dl>
 <dt>Recorded contact</dt><dd>{row.contactName||'Not recorded'}</dd><dt>Recorded phone</dt><dd>{row.contactPhone?.trim()||'Not recorded'}</dd>
 <dt>Visited by</dt><dd>{row.user.name}</dd><dt>Visit type</dt><dd>{row.visitType.replaceAll('_',' ')}</dd>
 <dt>Check in (IST)</dt><dd>{dateTime(row.checkedInAt)}</dd><dt>Check out (IST)</dt><dd>{row.checkedOutAt?dateTime(row.checkedOutAt):'Not recorded — visit active'}</dd><dt>Duration</dt><dd>{duration(row.durationMs)}</dd>
 <dt>Check-in address</dt><dd>{row.checkInAddress||'Not recorded'}</dd><dt>Check-in coordinates</dt><dd>{coordinates(row.checkInLatitude,row.checkInLongitude)}</dd><dt>Check-in accuracy</dt><dd>{row.checkInAccuracyMeters} m</dd>
 <dt>Checkout coordinates</dt><dd>{coordinates(row.checkOutLatitude,row.checkOutLongitude)}</dd><dt>Checkout accuracy</dt><dd>{row.checkOutAccuracyMeters===null?'Not recorded':`${row.checkOutAccuracyMeters} m`}</dd>
 <dt>Distance from saved reference</dt><dd>{row.referenceDistanceMeters===null?'No saved reference':distance(row.referenceDistanceMeters)}</dd>
 <dt>Outcome</dt><dd>{row.checkoutSentiment||'Not recorded'}</dd><dt>Checkout remarks</dt><dd>{row.checkoutRemarks||'Not recorded'}</dd><dt>Visit notes</dt><dd>{row.visitNotes||'Not recorded'}</dd>
 </dl></details>}
